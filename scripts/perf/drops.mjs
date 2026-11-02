// Dropped frames, counted by Chrome. Frame rates read from requestAnimationFrame move with the load and
// with one late frame in a short phase; the ledger counts work, most of which never lands in a frame
// that was late. This counts the frames themselves: Chrome's compositor reports every frame it meant
// to show (PipelineReporter in the trace) and whether it was shown, shown in part or dropped, whether
// that hurt smoothness, and how long each stage took. So each late frame comes with its stage: the
// main thread (busy, or slow to produce it), raster, the GPU drawing it, or presentation.
//
// It repeats one short interaction (a cycle) N times and traces each step:
//   window   open the window from a live preview, then close it        (steps: open, close)
//   scroll   one section down, then back up                            (steps: down, up)
//   product  to the next product and back                              (steps: next, back)
//
//   node scripts/perf/drops.mjs --cycle window --n 10 [--throttle 4]
//   node scripts/perf/drops.mjs --cycle window --n 10 --ab dist-a dist-b    # alternated, with p-values
//   node scripts/perf/drops.mjs --cycle window --n 5 --why                  # what the main thread did in them
//
// A build is a folder under the repo (DIST for one, --ab for two; default `dist`). --throttle slows the
// CPU (the GPU stays as it is). INJECT=busy:<ms> burns that much of every frame for 600 ms after each
// step starts: a known cost, to check that the count sees it (with --ab, only in the second build if
// INJECT_ONLY=b).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hand, launch, placer, serve, sleep } from './kit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const CYCLE = arg('cycle', 'window');
const N = Number(arg('n', 10));
const THROTTLE = Number(arg('throttle', 1));
const ID = process.env.ID ?? 'knowgraph';
const ab = process.argv.includes('--ab') ? process.argv.slice(process.argv.indexOf('--ab') + 1, process.argv.indexOf('--ab') + 3) : null;
const builds = (ab ?? [process.env.DIST ?? 'dist']).map((d) => resolve(root, d));

// ---- One frame's report ------------------------------------------------------------------------------
// The stage that took longest names the frame's cause.
const STAGE = {
  BeginImplFrameToSendBeginMainFrame: 'main busy',
  SendBeginMainFrameToCommit: 'main',
  Commit: 'main',
  EndCommitToActivation: 'raster',
  Activation: 'raster',
  EndActivateToSubmitCompositorFrame: 'compositor',
  SubmitCompositorFrameToPresentationCompositorFrame: 'gpu',
  SubmitToReceiveCompositorFrame: 'gpu',
  ReceiveCompositorFrameToStartDraw: 'gpu',
  StartDrawToSwapStart: 'gpu',
  Swap: 'gpu',
  SwapEndToPresentationCompositorFrame: 'present',
};
function reduce(events, placeTrace) {
  // The page's renderer: the process with a renderer main thread (the stages share it, on [::1]).
  const ours = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => e.pid));
  const open = new Map();
  const spans = [];
  for (const e of events.filter((e) => (e.ph === 'b' || e.ph === 'e') && e.cat?.includes('benchmark') && ours.has(e.pid)).sort((a, b) => a.ts - b.ts)) {
    const id = e.id2?.local ?? e.id;
    const k = `${id}:${e.name}`;
    if (e.ph === 'b') open.set(k, e);
    else {
      const b = open.get(k);
      if (!b) continue;
      open.delete(k);
      spans.push({ name: e.name, id, ts: b.ts, end: e.ts, args: b.args });
    }
  }
  const byId = new Map();
  for (const s of spans) if (s.name !== 'PipelineReporter') (byId.get(s.id) ?? byId.set(s.id, []).get(s.id)).push(s);
  const out = { frames: 0, dropped: 0, partial: 0, causes: {} };
  for (const r of spans.filter((s) => s.name === 'PipelineReporter')) {
    const fr = r.args?.frame_reporter;
    if (!fr) continue;
    out.frames++;
    if (!fr.affects_smoothness) continue;
    if (fr.state === 'STATE_DROPPED') out.dropped++;
    else out.partial++;
    // Shown in part: the compositor drew the frame on time, but without the main thread's update,
    // which missed it. The main thread is the cause, whatever stage ran longest.
    if (fr.state !== 'STATE_DROPPED') {
      r.main = true;
      out.causes['main missed'] = (out.causes['main missed'] ?? 0) + 1;
      continue;
    }
    let worst = null;
    for (const s of byId.get(r.id) ?? []) if (s.ts >= r.ts && s.end <= r.end && STAGE[s.name] && (!worst || s.end - s.ts > worst.end - worst.ts)) worst = s;
    const cause = worst ? STAGE[worst.name] : 'unknown';
    r.main = cause.startsWith('main');
    out.causes[cause] = (out.causes[cause] ?? 0) + 1;
  }
  out.late = out.dropped + out.partial;
  if (WHY) out.blame = blame(events, ours, spans, placeTrace);
  return out;
}

// What the main thread was doing while its frames were late: the tasks that overlap a frame the main
// thread made late (dropped while it was busy, or shown without its update), each counted once, split
// into script (by where it was installed), style, layout and paint.
const SCRIPT = new Set(['FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'EvaluateScript', 'v8.compile', 'FireIdleCallback', 'RunMicrotasks', 'v8.callFunction']);
function blame(events, ours, spans, placeTrace) {
  const late = spans.filter((r) => r.name === 'PipelineReporter' && r.args?.frame_reporter?.affects_smoothness && r.main);
  const mains = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && ours.has(e.pid)).map((e) => `${e.pid}:${e.tid}`));
  const kinds = { script: 0, style: 0, layout: 0, paint: 0, other: 0 };
  // A script's time goes to the first place under it that has a location (a frame callback has none
  // of its own; the function it calls does).
  const recs = [];
  let rec = null;
  const located = (e) => {
    const d = e.args?.data;
    const s = d?.stackTrace?.[0] ?? (d?.url ? d : null);
    return s ? placeTrace(s).where : null;
  };
  for (const tid of mains) {
    const list = events.filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === tid).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack = [];
    let hit = false;
    for (const e of list) {
      while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
      if (!stack.length) {
        // A task of its own: it counts if it overlaps a late frame.
        hit = e.name === 'RunTask' && late.some((r) => e.ts < r.end && e.ts + e.dur > r.ts);
        if (hit) kinds.other += e.dur / 1000;
      } else if (hit) {
        const ms = e.dur / 1000;
        const inScript = stack.some((s) => SCRIPT.has(s.name));
        const k = SCRIPT.has(e.name) && !inScript ? 'script' : e.name === 'UpdateLayoutTree' ? 'style' : e.name === 'Layout' ? 'layout' : /^(Paint|PrePaint|Layerize|PaintImage)$/.test(e.name) ? 'paint' : null;
        if (k && !stack.some((s) => (k === 'script' ? SCRIPT.has(s.name) : s.name === e.name))) {
          kinds[k] += ms;
          // Style or layout a script forced is the script's time already: move it, don't count it twice.
          if (k !== 'script' && inScript) {
            kinds.script -= ms;
            if (rec) rec.ms -= ms;
          } else kinds.other -= ms;
          if (k === 'script') recs.push((rec = { ms, at: located(e) }));
        } else if (rec && !rec.at && SCRIPT.has(e.name)) rec.at = located(e);
      }
      stack.push(e);
    }
  }
  const where = {};
  for (const r of recs) where[r.at ?? '(no location)'] = (where[r.at ?? '(no location)'] ?? 0) + r.ms;
  return { kinds, where };
}

// ---- Cycles ------------------------------------------------------------------------------------------
// --why also traces the main thread's tasks and the stacks that installed them, to say what it was doing
// in its late frames. It costs the page something, so the counts with it are not the counts without.
const WHY = process.argv.includes('--why');
const CATEGORIES = ['cc', 'benchmark', 'disabled-by-default-devtools.timeline.frame', 'devtools.timeline', ...(WHY ? ['toplevel', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute'] : [])];
const CYCLES = {
  window: (h, page) => ({
    ready: async () => {
      if (await h.windowOpen()) {
        await page.keyboard.press('Escape');
        await sleep(1500);
      }
      await h.goLive();
      await sleep(300);
      if (!(await h.isLive())) throw new Error('the preview never went live');
    },
    steps: [
      { name: 'open', act: () => h.clickZoom(), did: async () => ((await h.windowOpen()) ? null : 'the window did not open') },
      // Escape on the page itself (live.ts listens there): pressed for real it goes to the app, which
      // may take it for a dialog of its own, and the step would measure something else.
      { name: 'close', act: () => page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))), did: async () => ((await h.windowOpen()) ? 'the window is still open' : null) },
    ],
  }),
  scroll: (h, page) => {
    let top;
    return {
      // The keys go to the page, not to an app that has focus.
      ready: async () => {
        await page.evaluate(() => document.activeElement?.blur());
        await page.mouse.move(80, 500);
        top = await h.deckTop();
      },
      steps: [
        { name: 'down', act: () => page.keyboard.press('ArrowDown'), did: async () => ((await h.deckTop()) > top ? null : 'the deck did not move down') },
        { name: 'up', act: () => page.keyboard.press('ArrowUp'), did: async () => (Math.abs((await h.deckTop()) - top) < 2 ? null : 'the deck did not come back') },
      ],
    };
  },
  product: (h, page) => {
    let from;
    const go = (d) => page.evaluate((d) => {
      const go = [...document.querySelectorAll('[data-go]')];
      const i = go.findIndex((b) => b.getAttribute('aria-current') === 'true' || b.closest('[aria-current="true"]'));
      go[(i + d + go.length) % go.length]?.click();
    }, d);
    return {
      ready: async () => {
        await page.mouse.move(1530, 770, { steps: 3 });
        from = await h.activeHref();
      },
      steps: [
        { name: 'next', act: () => go(1), did: async () => ((await h.activeHref()) !== from ? null : 'the showcase stayed on the same product') },
        { name: 'back', act: () => go(-1), did: async () => ((await h.activeHref()) === from ? null : 'the showcase did not come back') },
      ],
    };
  },
};
if (!CYCLES[CYCLE]) throw new Error(`no cycle ${CYCLE}: ${Object.keys(CYCLES).join(', ')}`);

/** One block: a fresh page on one build, the cycle n times; per step, each repetition's report. */
async function block(dist, n, inject) {
  const { base, close } = await serve(dist);
  const { placeTrace } = placer(dist, base);
  const browser = await launch('drops');
  try {
    const [page] = await browser.pages();
    const cdp = await page.createCDPSession();
    const [kind, ms] = (inject ?? '').split(':');
    if (kind === 'busy') {
      // A known cost: each step burns `ms` of every frame for 600 ms.
      await page.evaluateOnNewDocument((ms) => {
        window.__busy = () => {
          const end = performance.now() + 600;
          const spin = () => {
            const t = performance.now();
            while (performance.now() - t < ms);
            if (performance.now() < end) requestAnimationFrame(spin);
          };
          requestAnimationFrame(spin);
        };
      }, Number(ms));
    }
    await page.goto(`${base}/#work/${ID}`, { waitUntil: 'load' });
    await page.evaluate(() => {
      // The showcase stays on the product asked for.
      const auto = document.querySelector('[data-auto]');
      if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
    });
    await page.mouse.move(40, 900);
    await sleep(3000);
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const h = hand(page);
    const cycle = CYCLES[CYCLE](h, page);
    const reports = Object.fromEntries(cycle.steps.map((s) => [s.name, []]));
    for (let i = 0; i < n; i++) {
      await cycle.ready();
      for (const step of cycle.steps) {
        await sleep(400);
        await page.tracing.start({ categories: CATEGORIES });
        await step.act();
        if (kind === 'busy') await page.evaluate(() => window.__busy());
        await sleep(1500);
        const trace = JSON.parse(Buffer.from(await page.tracing.stop()).toString());
        if (process.env.KEEP) writeFileSync(join(outDir, `drops-trace-${step.name}.json`), JSON.stringify(trace));
        const failed = await step.did();
        if (failed) throw new Error(`${CYCLE} ${step.name}, repetition ${i + 1}: ${failed}`);
        reports[step.name].push(reduce(trace.traceEvents ?? trace, placeTrace));
      }
    }
    return reports;
  } finally {
    await browser.close();
    close();
  }
}

// ---- Run ---------------------------------------------------------------------------------------------
// Two builds alternate in blocks (A B A B), so a drift in the machine falls on both.
const runs = builds.map(() => ({}));
const blocks = ab ? 2 : 1;
for (let b = 0; b < blocks; b++)
  for (let v = 0; v < builds.length; v++) {
    process.stdout.write(`  ${relative(root, builds[v])}, block ${b + 1}: ${Math.ceil(N / blocks)} cycles\n`);
    const r = await block(builds[v], Math.ceil(N / blocks), process.env.INJECT_ONLY === 'b' && v === 0 ? null : process.env.INJECT);
    for (const [step, list] of Object.entries(r)) (runs[v][step] ??= []).push(...list);
  }

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
/** Two-sided permutation test on the difference of means. */
const pValue = (a, b, rounds = 20000) => {
  const all = [...a, ...b];
  const d0 = Math.abs(mean(a) - mean(b));
  let hits = 0;
  for (let r = 0; r < rounds; r++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    if (Math.abs(mean(all.slice(0, a.length)) - mean(all.slice(a.length))) >= d0 - 1e-9) hits++;
  }
  return hits / rounds;
};
const causes = (list) => {
  const c = {};
  for (const r of list) for (const [k, v] of Object.entries(r.causes)) c[k] = (c[k] ?? 0) + v;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
};

/** The main thread's time in late frames, a step on average: by kind, and the scripts that took most. */
const blamed = (list) => {
  const k = {};
  const w = {};
  for (const r of list) {
    for (const [x, ms] of Object.entries(r.blame?.kinds ?? {})) k[x] = (k[x] ?? 0) + ms / list.length;
    for (const [x, ms] of Object.entries(r.blame?.where ?? {})) w[x] = (w[x] ?? 0) + ms / list.length;
  }
  const top = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([x, ms]) => `${x} ${ms.toFixed(1)}`).join('; ');
  return Object.entries(k).map(([x, ms]) => `${x} ${ms.toFixed(1)}`).join(', ') + ' ms' + (top ? ` (scripts: ${top})` : '');
};

console.log(`\n${CYCLE}, ${N} cycles per build${THROTTLE > 1 ? `, CPU ${THROTTLE}x slower` : ''}${process.env.INJECT ? `, INJECT=${process.env.INJECT}` : ''}. Late frames per step (dropped or shown in part, that hurt smoothness):\n`);
for (const step of Object.keys(runs[0])) {
  runs.forEach((r, v) => {
    const late = r[step].map((x) => x.late);
    console.log(`  ${step.padEnd(6)} ${relative(root, builds[v]).padEnd(28)} median ${String(median(late)).padStart(4)}  mean ${mean(late).toFixed(1).padStart(5)}  [${late.join(' ')}]  of ~${Math.round(mean(r[step].map((x) => x.frames)))} frames  by: ${causes(r[step])}`);
    if (WHY) console.log(`  ${''.padEnd(6)} ${''.padEnd(28)} main thread in late frames, a step: ${blamed(r[step])}`);
  });
  if (runs.length === 2) {
    const [a, b] = runs.map((r) => r[step].map((x) => x.late));
    const p = pValue(a, b);
    console.log(`  ${''.padEnd(6)} difference ${(mean(b) - mean(a)).toFixed(1)} late frames a step, p = ${p.toFixed(3)}${p < 0.05 ? ' (real)' : ' (not distinguishable from noise)'}\n`);
  }
}
const tag = arg('tag', `${CYCLE}-${Date.now()}`);
writeFileSync(join(outDir, `drops-${tag}.json`), JSON.stringify({ cycle: CYCLE, n: N, throttle: THROTTLE, inject: process.env.INJECT ?? null, builds: builds.map((b) => relative(root, b)), runs }, null, 1));
console.log(`written: ${relative(root, join(outDir, `drops-${tag}.json`))}`);
