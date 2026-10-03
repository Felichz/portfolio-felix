/**
 * Chrome traces of the showcase's moments, summarized: where the time goes, per process, thread and
 * frame (document). Against a built site served locally:
 *
 *   node scripts/perf/trace.mjs [label]
 *
 * Moments: the intro at rest; the showcase playing a product with its app booted under it; a change of
 * product; hovering a preview until it's live; moving over the live app. Raw traces go to
 * scripts/perf/out/<label>-<moment>.json.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:4391';
const label = process.argv[2] ?? 'trace';
const PRODUCT = process.env.PRODUCT ?? 'lifeui';
const NEXT = process.env.NEXT ?? 'lolimpact';
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync),
  headless: false,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'perf-trace-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--lang=en-US', '--no-first-run', '--disable-extensions', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink', 'cc', 'gpu', 'viz', 'toplevel', 'v8.execute', 'loading'];
const rate = () =>
  page.evaluate(
    () =>
      new Promise((r) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => (++n, performance.now() - t0 < 500 ? requestAnimationFrame(f) : r(`${document.visibilityState} ${Math.round(n * 2)}fps`));
        requestAnimationFrame(f);
      }),
  );

async function traced(name, fn) {
  console.log(`(${name}: ${await rate()})`);
  const path = join(out, `${label}-${name}.json`);
  await page.tracing.start({ path, categories: CATS });
  const t = Date.now();
  await fn();
  const wall = Date.now() - t;
  await page.tracing.stop();
  summarize(name, path, wall);
}

function summarize(name, path, wall) {
  const { traceEvents: ev } = JSON.parse(readFileSync(path, 'utf8'));
  const pname = new Map();
  const tname = new Map();
  for (const e of ev) {
    if (e.ph !== 'M') continue;
    if (e.name === 'process_name') pname.set(e.pid, e.args.name);
    if (e.name === 'thread_name') tname.set(`${e.pid}:${e.tid}`, e.args.name);
  }
  // Frames (documents) by id, for attributing style, layout and paint.
  const frameUrl = new Map();
  for (const e of ev) {
    const d = e.args?.data;
    if (!d) continue;
    if (e.name === 'TracingStartedInBrowser') for (const f of d.frames ?? []) frameUrl.set(f.frame, f.url);
    if ((e.name === 'FrameCommittedInBrowser' || e.name === 'CommitLoad') && d.frame) frameUrl.set(d.frame, d.url);
  }
  const short = (u = '') => (u.startsWith('about:srcdoc') ? 'tape(srcdoc)' : u.replace(BASE, '').replace(/\?.*$/, '').slice(0, 40) || '?');
  // Self time of complete events, per thread, by name (children subtracted).
  const byThread = new Map();
  const stacks = new Map();
  const xs = ev.filter((e) => e.ph === 'X' && typeof e.dur === 'number').sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const self = new Map();
  const depth = new Map();
  for (const e of xs) {
    const key = `${e.pid}:${e.tid}`;
    const st = stacks.get(key) ?? [];
    while (st.length && st.at(-1).ts + st.at(-1).dur <= e.ts) st.pop();
    depth.set(e, st.length);
    if (st.length) self.set(st.at(-1), (self.get(st.at(-1)) ?? e.dur) - e.dur);
    st.push(e);
    stacks.set(key, st);
    if (!self.has(e)) self.set(e, e.dur);
  }
  const perFrame = new Map();
  for (const e of xs) {
    const thread = `${pname.get(e.pid) ?? e.pid}/${tname.get(`${e.pid}:${e.tid}`) ?? e.tid}`;
    if (!/CrRendererMain|CrGpuMain|VizCompositorThread|Compositor$|CrBrowserMain/.test(thread)) continue;
    const s = Math.max(0, self.get(e) ?? 0);
    const t = byThread.get(thread) ?? { total: 0, names: new Map() };
    if (depth.get(e) === 0) t.total += e.dur;
    t.names.set(e.name, (t.names.get(e.name) ?? 0) + s);
    byThread.set(thread, t);
    const f = e.args?.data?.frame ?? e.args?.beginData?.frame ?? e.args?.frame;
    if (f && /CrRendererMain/.test(thread) && /UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|HitTest|ParseHTML|EvaluateScript|FunctionCall|v8.compile|TimerFire|FireAnimationFrame|EventDispatch/.test(e.name)) {
      const k = short(frameUrl.get(f));
      const m = perFrame.get(k) ?? new Map();
      m.set(e.name, (m.get(e.name) ?? 0) + e.dur);
      perFrame.set(k, m);
    }
  }
  // One line for comparing builds: busy share of the page's main thread and the GPU's, frames the
  // display compositor drew per second, and the longest task on the page's main thread.
  const busyOf = (re) => [...byThread].filter(([k]) => re.test(k)).reduce((a, [, t]) => a + t.total, 0) / 1000 / wall;
  const drawn = ev.filter((e) => e.name === 'DirectRenderer::DrawFrame').length / (wall / 1000);
  let longest = 0;
  for (const e of xs) if (depth.get(e) === 0 && /^Renderer$/.test(pname.get(e.pid) ?? '') && tname.get(`${e.pid}:${e.tid}`) === 'CrRendererMain') longest = Math.max(longest, e.dur / 1000);
  // With stages from another site there are two renderers: the page's (the one that ran its rAF) and
  // the stages'. Busy shares per renderer process, page first.
  const label = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'process_labels') label.set(e.pid, e.args.labels);
  const mains = new Map();
  for (const e of xs) {
    if (depth.get(e) !== 0 || tname.get(`${e.pid}:${e.tid}`) !== 'CrRendererMain' || pname.get(e.pid) !== 'Renderer') continue;
    mains.set(e.pid, (mains.get(e.pid) ?? 0) + e.dur);
  }
  // The page's renderer is the one that has the page's own documents (not a stage's).
  const docs = new Map();
  for (const e of ev) {
    const u = e.args?.data?.url;
    if (typeof u === 'string' && e.args.data.frame && /^https?:/.test(u)) docs.set(e.pid, [...(docs.get(e.pid) ?? []), u]);
  }
  const pagePid = [...mains.keys()].find((pid) => (docs.get(pid) ?? []).some((u) => u.startsWith(BASE) && !u.includes('/stage/') && !u.includes('/apps/') && !u.includes('/tapes/'))) ?? [...mains.keys()][0];
  const pageMain = (mains.get(pagePid) ?? 0) / 1000 / wall;
  const others = [...mains].filter(([pid]) => pid !== pagePid).map(([pid, d]) => `${(label.get(pid) ?? pid).toString().slice(0, 24)}:${((d / 1000 / wall) * 100).toFixed(0)}%`);
  let pageLongest = 0;
  for (const e of xs) if (e.pid === pagePid && depth.get(e) === 0 && tname.get(`${e.pid}:${e.tid}`) === 'CrRendererMain') pageLongest = Math.max(pageLongest, e.dur / 1000);
  console.log(`RESULT ${name} page=${(pageMain * 100).toFixed(0)}% pageLongest=${pageLongest.toFixed(0)}ms others=[${others.join(' ')}] gpu=${(busyOf(/^GPU Process\/CrGpuMain/) * 100).toFixed(0)}% drawn=${drawn.toFixed(0)}fps`);
  console.log(`RESULT ${name} main=${(busyOf(/^Renderer\/CrRendererMain/) * 100).toFixed(0)}% gpu=${(busyOf(/^GPU Process\/CrGpuMain/) * 100).toFixed(0)}% drawn=${drawn.toFixed(0)}fps longest=${longest.toFixed(0)}ms`);
  console.log(`\n== ${name} (${(wall / 1000).toFixed(1)}s)`);
  for (const [thread, t] of [...byThread].sort((a, b) => b[1].total - a[1].total)) {
    if (t.total < 20000) continue;
    const top = [...t.names].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([n, d]) => `${n} ${(d / 1000).toFixed(0)}`);
    console.log(`  ${thread}: busy ${((t.total / 1000 / wall) * 100).toFixed(0)}%  | ${top.join(', ')}`);
  }
  for (const [k, m] of [...perFrame].sort((a, b) => sum(b[1]) - sum(a[1]))) {
    console.log(`  frame ${k}: ${[...m].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([n, d]) => `${n} ${(d / 1000).toFixed(0)}`).join(', ')}`);
  }
}
const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);

const wiggle = async (x, y, ms, r = 40) => {
  const end = Date.now() + ms;
  let a = 0;
  while (Date.now() < end) {
    a += 0.35;
    await page.mouse.move(x + Math.cos(a) * r, y + Math.sin(a) * r);
    await sleep(8);
  }
};
const select = (id) =>
  page.evaluate((id) => {
    const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
    document.querySelectorAll('[data-go]')[i]?.click();
  }, id);
const plate = () =>
  page.evaluate(() => {
    const r = document.querySelector('.slide[data-state="active"] .plate[data-app]')?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

await sleep(3000);
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(3000);
await traced('intro-rest', () => sleep(3000));
await page.mouse.move(700, 400, { steps: 10 });
await page.keyboard.press('ArrowDown');
await sleep(2500);
await select(PRODUCT);
await page.mouse.move(1530, 770);
await sleep(4000);
await traced('playing', () => sleep(4000));
await traced('change', async () => {
  await select(NEXT);
  await sleep(4000);
});
await select(PRODUCT);
await sleep(4000);
const p = await plate();
await traced('hover', async () => {
  await page.mouse.move(p.x - 50, p.y, { steps: 8 });
  await wiggle(p.x - 50, p.y, 1500, 8);
});
await traced('use', () => wiggle(p.x, p.y, 2500, 150));
await browser.close();
