// Freezes, one by one. A count of late frames says how often the page stutters; a freeze of 80 ms is
// what a visitor feels, and each has its own cause. This finds every freeze in the steps of a cycle and
// writes a dossier for each: what was on screen (Chrome's compositor reports each frame it meant to
// show: shown, shown without the main thread's update, or dropped), and everything that ran in the
// freeze's window, at the level it ran at:
//   - the pipeline stage that held the frames (main thread, compositor, raster, GPU, presentation);
//   - the page's main thread: each task over the window, split into script (by source line, through
//     the build's source maps), style (elements, and what invalidated them), layout (objects, and who
//     forced it), paint, garbage collection, parsing; and V8's own CPU samples in the window, by
//     function;
//   - other processes: a frame from another site (its main thread, and whether the display compositor
//     waited for its surface), the GPU process (shader compiles, raster, composition, video);
//   - the page's own marks around it (live:<app>:<stage>, live:mount:...).
// Then a verdict for each freeze, and the freezes grouped by cause across repetitions: what comes back
// every time, apart from what happened once.
//
//   SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps
//   node scripts/perf/freezes.mjs [--cycles window,product,scroll,theme,live] [--n 3] [--throttle 4] [--min 30]
//
// ID picks the product (knowgraph); DIST another build (one with maps names src/ lines). --min is the
// shortest freeze reported, in ms. --light leaves out style invalidation tracking (it costs the page
// something; the counts are the same either way, the times a little higher with it). Each step whose
// trace holds a freeze is saved to scripts/perf/out/freezes/, to open in DevTools' Performance panel at
// the time the dossier gives. Runs in warm profiles, like drops.mjs (--cold for fresh ones).
// INJECT=freeze:<ms> blocks the main thread that long, 200 ms into each step, in a function named
// injectedFreeze: a known freeze, to check that the dossier finds it and names it.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrive, cycles, hand, launch, placer, serve, sleep } from './kit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(here, 'out');
const keepDir = join(outDir, 'freezes');
mkdirSync(keepDir, { recursive: true });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const ID = process.env.ID ?? 'knowgraph';
const N = Number(arg('n', 3));
const THROTTLE = Number(arg('throttle', 1));
const MIN = Number(arg('min', 30));
const LIGHT = process.argv.includes('--light');
const COLD = process.argv.includes('--cold');
const CHOSEN = arg('cycles', 'window,product,scroll,theme').split(',');
const dist = resolve(root, process.env.DIST ?? (existsSync(join(root, 'scripts/perf/out/dist-maps/index.html')) ? 'scripts/perf/out/dist-maps' : 'dist'));

const CATEGORIES = [
  'cc',
  'benchmark',
  'viz',
  'gpu',
  'toplevel',
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-v8.cpu_profiler',
  'v8.execute',
  'v8',
  ...(LIGHT ? [] : ['disabled-by-default-devtools.timeline.invalidationTracking']),
];

// ---- Reading a trace ---------------------------------------------------------------------------------
const STAGE = {
  BeginImplFrameToSendBeginMainFrame: 'main thread busy (the next frame could not start)',
  SendBeginMainFrameToCommit: 'main thread (producing the frame)',
  Commit: 'main thread (commit)',
  EndCommitToActivation: 'raster (before activation)',
  Activation: 'raster (activation)',
  EndActivateToSubmitCompositorFrame: 'compositor',
  SubmitCompositorFrameToPresentationCompositorFrame: 'GPU / display compositor',
  SubmitToReceiveCompositorFrame: 'GPU / display compositor',
  ReceiveCompositorFrameToStartDraw: 'GPU / display compositor',
  StartDrawToSwapStart: 'GPU (drawing)',
  Swap: 'GPU (swap)',
  SwapEndToPresentationCompositorFrame: 'presentation',
};
const SCRIPT = new Set(['FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'EvaluateScript', 'v8.evaluateModule', 'FireIdleCallback', 'RunMicrotasks', 'v8.callFunction', 'v8.run']);
const KIND = (name) =>
  SCRIPT.has(name) ? 'script'
  : name === 'UpdateLayoutTree' ? 'style'
  : name === 'Layout' ? 'layout'
  : /^(Paint|PrePaint|Layerize|PaintImage|RasterTask|Decode Image|Commit|UpdateLayer)$/.test(name) ? 'paint'
  : /^(MinorGC|MajorGC|V8\.GC|BlinkGC|ThreadState::)/.test(name) ? 'gc'
  : /^(ParseHTML|ParseAuthorStyleSheet|v8\.compile|v8\.parseOnBackground|v8\.compileModule|CompileScript)$/.test(name) ? 'parse'
  : null;

function analyze(events, mainFrame, placeTrace, vsync) {
  const meta = (name) => events.filter((e) => e.ph === 'M' && e.name === name);
  const threadName = new Map(meta('thread_name').map((e) => [`${e.pid}:${e.tid}`, e.args.name]));
  const processName = new Map(meta('process_name').map((e) => [e.pid, e.args.name]));
  const pagePid = events.find((e) => (e.args?.data?.frame ?? e.args?.beginData?.frame) === mainFrame)?.pid;
  if (pagePid === undefined) throw new Error("no event in the trace names the page's main frame");
  const tidOf = (pid, name) => [...threadName].find(([k, v]) => k.startsWith(`${pid}:`) && v === name)?.[0];
  const pageMain = tidOf(pagePid, 'CrRendererMain');
  const gpuPid = [...processName].find(([, v]) => v === 'GPU Process')?.[0];
  const gpuMain = gpuPid !== undefined ? tidOf(gpuPid, 'CrGpuMain') : null;
  // Which document each frame id is, and which process.
  const docs = new Map();
  for (const e of events) {
    const d = e.args?.data;
    if (e.name === 'TracingStartedInBrowser') for (const f of d?.frames ?? []) docs.set(f.frame, { url: f.url, pid: f.processId, parent: f.parent });
    if (e.name === 'FrameCommittedInBrowser' && d?.frame) docs.set(d.frame, { url: d.url, pid: d.processId, parent: d.parent });
  }
  const docName = (f) => {
    if (f === mainFrame) return 'page';
    const u = docs.get(f)?.url ?? '';
    if (!u) return '?';
    const url = new URL(u, 'http://x');
    return url.origin.includes('[::1]') || url.origin === 'http://x' ? url.pathname.replace(/\/$/, '') || '/' : url.host;
  };

  // The page's frames, as its compositor reported them.
  const open = new Map();
  const spans = [];
  for (const e of events.filter((e) => (e.ph === 'b' || e.ph === 'e') && e.pid === pagePid && e.cat?.includes('benchmark')).sort((a, b) => a.ts - b.ts)) {
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
  const stagesOf = new Map();
  for (const s of spans) if (s.name !== 'PipelineReporter') (stagesOf.get(s.id) ?? stagesOf.set(s.id, []).get(s.id)).push(s);
  const frames = spans
    .filter((s) => s.name === 'PipelineReporter' && s.args?.frame_reporter)
    .map((s) => {
      const fr = s.args.frame_reporter;
      let worst = null;
      for (const st of stagesOf.get(s.id) ?? []) if (st.ts >= s.ts && st.end <= s.end && STAGE[st.name] && (!worst || st.end - st.ts > worst.end - worst.ts)) worst = st;
      const bad = fr.affects_smoothness && fr.state !== 'STATE_PRESENTED_ALL';
      return { ts: s.ts, end: s.end, state: fr.state, bad, stage: bad ? (fr.state === 'STATE_DROPPED' ? (worst ? STAGE[worst.name] : 'unknown') : "main thread (its update missed the frame; the compositor drew without it)") : null };
    })
    .sort((a, b) => a.ts - b.ts);
  // The step's own frames: from the mark it left as it acted.
  const act = events.find((e) => e.name === 'perf:act' && e.pid === pagePid)?.ts ?? -Infinity;
  frames.splice(0, frames.length, ...frames.filter((f) => f.ts >= act));
  if (!frames.length) return { freezes: [], frames: 0 };
  const t0 = frames[0].ts;

  // Freezes: runs of late frames, each next one within a frame and a half of the last.
  const runs = [];
  for (const f of frames) {
    const last = runs.at(-1);
    if (!f.bad) continue;
    if (last && f.ts - last.frames.at(-1).ts <= vsync * 1500) last.frames.push(f);
    else runs.push({ frames: [f] });
  }
  const freezes = [];
  for (const r of runs) {
    const a = r.frames[0].ts;
    const b = Math.max(...r.frames.map((f) => f.end));
    const visible = r.frames.length * vsync; // the time the screen didn't move on, in vsyncs
    if (visible < MIN) continue;
    freezes.push(dossier(a, b, r.frames));
  }
  return { freezes, frames: frames.length };

  function dossier(a, b, run) {
    const overlap = (e) => Math.max(0, Math.min(b, e.ts + (e.dur ?? 0)) - Math.max(a, e.ts)) / 1000;
    const out = {
      at: Math.round((a - t0) / 1000),
      ms: Math.round(run.length * vsync),
      frames: run.length,
      dropped: run.filter((f) => f.state === 'STATE_DROPPED').length,
      partial: run.filter((f) => f.state !== 'STATE_DROPPED').length,
      stages: count(run.map((f) => f.stage)),
    };

    // The page's main thread: its tasks over the window, broken down.
    const main = events.filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === pageMain).sort((x, y) => x.ts - y.ts || y.dur - x.dur);
    const tasks = main.filter((e) => e.name === 'RunTask' && e.ts < b && e.ts + e.dur > a);
    out.main = { busy: Math.round(tasks.reduce((s, t) => s + overlap(t), 0)), tasks: [] };
    for (const t of tasks.sort((x, y) => y.dur - x.dur).slice(0, 4)) {
      const inner = main.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur);
      const kinds = { script: 0, style: 0, layout: 0, paint: 0, gc: 0, parse: 0 };
      const detail = [];
      const stack = [];
      for (const e of inner) {
        while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
        const k = KIND(e.name);
        const inScript = stack.some((s) => SCRIPT.has(s.name));
        const nested = stack.some((s) => KIND(s.name) === k);
        if (k && !nested) {
          const ms = e.dur / 1000;
          kinds[k] += ms;
          // Work a script made happen is the script's time already: shown, not added twice.
          if (k !== 'script' && inScript) kinds.script -= ms;
          if (ms >= 1) {
            const d = e.args?.data ?? {};
            const bd = e.args?.beginData ?? {};
            const src = d.stackTrace?.[0] ?? bd.stackTrace?.[0] ?? (d.url ? d : null);
            // (Code the measuring script ran in the page, a click it made, is not the page's: skipped.)
            const own = (u) => u && !u.startsWith('pptr:');
            let where = own(src?.url) ? placeTrace(src).where : null;
            // A timer, a frame callback or an event has no location of its own: the first of the page's
            // functions under it does.
            if (!where && k === 'script') {
              const fn = inner.find((x) => x.ts >= e.ts && x.ts + x.dur <= e.ts + e.dur && (own(x.args?.data?.url) || (!x.args?.data?.url && x.args?.data?.functionName)));
              const fd = fn?.args?.data;
              where = fd?.url ? placeTrace(fd).where : fd?.functionName || null;
            }
            const doc = docName(d.frame ?? bd.frame);
            const what =
              k === 'style' ? `${e.args?.elementCount ?? '?'} elements`
              : k === 'layout' ? `${bd.dirtyObjects ?? '?'} of ${bd.totalObjects ?? '?'} objects`
              : k === 'script' ? e.name
              : e.name;
            detail.push({ ms: +ms.toFixed(1), kind: k, what, doc, where, forced: k !== 'script' && inScript ? true : undefined });
          }
        }
        stack.push(e);
      }
      out.main.tasks.push({
        at: Math.round((t.ts - t0) / 1000),
        ms: Math.round(t.dur / 1000),
        kinds: Object.fromEntries(Object.entries(kinds).filter(([, v]) => v >= 0.5).map(([k, v]) => [k, Math.round(v)])),
        detail: detail.sort((x, y) => y.ms - x.ms).slice(0, 8),
      });
    }

    // V8's own samples in the window, on the page's main thread: what JavaScript really ran.
    const js = samples(a, b);
    out.js = js.self;
    out.jsBy = js.by;

    // What invalidated style or layout in the window.
    const inv = {};
    for (const e of events) {
      if (!/InvalidationTracking$/.test(e.name) || e.ts < a - vsync * 1000 || e.ts > b || e.pid !== pagePid) continue;
      const d = e.args?.data ?? {};
      const k = `${e.name.startsWith('Layout') ? 'layout' : 'style'}: ${d.nodeName ?? '?'} (${d.reason ?? (d.invalidationList ?? []).map((x) => x.classes?.join('.') ?? x.id ?? x.attribute ?? '').join(',')})${d.frame ? ' in ' + docName(d.frame) : ''}`;
      inv[k] = (inv[k] ?? 0) + 1;
    }
    out.invalidations = Object.entries(inv).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, n]) => `${n}x ${k}`);

    // Other processes: renderers of other sites, and whether the display compositor waited on them.
    out.others = [];
    for (const [key, name] of threadName) {
      if (name !== 'CrRendererMain') continue;
      const pid = Number(key.split(':')[0]);
      if (pid === pagePid) continue;
      const busy = events.filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === key && e.name === 'RunTask').reduce((s, e) => s + overlap(e), 0);
      if (busy < 4) continue;
      const scripts = {};
      for (const e of events) if (e.ph === 'X' && `${e.pid}:${e.tid}` === key && SCRIPT.has(e.name) && overlap(e) > 0 && e.args?.data?.url) scripts[e.args.data.url.replace(/\?.*$/, '').slice(0, 70)] = (scripts[e.args.data.url.replace(/\?.*$/, '').slice(0, 70)] ?? 0) + overlap(e);
      const site = [...docs.values()].find((d) => d.pid === pid)?.url;
      out.others.push({ process: site ? new URL(site).host : `renderer ${pid}`, busy: Math.round(busy), scripts: Object.entries(scripts).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([u, ms]) => `${u} ${Math.round(ms)} ms`) });
    }
    out.waitedOnSurface = events.filter((e) => e.name === 'DisplayDamageTracker::HasPendingSurfaces' && e.ts >= a && e.ts <= b && e.args?.has_pending_surfaces).length;

    // The GPU process's main thread.
    if (gpuMain) {
      const g = events.filter((e) => e.ph === 'X' && `${e.pid}:${e.tid}` === gpuMain);
      const busy = g.filter((e) => e.name === 'RunTask' || e.name === 'Scheduler::RunTask').reduce((s, e) => Math.max(s, 0) + overlap(e), 0);
      const sum = (re) => Math.round(g.filter((e) => re.test(e.name)).reduce((s, e) => s + overlap(e), 0));
      out.gpu = {
        busy: Math.round(g.filter((e) => e.name === 'RunTask').reduce((s, e) => s + overlap(e), 0)) || Math.round(busy),
        shaders: g.filter((e) => e.name === 'GrShaderCache::store' && e.ts >= a && e.ts <= b).length,
        raster: sum(/^RasterDecoderImpl::DoEndRasterCHROMIUM$/),
        composite: sum(/^SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass$/),
        video: sum(/Video|Media|D3D11Video|VideoDecoder/),
      };
    }

    // The page's marks from a little before the freeze to its end.
    out.marks = events
      .filter((e) => e.cat?.includes('blink.user_timing') && e.pid === pagePid && e.ts >= a - 400e3 && e.ts <= b && !/^(navigationStart|fetchStart|requestStart|responseEnd|domLoading|domInteractive|domContentLoaded|domComplete|loadEvent|unloadEvent|redirect|connect|domain|secureConnection)/.test(e.name))
      .map((e) => `${e.name}@${Math.round((e.ts - t0) / 1000)}`)
      .filter((v, i, all) => all.indexOf(v) === i)
      .slice(0, 6);

    out.verdict = verdict(out);
    return out;
  }

  function samples(a, b) {
    // ProfileChunk events carry V8's samples for each thread: nodes as they're first seen, then sample
    // node ids with time deltas.
    const byId = new Map();
    // (The Profile event is on the sampled thread; its chunks are tied to it by id.)
    const prof = events.find((e) => e.name === 'Profile' && `${e.pid}:${e.tid}` === pageMain);
    const chunks = events.filter((e) => e.name === 'ProfileChunk' && prof && e.pid === prof.pid && e.id === prof.id);
    const start = prof?.args?.data?.startTime;
    if (!chunks.length || start === undefined) return { self: [], by: [] };
    let t = start;
    const self = {};
    // Also by the nearest of the code's own functions up the stack (src/, not a library): which
    // component or module the time was spent for, React's own work charged to it.
    const by = {};
    const ownOf = new Map();
    const own = (n) => {
      if (ownOf.has(n.id)) return ownOf.get(n.id);
      let w = null;
      for (let p = n; p && !w; p = byId.get(p.parent)) {
        const c = p.callFrame;
        if (!c?.url) continue;
        const at = placeTrace({ url: c.url, lineNumber: c.lineNumber + 1, columnNumber: c.columnNumber + 1, functionName: c.functionName }).where;
        if (/(^|\s)src\//.test(at)) w = at;
      }
      ownOf.set(n.id, w);
      return w;
    };
    for (const c of chunks.sort((x, y) => x.ts - y.ts)) {
      const p = c.args?.data?.cpuProfile ?? {};
      for (const n of p.nodes ?? []) byId.set(n.id, n);
      const deltas = c.args?.data?.timeDeltas ?? [];
      (p.samples ?? []).forEach((id, i) => {
        t += deltas[i] ?? 0;
        if (t < a || t > b) return;
        const n = byId.get(id);
        const f = n?.callFrame;
        if (!f || ['(idle)', '(program)', '(root)'].includes(f.functionName)) return;
        let where;
        if (f.functionName === '(garbage collector)') where = '(garbage collector)';
        else if (f.url) where = placeTrace({ url: f.url, lineNumber: f.lineNumber + 1, columnNumber: f.columnNumber + 1, functionName: f.functionName }).where;
        else {
          // A native call: charged to its nearest caller with a location.
          let p = n;
          while (p && !p.callFrame?.url) p = byId.get(p.parent);
          const c = p?.callFrame;
          where = `${f.functionName || '(native)'}${c ? ' <- ' + placeTrace({ url: c.url, lineNumber: c.lineNumber + 1, columnNumber: c.columnNumber + 1, functionName: c.functionName }).where : ''}`;
        }
        const ms = (deltas[i + 1] ?? deltas[i] ?? 0) / 1000;
        self[where] = (self[where] ?? 0) + ms;
        const o = own(n);
        if (o) by[o] = (by[o] ?? 0) + ms;
      });
    }
    const top = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([w, ms]) => `${w} ${ms.toFixed(1)} ms`);
    return { self: top(self), by: top(by) };
  }
}

function count(list) {
  const c = {};
  for (const x of list) c[x] = (c[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
}

/** One line: what held this freeze. The largest share of the window wins. */
function verdict(f) {
  const window = f.ms;
  const top = f.main.tasks[0];
  const culprit = (t) => {
    if (!t) return '';
    const d = t.detail[0];
    return d ? `${d.kind} ${d.what}${d.where ? ' at ' + d.where : ''}${d.doc && d.doc !== 'page' ? ' in ' + d.doc : ''}${d.forced ? ' (forced)' : ''}` : Object.entries(t.kinds).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'untraced work';
  };
  const other = f.others.sort((x, y) => y.busy - x.busy)[0];
  if (f.main.busy >= window * 0.5) return `page main thread busy ${f.main.busy} ms: ${culprit(top)}`;
  if (f.waitedOnSurface && other) return `waiting on ${other.process}'s first frame (its main thread busy ${other.busy} ms)`;
  if (f.gpu && f.gpu.busy >= window * 0.5) return `GPU busy ${f.gpu.busy} ms: ${f.gpu.shaders ? `${f.gpu.shaders} shaders compiled, ` : ''}raster ${f.gpu.raster} ms, composite ${f.gpu.composite} ms`;
  if (f.waitedOnSurface) return 'waiting on another frame\'s surface';
  if (f.main.busy >= window * 0.25) return `page main thread partly busy ${f.main.busy} ms: ${culprit(top)}`;
  return `no work held it on the main thread or the GPU (${Object.keys(f.stages)[0]})`;
}

// ---- Run -----------------------------------------------------------------------------------------------
const { base, close } = await serve(dist);
const { placeTrace } = placer(dist, base);
const profile = COLD ? undefined : join(outDir, 'profiles', basename(dist));
const fresh = profile && !existsSync(profile);
const browser = await launch('freezes', { profile });
const all = [];
try {
  const [page] = await browser.pages();
  const cdp = await page.createCDPSession();
  const [kind, ms] = (process.env.INJECT ?? '').split(':');
  if (kind === 'freeze')
    await page.evaluateOnNewDocument((ms) => {
      window.__freeze = () =>
        setTimeout(function injectedFreeze() {
          const t = performance.now();
          while (performance.now() - t < ms);
        }, 200);
    }, Number(ms));
  const hz = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 30 ? requestAnimationFrame(f) : r((n - 1) / ((performance.now() - t0) / 1000))); requestAnimationFrame(f); }));
  const vsync = 1000 / (Math.abs(hz - 60) < 5 ? 60 : Math.abs(hz - 120) < 8 ? 120 : Math.abs(hz - 144) < 8 ? 144 : Math.abs(hz - 240) < 15 ? 240 : 100);
  for (const name of CHOSEN) {
    const make = cycles(ID)[name];
    if (!make) throw new Error(`no cycle ${name}`);
    await arrive(page, base, ID);
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const h = hand(page);
    const cycle = make(h, page, base);
    // A new profile: one cycle first, unmeasured, to fill its caches (the GPU's shaders).
    for (let i = fresh && !all.length ? -1 : 0; i < N; i++) {
      await cycle.ready();
      for (const step of cycle.steps) {
        await sleep(400);
        await page.tracing.start({ categories: CATEGORIES });
        // Starting the trace starts V8's sampling profiler on the page's main thread, a task of its own
        // (25 ms seen): the step acts once it's over, and a mark says where the step begins.
        await sleep(300);
        await page.evaluate(() => performance.mark('perf:act'));
        await step.act();
        if (kind === 'freeze') await page.evaluate(() => window.__freeze());
        await sleep(1500);
        const raw = Buffer.from(await page.tracing.stop());
        const failed = await step.did();
        if (failed) throw new Error(`${name} ${step.name}, repetition ${i + 1}: ${failed}`);
        if (i < 0) continue;
        const trace = JSON.parse(raw.toString());
        const { freezes, frames } = analyze(trace.traceEvents ?? trace, page.mainFrame()._id, placeTrace, vsync);
        const file = join(keepDir, `${name}-${step.name}-${i + 1}.json`);
        if (freezes.length) writeFileSync(file, raw);
        all.push({ cycle: name, step: step.name, rep: i + 1, frames, freezes, trace: freezes.length ? relative(root, file) : null });
        process.stdout.write(`  ${name} ${step.name} ${i + 1}: ${freezes.length ? freezes.map((f) => `${f.ms} ms at +${f.at}`).join(', ') : 'no freeze'}\n`);
      }
    }
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
} finally {
  await browser.close();
  close();
}

// ---- Report ---------------------------------------------------------------------------------------------
console.log(`\nfreezes of ${MIN} ms or more, ${N} repetitions a step${THROTTLE > 1 ? `, CPU ${THROTTLE}x slower` : ''}, ${relative(root, dist)}, ID=${ID}\n`);
for (const s of all) {
  for (const f of s.freezes) {
    console.log(`${s.cycle} ${s.step} #${s.rep}  +${f.at} ms  ${f.ms} ms (${f.frames} frames: ${f.dropped} dropped, ${f.partial} without the main thread's update)`);
    console.log(`  verdict   ${f.verdict}`);
    console.log(`  stages    ${Object.entries(f.stages).map(([k, v]) => `${k} x${v}`).join('; ')}`);
    for (const t of f.main.tasks) {
      console.log(`  task      +${t.at} ms, ${t.ms} ms: ${Object.entries(t.kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      for (const d of t.detail.slice(0, 5)) console.log(`              ${String(d.ms).padStart(5)} ms ${d.kind} ${d.what}${d.doc ? ' [' + d.doc + ']' : ''}${d.where ? ' ' + d.where : ''}${d.forced ? ' (forced)' : ''}`);
    }
    if (f.js.length) console.log(`  js        ${f.js.join('; ')}`);
    if (f.jsBy?.length) console.log(`  js for    ${f.jsBy.join('; ')}`);
    if (f.invalidations.length) console.log(`  invalid.  ${f.invalidations.join('; ')}`);
    if (f.others.length) console.log(`  others    ${f.others.map((o) => `${o.process} busy ${o.busy} ms${o.scripts.length ? ' (' + o.scripts.join(', ') + ')' : ''}`).join('; ')}${f.waitedOnSurface ? `; display waited on a surface ${f.waitedOnSurface}x` : ''}`);
    if (f.gpu) console.log(`  gpu       busy ${f.gpu.busy} ms, shaders compiled ${f.gpu.shaders}, raster ${f.gpu.raster} ms, composite ${f.gpu.composite} ms${f.gpu.video ? `, video ${f.gpu.video} ms` : ''}`);
    if (f.marks.length) console.log(`  marks     ${f.marks.join(', ')}`);
    console.log(`  trace     ${s.trace} (DevTools > Performance > load profile)\n`);
  }
}
// Grouped by cause: the verdict without its numbers.
const groups = {};
for (const s of all)
  for (const f of s.freezes) {
    const key = `${s.cycle} ${s.step}: ${f.verdict.replace(/\d+(\.\d+)? ms/g, '# ms').replace(/\d+ (elements|of)/g, '# $1').replace(/of \d+ objects/, 'of # objects')}`;
    (groups[key] ??= []).push(f.ms);
  }
console.log('by cause (how many repetitions had it, of how many, and how long)');
const reps = (c, st) => all.filter((s) => s.cycle === c && s.step === st).length;
for (const [k, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length || Math.max(...b[1]) - Math.max(...a[1]))) {
  const [c, st] = k.split(':')[0].split(' ');
  console.log(`  ${list.length}/${reps(c, st)}  ${Math.min(...list)}-${Math.max(...list)} ms  ${k}`);
}
if (!Object.keys(groups).length) console.log('  none');
const tag = arg('tag', `freezes-${Date.now()}`);
writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({ id: ID, throttle: THROTTLE, min: MIN, build: relative(root, dist), steps: all }, null, 1));
console.log(`\nwritten: ${relative(root, join(outDir, `${tag}.json`))}`);
