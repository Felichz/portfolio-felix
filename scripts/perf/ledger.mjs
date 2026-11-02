// The work ledger: what each interaction costs the page, counted instead of timed. Frame rates move
// with the machine's load and need medians of runs; the work behind them (styles recalculated, layout
// objects walked, paints, script, timers and frames asked for) doesn't depend on the load: scenes at
// rest or under a steady hand count the same run after run, and those that load something vary only
// with when it arrives (--repeat 3, and the comparison takes each count's least). Each scene is traced
// (Chrome's own timeline) and CPU-profiled, and the script is mapped back to src/ through the build's
// source maps.
//
//   SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps   # once per change: a build with maps
//   node scripts/perf/ledger.mjs [--tag name] [--scenes load,idle-work,...] [--repeat 2]
//   node scripts/perf/ledger.mjs --compare out/ledger-a.json out/ledger-b.json
//   node scripts/perf/ledger.mjs --check [out/ledger-x.json]   # the rules in invariants.mjs; exits 1 on a break
//
// It serves that build itself, on [::1] (stages in the page's process, as deployed). DIST picks another
// build; ID the product the scenes use (knowgraph). Chrome runs off screen (SHOW=1 to see it).
// Output: a table per scene, the hottest functions and files, forced layouts with the function that
// forced them, who asks for frames and timers; scripts/perf/out/ledger-<tag>.json for --compare.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hand, launch, placer, serve, sleep } from './kit.mjs';
import { INVARIANTS } from './invariants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

// ---- Check the invariants -------------------------------------------------------------------------
const checking = process.argv.includes('--check');
/** Each rule against a ledger's runs: prints a line per rule, returns whether all held. */
function check(ledger) {
  const sum = (rows, kind, where) => Object.entries(rows).reduce((n, [k, v]) => {
    const space = k.indexOf(' ');
    return (!kind || k.slice(0, space) === kind) && (!where || where.test(k.slice(space + 1))) ? n + v : n;
  }, 0);
  let ok = true;
  console.log(`invariants, ${ledger.tag} (${ledger.runs} runs, each count's least)\n`);
  for (const rule of INVARIANTS) {
    const runs = ledger.each?.[rule.scene];
    if (!runs) {
      console.log(`  ----  ${rule.scene.padEnd(13)} ${rule.says} (scene not run)`);
      continue;
    }
    const got = Math.min(...runs.map((r) => rule.count({ ...r, asked: (kind, where) => sum(r.askers, kind, where), forced: (kind, where) => sum(r.forcedBy, kind, where) })));
    const held = got <= rule.max;
    ok &&= held;
    console.log(`  ${held ? 'ok  ' : 'FAIL'}  ${rule.scene.padEnd(13)} ${rule.says}: ${fmt(got)} (at most ${rule.max})`);
  }
  if (ledger.errors?.length) {
    ok = false;
    console.log(`  FAIL  page errors: ${ledger.errors.join(' | ')}`);
  }
  console.log(ok ? '\nall hold' : '\nbroken: see FAIL above. Who asks and who forces is in the full ledger (run it without --check).');
  return ok;
}
const saved = checking ? process.argv[process.argv.indexOf('--check') + 1] : undefined;
if (saved?.endsWith('.json')) process.exit(check(JSON.parse(readFileSync(resolve(saved), 'utf8'))) ? 0 : 1);

// ---- Compare two ledgers ---------------------------------------------------------------------------
if (process.argv.includes('--compare')) {
  const [a, b] = process.argv.slice(process.argv.indexOf('--compare') + 1).map((f) => JSON.parse(readFileSync(resolve(f), 'utf8')));
  const keys = ['scriptMs', 'styleMs', 'layoutMs', 'paintMs', 'styleElements', 'layoutObjects', 'paints', 'forced', 'rafs', 'timers', 'frames'];
  console.log(`${a.tag} (${a.runs ?? 1} runs) -> ${b.tag} (${b.runs ?? 1} runs), each count's least over its runs\n`);
  console.log('scene'.padEnd(14) + keys.map((k) => k.padStart(15)).join(''));
  for (const s of Object.keys(b.scenes)) {
    if (!a.scenes[s]) continue;
    const row = keys.map((k) => {
      const x = a.least?.[s]?.[k] ?? a.scenes[s].totals[k];
      const y = b.least?.[s]?.[k] ?? b.scenes[s].totals[k];
      const d = y - x;
      const pct = x ? Math.round((d / x) * 100) : d ? Infinity : 0;
      return `${fmt(x)}>${fmt(y)}${Math.abs(pct) >= 10 && Math.abs(d) > 1 ? (pct > 0 ? '+' : '-') : ' '}`.padStart(15);
    });
    console.log(s.padEnd(14) + row.join(''));
  }
  console.log('\n(+/-: a change of 10% or more)');
  process.exit(0);
}
function fmt(n) {
  return n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

// ---- The build, served -----------------------------------------------------------------------------
const dist = resolve(root, process.env.DIST ?? 'scripts/perf/out/dist-maps');
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build at ${relative(root, dist)}. Make one with source maps first:\n  SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps`);
  process.exit(1);
}
const { base: BASE, close: closeServer } = await serve(dist);

// ---- Source maps: built script positions back to src/ -------------------------------------------------
const { place, placeTrace } = placer(dist, BASE);

// ---- Chrome ------------------------------------------------------------------------------------------
const browser = await launch('ledger');
const [page] = await browser.pages();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

const ID = process.env.ID ?? 'knowgraph';
const { plateBox, isLive, wiggle, goLive, clickZoom, activeHref, windowOpen, theme, deckTop } = hand(page);

// Each scene: what it does, whether the setup before it is part of the scene, and `did`, which says
// whether it did what it says (null) or what went wrong. A scene works on the state the one before
// left, so one that silently did nothing (a key that went to the app, a window that never opened)
// would count a different interaction: that run fails instead.
let mark;
const SCENES = {
  load: { run: async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(2000);
  } },
  'to-work': { run: async () => {
    // Off the plate: the preview goes live in hover-live, never on its way here.
    await page.mouse.move(40, 900, { steps: 5 });
    await page.evaluate(() => {
      location.hash = '#work/' + window.__ledgerId;
      // The showcase stays on the product the scenes ask for: advancing on its own, which one is on
      // screen (a YouTube player, or not) would depend on how long each scene took.
      const auto = document.querySelector('[data-auto]');
      if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
    });
    await sleep(2500);
  }, did: async () => ((await activeHref()).includes(ID) ? null : `the showcase is on ${await activeHref()}`) },
  'idle-work': { run: () => sleep(3000) },
  'hover-live': { run: async () => {
    await goLive();
    await sleep(300);
  }, did: async () => ((await isLive()) ? null : 'the preview never went live') },
  use: { run: async () => wiggle(await plateBox(), 1500), did: async () => ((await isLive()) ? null : 'the preview is not live') },
  'next-product': { run: async () => {
    mark = await activeHref();
    await page.evaluate(() => {
      const go = [...document.querySelectorAll('[data-go]')];
      const i = go.findIndex((b) => b.getAttribute('aria-current') === 'true' || b.closest('[aria-current="true"]'));
      go[(i + 1) % go.length]?.click();
    });
    await page.mouse.move(1530, 770, { steps: 3 });
    await sleep(2500);
  }, did: async () => ((await activeHref()) !== mark ? null : 'the showcase stayed on the same product') },
  theme: { run: async () => {
    mark = await theme();
    await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
    await sleep(1500);
  }, did: async () => ((await theme()) !== mark ? null : 'the theme did not change') },
  'open-window': {
    before: async () => {
      await page.evaluate(() => (location.hash = '#work/' + window.__ledgerId));
      await sleep(1500);
      await goLive();
    },
    run: async () => {
      await clickZoom();
      await sleep(1500);
    },
    did: async () => ((await windowOpen()) ? null : 'the window did not open'),
  },
  'close-window': { run: async () => {
    await page.keyboard.press('Escape');
    await sleep(1500);
  }, did: async () => ((await windowOpen()) ? 'the window is still open' : null) },
  scroll: {
    // The keys go to the page, not to the app the window left focused.
    before: () => page.evaluate(() => document.activeElement?.blur()),
    run: async () => {
      await page.mouse.move(80, 500);
      const top = await deckTop();
      await page.keyboard.press('ArrowDown');
      await sleep(1500);
      mark = (await deckTop()) > top ? null : 'the deck did not move down';
      await page.keyboard.press('ArrowUp');
      await sleep(1500);
      mark ??= Math.abs((await deckTop()) - top) < 2 ? null : 'the deck did not come back';
    },
    did: () => mark,
  },
  'idle-live': { run: async () => {
    await page.mouse.move(1590, 1000);
    await sleep(3000);
  } },
};
const chosen = (arg('scenes') ?? Object.keys(SCENES).join(',')).split(',');
await page.evaluateOnNewDocument((id) => (window.__ledgerId = id), ID);

const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'v8.execute',
];

/** One scene: its trace and CPU profile, reduced to the ledger. */
async function measure(name) {
  const scene = SCENES[name];
  if (scene.before) await scene.before();
  const tracePath = join(outDir, `ledger-trace-${name}.json`);
  await page.tracing.start({ path: tracePath, categories: CATEGORIES });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await scene.run();
  const wall = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const trace = JSON.parse(Buffer.from(await page.tracing.stop()).toString());
  const failed = await scene.did?.();
  if (failed) throw new Error(`scene ${name}: ${failed}`);
  return { wall, ...reduceTrace(trace.traceEvents ?? trace), profile: reduceProfile(profile) };
}

// ---- The trace, reduced ----------------------------------------------------------------------------
function reduceTrace(events) {
  // The page's renderer main thread (its stages and apps share it, served from its origin). A frame
  // from elsewhere (the YouTube player inside PlaySync) runs in a process of its own and isn't
  // counted: it costs the page nothing, and whether it is still running varies from run to run.
  const ours = new Set(events.flatMap((e) => (e.name === 'TracingStartedInBrowser' ? e.args.data.frames ?? [] : e.name === 'FrameCommittedInBrowser' ? [e.args.data] : [])).filter((f) => f?.url?.startsWith(BASE)).map((f) => f.processId));
  const mains = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && (!ours.size || ours.has(e.pid))).map((e) => `${e.pid}:${e.tid}`));
  // Which document each frame id is.
  const frames = new Map();
  for (const e of events) {
    const d = e.args?.data;
    if (e.name === 'TracingStartedInBrowser') for (const f of d?.frames ?? []) frames.set(f.frame, f.url);
    if ((e.name === 'FrameCommittedInBrowser' || e.name === 'CommitLoad') && d?.frame && d?.url) frames.set(d.frame, d.url);
  }
  const doc = (frame) => {
    const url = frames.get(frame) ?? '';
    const stage = url.match(/\/stage\/#?([\w-]+)?/);
    if (stage) return `stage:${url.split('#')[1] ?? '?'}`;
    const app = url.match(/\/apps\/([^/]+)\//);
    if (app) return `app:${app[1]}`;
    return url ? 'page' : 'unattributed';
  };

  const totals = { scriptMs: 0, styleMs: 0, layoutMs: 0, paintMs: 0, gcMs: 0, busyMs: 0, styleElements: 0, layoutObjects: 0, styles: 0, layouts: 0, paints: 0, paintArea: 0, forced: 0, rafs: 0, timers: 0, frames: 0 };
  const byDoc = {};
  const docRow = (k) => (byDoc[k] ??= { scriptMs: 0, styleElements: 0, layoutObjects: 0, paints: 0, rafs: 0, timers: 0 });
  const forced = {};
  const askers = {};
  const SCRIPT = new Set(['FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'EvaluateScript', 'v8.compile', 'FireIdleCallback', 'RunMicrotasks', 'v8.callFunction']);
  const topOf = (stack) => stack?.[0];
  const ask = (kind, e) => {
    const s = topOf(e.args?.data?.stackTrace);
    const key = `${kind} ${s ? placeTrace(s).where : doc(e.args?.data?.frame)}`;
    askers[key] = (askers[key] ?? 0) + 1;
  };

  const byThread = new Map();
  for (const e of events) {
    if (!mains.has(`${e.pid}:${e.tid}`)) continue;
    if (e.name === 'RequestAnimationFrame') {
      totals.rafs++;
      docRow(doc(e.args?.data?.frame)).rafs++;
      ask('rAF', e);
    } else if (e.name === 'TimerInstall') {
      totals.timers++;
      docRow(doc(e.args?.data?.frame)).timers++;
      ask('timer', e);
    }
    if (e.ph !== 'X') continue;
    let list = byThread.get(`${e.pid}:${e.tid}`);
    if (!list) byThread.set(`${e.pid}:${e.tid}`, (list = []));
    list.push(e);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack = [];
    for (const e of list) {
      while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
      const ms = (e.dur ?? 0) / 1000;
      const inScript = stack.find((s) => SCRIPT.has(s.name));
      if (e.name === 'RunTask' && !stack.length) totals.busyMs += ms;
      if (SCRIPT.has(e.name) && !inScript) {
        totals.scriptMs += ms;
        docRow(doc(e.args?.data?.frame)).scriptMs += ms;
      }
      if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') {
        const n = e.args?.elementCount ?? e.args?.data?.elementCount ?? 0;
        totals.styleMs += ms;
        totals.styles++;
        totals.styleElements += n;
        docRow(doc(e.args?.beginData?.frame)).styleElements += n;
      }
      if (e.name === 'Layout') {
        const n = e.args?.beginData?.dirtyObjects ?? 0;
        totals.layoutMs += ms;
        totals.layouts++;
        totals.layoutObjects += n;
        docRow(doc(e.args?.beginData?.frame)).layoutObjects += n;
      }
      if ((e.name === 'UpdateLayoutTree' || e.name === 'Layout') && inScript) {
        // Style or layout run synchronously inside script: a read that forced it. Attributed to the
        // innermost script with a location.
        totals.forced++;
        const s = [...stack].reverse().find((x) => SCRIPT.has(x.name) && (x.args?.data?.url || x.args?.data?.stackTrace));
        const d = s?.args?.data;
        const top = topOf(e.args?.beginData?.stackTrace);
        const where = top ? placeTrace(top).where : d?.url ? placeTrace(d).where : doc(d?.frame);
        const k = `${e.name === 'Layout' ? 'layout' : 'style'} ${where}`;
        forced[k] = (forced[k] ?? 0) + 1;
      }
      if (e.name === 'Paint' || e.name === 'PrePaint' || e.name === 'Layerize' || e.name === 'PaintImage' || e.name === 'Rasterize') totals.paintMs += ms;
      if (e.name === 'Paint') {
        totals.paints++;
        docRow(doc(e.args?.data?.frame)).paints++;
        const q = e.args?.data?.clip;
        if (q?.length === 8) totals.paintArea += Math.abs((q[2] - q[0]) * (q[5] - q[1]));
      }
      if (/^(MajorGC|MinorGC|V8\.GC)/.test(e.name)) totals.gcMs += ms;
      stack.push(e);
    }
  }
  // Frames the page actually produced (its compositor's draws).
  totals.frames = events.filter((e) => e.name === 'DrawFrame' || (e.name === 'Graphics.Pipeline' && e.args?.step === 'SubmitCompositorFrame')).length || events.filter((e) => e.name === 'BeginFrame').length;
  totals.paintArea = Math.round(totals.paintArea / 1e3); // thousands of px²
  return { totals, byDoc, forced, askers };
}

// ---- The CPU profile, reduced ------------------------------------------------------------------------
function reduceProfile(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const caller = (id) => {
    for (let p = parent.get(id); p !== undefined; p = parent.get(p)) {
      const f = nodes.get(p).callFrame;
      if (f.url) return place(f.url, f.lineNumber, f.columnNumber, f.functionName);
    }
    return null;
  };
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? profile.timeDeltas[i] ?? 0) / 1000;
    self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + dt);
  }
  const fns = {};
  const files = {};
  for (const [id, ms] of self) {
    const { callFrame: f } = nodes.get(id);
    if (['(idle)', '(program)', '(root)'].includes(f.functionName)) continue;
    let p;
    if (f.functionName === '(garbage collector)') p = { file: '(gc)', where: '(gc)' };
    else if (!f.url) {
      const c = caller(id);
      p = c ? { file: c.file, where: `${f.functionName || '(native)'} <- ${c.where}` } : { file: '(native)', where: f.functionName || '(native)' };
    } else p = place(f.url, f.lineNumber, f.columnNumber, f.functionName);
    fns[p.where] = (fns[p.where] ?? 0) + ms;
    files[p.file] = (files[p.file] ?? 0) + ms;
  }
  return { fns, files };
}

// ---- Run ---------------------------------------------------------------------------------------------
const repeat = Number(arg('repeat', checking ? 2 : 1));
const runs = [];
for (let r = 0; r < repeat; r++) {
  const scenes = {};
  if (r > 0) await page.goto('about:blank');
  for (const name of chosen) {
    process.stdout.write(`  ${name}${repeat > 1 ? ` (run ${r + 1})` : ''}\n`);
    // A scene that waits on the page forever (seen once in a long --repeat) fails instead of hanging.
    let late;
    scenes[name] = await Promise.race([measure(name), new Promise((_, no) => (late = setTimeout(() => no(new Error(`scene ${name} took over 40 s`)), 40000)))]);
    clearTimeout(late);
  }
  runs.push(scenes);
}
await browser.close();
closeServer();

// The ledger is the first run; further runs only say how much each count moved between runs.
// Each count's least over the runs: the work the scene can't do without, where a slow load or a late
// boot only ever adds.
const least = {};
for (const name of Object.keys(runs[0])) {
  least[name] = {};
  for (const k of Object.keys(runs[0][name].totals)) least[name][k] = Math.min(...runs.map((r) => r[name].totals[k]));
}
const each = Object.fromEntries(Object.keys(runs[0]).map((name) => [name, runs.map((r) => ({ ...r[name].totals, askers: r[name].askers, forcedBy: r[name].forced }))]));
const ledger = { tag: arg('tag', checking ? 'check' : new Date().toISOString().slice(0, 16)), id: ID, build: relative(root, dist), runs: runs.length, least, each, scenes: runs[0], errors };
writeFileSync(join(outDir, `ledger-${ledger.tag}.json`), JSON.stringify(ledger, null, 1));
if (checking) process.exit(check(ledger) ? 0 : 1);

const cols = ['busyMs', 'scriptMs', 'styleMs', 'layoutMs', 'paintMs', 'styleElements', 'layoutObjects', 'paints', 'forced', 'rafs', 'timers', 'frames'];
console.log('\nper scene (counts are work, ms is this machine)');
console.log('scene'.padEnd(14) + 'wall'.padStart(6) + cols.map((c) => c.replace(/Ms$/, ' ms').padStart(13)).join(''));
for (const [name, s] of Object.entries(runs[0])) {
  console.log(name.padEnd(14) + String(s.wall).padStart(6) + cols.map((c) => fmt(s.totals[c]).padStart(13)).join(''));
  for (let r = 1; r < runs.length; r++) console.log(`  run ${r + 1}`.padEnd(20) + cols.map((c) => fmt(runs[r][name].totals[c]).padStart(13)).join(''));
}

const sum = (pick) => {
  const acc = {};
  for (const s of Object.values(runs[0])) for (const [k, v] of Object.entries(pick(s))) acc[k] = (acc[k] ?? 0) + (typeof v === 'number' ? v : 0);
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
};
const show = (title, rows, n = 15, unit = '') => {
  console.log(`\n${title}`);
  for (const [k, v] of rows.slice(0, n)) console.log(`  ${fmt(v).padStart(8)}${unit}  ${k}`);
};
show('hottest functions, self time over all scenes (CPU profile)', sum((s) => s.profile.fns), 20, ' ms');
show('hottest files', sum((s) => s.profile.files), 12, ' ms');
show('forced style and layout (a read inside script made the browser do it now)', sum((s) => s.forced), 15, 'x');
show('who asks for frames and timers', sum((s) => s.askers), 15, 'x');
console.log('\nby document (all scenes)');
const docs = {};
for (const s of Object.values(runs[0])) for (const [d, row] of Object.entries(s.byDoc)) for (const [k, v] of Object.entries(row)) ((docs[d] ??= {})[k] = (docs[d][k] ?? 0) + v);
for (const [d, row] of Object.entries(docs).sort((a, b) => b[1].scriptMs - a[1].scriptMs)) console.log(`  ${d.padEnd(18)} ${Object.entries(row).map(([k, v]) => `${k} ${fmt(v)}`).join('  ')}`);
if (errors.length) console.log('\npage errors:', errors.join(' | '));
console.log(`\nwritten: ${relative(root, join(outDir, `ledger-${ledger.tag}.json`))}`);
