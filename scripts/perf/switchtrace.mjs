// A trace of one product change (after the warm-up), summarized by thread: what fills the second after
// the click. node scripts/perf/switchtrace.mjs [css-to-inject]
// Env: CLICK=<index> (which product, default 1); FLING=1 (a fast wheel up instead of a click);
// THEME=1 (the theme toggle); STACK=1 (the JavaScript behind each layout; STACK=dump for the raw event).
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath } from './chrome.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), 'swt-'));
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: false,
  defaultViewport: null,
  userDataDir: dir,
  args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
if (process.argv[2]) await page.evaluateOnNewDocument((css) => window === top && addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)), process.argv[2]);
if (process.env.THEME)
  await page.evaluateOnNewDocument(() => {
    if (window !== top) return;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const a = animate.apply(this, args);
      if (this.classList?.contains('theme-wash')) {
        const k = args[0][0].opacity === 0 ? 'in' : 'out';
        console.timeStamp(`wash-${k}-start`);
        a.finished.then(() => console.timeStamp(`wash-${k}-end`));
      }
      return a;
    };
  });
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await page.mouse.move(1530, 900, { steps: 4 });
await sleep(9000);
await page.evaluate(() => document.querySelectorAll('[data-go]')[3].click());
await sleep(2500);
const path = join(dir, 't.json');
await page.tracing.start({ path, categories: [...(process.env.DIRTY ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []), 'devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'viz', 'gpu', 'cc', 'blink', ...(process.env.STACK ? ['disabled-by-default-devtools.timeline.stack'] : [])] });
await sleep(200);
if (process.env.THEME) await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
else if (process.env.FLING) { await page.mouse.move(800, 500); for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: -600 }); await sleep(12); } }
else if (!process.env.NOCLICK) await page.evaluate((i) => document.querySelectorAll('[data-go]')[i].click(), Number(process.env.CLICK ?? 1));
await sleep(1200);
await page.tracing.stop();
await browser.close();
const ev = JSON.parse(readFileSync(path, 'utf8')).traceEvents;
const tn = new Map();
const pn = new Map();
for (const e of ev) if (e.ph === 'M') (e.name === 'thread_name' ? tn : e.name === 'process_name' ? pn : new Map()).set(e.name === 'thread_name' ? `${e.pid}:${e.tid}` : e.pid, e.args.name);
const by = new Map();
for (const e of ev) {
  if (e.ph !== 'X' || !e.dur) continue;
  const th = `${pn.get(e.pid)}/${tn.get(`${e.pid}:${e.tid}`)}#${e.pid}`;
  if (!/CrRendererMain|CrGpuMain|VizCompositor|Compositor$/.test(th)) continue;
  const m = by.get(th) ?? new Map();
  m.set(e.name, (m.get(e.name) ?? 0) + e.dur / 1000);
  by.set(th, m);
}
for (const [th, m] of by) {
  const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 8));
  if (top[0][1] < 30) continue;
  console.log(th, '|', top.map(([n, d]) => `${n} ${d.toFixed(0)}`).join(', '));
}
if (process.env.DIRTY) {
  // What invalidated style on the page each frame: the elements named by style invalidation events.
  const inv = {};
  for (const e of ev) if (/StyleInvalidator|ScheduleStyleRecalculation|StyleRecalcInvalidationTracking|InvalidationTracking/.test(e.name)) { const d = e.args?.data ?? {}; const k = `${e.name} ${d.nodeName ?? ''} ${d.reason ?? d.invalidationList?.[0]?.classes ?? ''}`.slice(0, 120); inv[k] = (inv[k] ?? 0) + 1; }
  console.log(Object.entries(inv).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${v}x ${k}`).join(' | '));
}
// (WASHLOG) frame gaps placed against the wash's phases.
if (process.env.THEME) {
  const marks = Object.fromEntries(ev.filter((e) => e.name === 'TimeStamp' && /wash-/.test(e.args?.data?.message ?? '')).map((e) => [e.args.data.message, e.ts]));
  const d = ev.filter((e) => e.name === 'DirectRenderer::DrawFrame').map((e) => e.ts).sort((a, b) => a - b);
  const phase = (t) => (t < marks['wash-in-start'] ? 'before' : t < marks['wash-in-end'] ? 'fading in' : t < marks['wash-out-start'] ? 'covered' : t < marks['wash-out-end'] ? 'fading out' : 'after');
  const by = {};
  for (let i = 1; i < d.length; i++) {
    const g = (d[i] - d[i - 1]) / 1000;
    const ph = phase(d[i]);
    (by[ph] ??= []).push(g);
  }
  for (const [ph, gs] of Object.entries(by)) console.log(`  ${ph.padEnd(11)} frames ${String(gs.length).padStart(3)}  worst ${Math.max(...gs).toFixed(0).padStart(4)} ms  over 25 ms: ${gs.filter((g) => g > 25).length}`);
  console.log('  phases ms:', ['wash-in-start', 'wash-in-end', 'wash-out-start', 'wash-out-end'].map((k) => k + '=' + Math.round(((marks[k] ?? 0) - marks['wash-in-start']) / 1000)).join(' '));
}
const draws = ev.filter((e) => e.name === 'DirectRenderer::DrawFrame').map((e) => e.ts).sort((a, b) => a - b);
const gaps = draws.slice(1).map((t, i) => (t - draws[i]) / 1000);
console.log('frames drawn', draws.length, 'in 1.4 s; gaps >25ms:', gaps.filter((g) => g > 25).map((g) => g.toFixed(0)).join(' '));
const long = ev.filter((e) => e.ph === 'X' && e.dur > 30000 && /RunTask/.test(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 8);
for (const e of long) {
  const kids = ev.filter((x) => x.ph === 'X' && x.pid === e.pid && x.tid === e.tid && x.ts >= e.ts && x.ts + x.dur <= e.ts + e.dur && x !== e && x.dur > 5000).sort((a, b) => b.dur - a.dur).slice(0, 5).map((x) => `${x.name} ${(x.dur / 1000).toFixed(0)}`);
  console.log(`${(e.dur / 1000).toFixed(0)}ms ${pn.get(e.pid)}/${tn.get(`${e.pid}:${e.tid}`)}#${e.pid} | ${kids.join(' ; ')}`);
}
// (STACK=1, with the stack category on) the JavaScript that asked for each layout, by its top frames.
if (process.env.STACK) {
  const where = {};
  for (const e of ev) {
    if (e.name !== 'Layout' && e.name !== 'ForcedStyleAndLayout' && e.name !== 'UpdateLayoutTree') continue;
    const st = e.args?.beginData?.stackTrace ?? e.args?.data?.stackTrace ?? [];
    const k = `${e.name} ${(e.dur / 1000).toFixed(1)}ms <- ` + st.slice(0, 3).map((f) => `${f.functionName || '(anon)'}@${(f.url || '').split('/').pop()}:${f.lineNumber}`).join(' < ');
    where[k] = (where[k] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(where).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`${v}x ${k}`);
}
if (process.env.STACK === 'dump') {
  const one = ev.find((e) => e.name === 'Layout' && e.dur > 300);
  console.log(JSON.stringify(one?.args ?? null).slice(0, 1500));
  const inv = ev.find((e) => e.name === 'UpdateLayoutTree' && e.dur > 300);
  console.log(JSON.stringify(inv?.args ?? null).slice(0, 800));
}
// (INVAL=1) what the style recalcs touched: elements per recalc, and the invalidations' names.
if (process.env.INVAL) {
  const names = {};
  let elems = 0, recalcs = 0;
  for (const e of ev) {
    if (/nvalidat/.test(e.name)) names[e.name] = (names[e.name] ?? 0) + 1;
    if (e.name === 'UpdateLayoutTree' && e.args?.elementCount) { elems += e.args.elementCount; recalcs++; }
  }
  console.log('style recalcs', recalcs, 'elements', elems, JSON.stringify(names));
}
if (process.env.INVAL === 'why') {
  const why = {};
  for (const e of ev) {
    if (e.name !== 'StyleRecalcInvalidationTracking' && e.name !== 'StyleInvalidatorInvalidationTracking') continue;
    const d = e.args?.data ?? {};
    const k = `${e.name.replace('InvalidationTracking', '')} reason=${d.reason ?? '-'} node=${d.nodeName ?? '-'} sel=${d.selectorPart ?? '-'} inv=${(d.invalidationSet ?? d.invalidationList?.[0]?.id ?? '')}`.slice(0, 220);
    why[k] = (why[k] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${v}x ${k}`);
}
// (LABEL=1) which renderer is which, by the documents it hosts, and its main thread's busy time (top-level tasks only).
if (process.env.LABEL) {
  const docs = new Map();
  for (const e of ev) {
    const u = e.args?.data?.url;
    if (typeof u === "string" && /^https?:/.test(u) && e.args.data.frame) docs.set(e.pid, new Set([...(docs.get(e.pid) ?? []), u.replace(/\?.*$/, "").slice(0, 60)]));
  }
  const busy = new Map();
  for (const e of ev) {
    if (e.ph !== "X" || !e.dur || e.name !== "ThreadControllerImpl::RunTask") continue;
    if (tn.get(`${e.pid}:${e.tid}`) !== "CrRendererMain" || pn.get(e.pid) !== "Renderer") continue;
    busy.set(e.pid, (busy.get(e.pid) ?? 0) + e.dur / 1000);
  }
  // JavaScript run by the page (its FunctionCall events), by file and line: the total time each cost.
  const js = new Map();
  for (const e of ev) {
    if (e.ph !== "X" || e.name !== "FunctionCall" || !e.dur) continue;
    const d = e.args?.data ?? {};
    if (!(d.url ?? "").startsWith(BASE)) continue;
    const k = `${(d.url || "").split("/").pop().slice(0, 40)}:${d.lineNumber}:${d.functionName || "(anon)"}`;
    js.set(k, (js.get(k) ?? 0) + e.dur / 1000);
  }
  for (const [k, ms] of [...js].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.JS ?? 8))) console.log(`  js ${ms.toFixed(1)} ms  ${k}`);
  for (const [pid, ms] of busy) console.log(`renderer#${pid} [${[...(docs.get(pid) ?? [])].join(" ")}] main busy ${ms.toFixed(0)} ms`);
}
// (PAGEINV=1) the invalidations and layouts of the page's own renderer only (the one hosting localhost).
if (process.env.PAGEINV) {
  const pagePids = new Set();
  for (const e of ev) if (typeof e.args?.data?.url === "string" && /^http:\/\/localhost:/.test(e.args.data.url) && e.args.data.frame) pagePids.add(e.pid);
  const why = {};
  for (const e of ev) {
    if (!pagePids.has(e.pid)) continue;
    if (!/Invalidation|^Layout$|UpdateLayoutTree/.test(e.name)) continue;
    const d = e.args?.data ?? e.args?.beginData ?? {};
    const k = `${e.name} ${d.reason ?? ""} ${d.nodeName ?? ""} ${d.selectorPart ?? ""} ${d.class ?? ""} ${(d.invalidationSet ?? "").toString().slice(0, 40)}`.replace(/\s+/g, " ").slice(0, 200);
    why[k] = (why[k] ?? 0) + (e.dur ? e.dur / 1000 : 1);
  }
  for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${v.toFixed(1)} ${k}`);
}
// (COUNTS=1) load-independent counts for the page's renderer: style recalcs, elements they touched,
// layouts and paints. Compare these between CSS variants; they don't depend on the machine's speed.
if (process.env.COUNTS) {
  const pagePids = new Set();
  for (const e of ev) if (typeof e.args?.data?.url === "string" && /^http:\/\/localhost:/.test(e.args.data.url) && e.args.data.frame) pagePids.add(e.pid);
  let recalcs = 0, elems = 0, layouts = 0, paints = 0, draws = 0;
  for (const e of ev) {
    if (!pagePids.has(e.pid)) continue;
    if (e.name === "UpdateLayoutTree") { recalcs++; elems += e.args?.elementCount ?? 0; }
    if (e.name === "Layout") layouts++;
    if (e.name === "Paint" || e.name === "PaintLayer" || e.name === "PaintImage") paints++;
  }
  for (const e of ev) if (e.name === "DirectRenderer::DrawFrame") draws++;
  console.log(`COUNTS page style-recalcs=${recalcs} elements=${elems} layouts=${layouts} paints=${paints} draws=${draws}`);
}
