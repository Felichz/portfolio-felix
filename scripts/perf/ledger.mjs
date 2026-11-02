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
//
// It serves that build itself, on [::1] (stages in the page's process, as deployed). DIST picks another
// build; ID the product the scenes use (knowgraph). Chrome runs off screen (SHOW=1 to see it).
// Output: a table per scene, the hottest functions and files, forced layouts with the function that
// forced them, who asks for frames and timers; scripts/perf/out/ledger-<tag>.json for --compare.
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sourceMap from 'source-map-js';
import { chromePath, windowPosition } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

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
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = normalize(join(dist, p));
  if (!f.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) {
    // The vendored apps are single-page apps under /apps/<id>/.
    const m = p.match(/^\/apps\/([^/]+)\//);
    const spa = m && join(dist, 'apps', m[1], 'index.html');
    if (!spa || !existsSync(spa)) return res.writeHead(404).end();
    f = spa;
  }
  const size = statSync(f).size;
  const type = TYPES[extname(f)] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '::1', r));
const BASE = `http://[::1]:${server.address().port}`;

// ---- Source maps: built script positions back to src/ -------------------------------------------------
const maps = new Map();
const consumerFor = (url) => {
  if (maps.has(url)) return maps.get(url);
  let c = null;
  try {
    const path = new URL(url).pathname;
    const file = join(dist, path + '.map');
    if (path.startsWith('/_astro/') && existsSync(file)) c = new sourceMap.SourceMapConsumer(JSON.parse(readFileSync(file, 'utf8')));
  } catch {}
  maps.set(url, c);
  return c;
};
/** Where a script position comes from: `src/scripts/live.ts:412 name`, an app (`app:knowgraph`), or the url. */
const placeTrace = (s) => place(s.url, (s.lineNumber ?? 1) - 1, (s.columnNumber ?? 1) - 1, s.functionName);
const place = (url, line, col, name) => {
  if (!url) return { file: '(native)', where: name || '(native)' };
  const app = url.match(/\/apps\/([^/]+)\//);
  if (app) return { file: `app:${app[1]}`, where: `app:${app[1]}` };
  const c = line >= 0 ? consumerFor(url) : null;
  if (c) {
    const o = c.originalPositionFor({ line: line + 1, column: col ?? 0 });
    if (o.source) {
      const file = o.source.replace(/^.*?\/(src\/|node_modules\/)/, '$1').replace(/\?.*$/, '');
      return { file, where: `${file}:${o.line}${o.name || name ? ' ' + (o.name || name) : ''}` };
    }
  }
  const short = url.replace(BASE, '').replace(/\?.*$/, '');
  return { file: short, where: `${short}:${line + 1}${name ? ' ' + name : ''}` };
};

// ---- Chrome ------------------------------------------------------------------------------------------
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'perf-ledger-')),
  args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion', '--disable-background-timer-throttling'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ID = process.env.ID ?? 'knowgraph';
const plateBox = () => page.evaluate(() => {
  const r = document.querySelector('.slide[data-state="active"] .plate')?.getBoundingClientRect();
  return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const isLive = () => page.evaluate(() => !!document.querySelector('.slide[data-state="active"] .plate')?.hasAttribute('data-live'));
const wiggle = async (at, ms) => {
  const end = Date.now() + ms;
  let a = 0;
  while (Date.now() < end) {
    a += 0.4;
    await page.mouse.move(at.x + Math.cos(a) * 30, at.y + Math.sin(a) * 30);
    await sleep(16);
  }
};
const goLive = async () => {
  const at = await plateBox();
  await page.mouse.move(at.x, at.y, { steps: 6 });
  for (let i = 0; i < 80 && !(await isLive()); i++) await wiggle(at, 80);
  return at;
};

// Each scene: what it does, and whether the setup before it is part of the scene.
const SCENES = {
  load: { run: async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(2000);
  } },
  'to-work': { run: async () => {
    await page.mouse.move(700, 400, { steps: 5 });
    await page.evaluate(() => {
      location.hash = '#work/' + window.__ledgerId;
      // The showcase stays on the product the scenes ask for: advancing on its own, which one is on
      // screen (a YouTube player, or not) would depend on how long each scene took.
      const auto = document.querySelector('[data-auto]');
      if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
    });
    await sleep(2500);
  } },
  'idle-work': { run: () => sleep(3000) },
  'hover-live': { run: async () => {
    await goLive();
    await sleep(300);
  } },
  use: { run: async () => wiggle(await plateBox(), 1500) },
  'next-product': { run: async () => {
    await page.evaluate(() => {
      const go = [...document.querySelectorAll('[data-go]')];
      const i = go.findIndex((b) => b.getAttribute('aria-current') === 'true' || b.closest('[aria-current="true"]'));
      go[(i + 1) % go.length]?.click();
    });
    await page.mouse.move(1530, 770, { steps: 3 });
    await sleep(2500);
  } },
  theme: { run: async () => {
    await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
    await sleep(1500);
  } },
  'open-window': {
    before: async () => {
      await page.evaluate(() => (location.hash = '#work/' + window.__ledgerId));
      await sleep(1500);
      await goLive();
    },
    run: async () => {
      const zoom = await page.evaluate(() => {
        const r = document.querySelector('.slide[data-state="active"] .plate .lights--left .light--zoom')?.getBoundingClientRect();
        return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.move(zoom.x, zoom.y, { steps: 8 });
      await page.mouse.click(zoom.x, zoom.y);
      await sleep(1500);
    },
  },
  'close-window': { run: async () => {
    await page.keyboard.press('Escape');
    await sleep(1500);
  } },
  scroll: { run: async () => {
    await page.mouse.move(80, 500);
    await page.keyboard.press('ArrowDown');
    await sleep(1500);
    await page.keyboard.press('ArrowUp');
    await sleep(1500);
  } },
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
  return { wall, ...reduceTrace(trace.traceEvents ?? trace), profile: reduceProfile(profile) };
}

// ---- The trace, reduced ----------------------------------------------------------------------------
function reduceTrace(events) {
  // The renderer main threads (the page, and its stages and apps when they share its process).
  const mains = new Set(events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`));
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
const repeat = Number(arg('repeat', 1));
const runs = [];
for (let r = 0; r < repeat; r++) {
  const scenes = {};
  if (r > 0) await page.goto('about:blank');
  for (const name of chosen) {
    process.stdout.write(`  ${name}${repeat > 1 ? ` (run ${r + 1})` : ''}\n`);
    scenes[name] = await measure(name);
  }
  runs.push(scenes);
}
await browser.close();
server.close();

// The ledger is the first run; further runs only say how much each count moved between runs.
// Each count's least over the runs: the work the scene can't do without, where a slow load or a late
// boot only ever adds.
const least = {};
for (const name of Object.keys(runs[0])) {
  least[name] = {};
  for (const k of Object.keys(runs[0][name].totals)) least[name][k] = Math.min(...runs.map((r) => r[name].totals[k]));
}
const ledger = { tag: arg('tag', new Date().toISOString().slice(0, 16)), id: ID, build: relative(root, dist), runs: runs.length, least, scenes: runs[0], errors };
writeFileSync(join(outDir, `ledger-${ledger.tag}.json`), JSON.stringify(ledger, null, 1));

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
