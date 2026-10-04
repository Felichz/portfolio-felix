// A trace of one product change (after the warm-up), summarized by thread: what fills the second after
// the click. node scripts/perf/switchtrace.mjs [css-to-inject]
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), 'swt-'));
const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
  headless: false,
  defaultViewport: null,
  userDataDir: dir,
  args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
if (process.argv[2]) await page.evaluateOnNewDocument((css) => window === top && addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)), process.argv[2]);
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await page.mouse.move(1530, 900, { steps: 4 });
await sleep(9000);
await page.evaluate(() => document.querySelectorAll('[data-go]')[3].click());
await sleep(2500);
const path = join(dir, 't.json');
await page.tracing.start({ path, categories: [...(process.env.DIRTY ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []), 'devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'viz', 'gpu', 'cc', 'blink'] });
await sleep(200);
if (!process.env.NOCLICK) await page.evaluate(() => document.querySelectorAll('[data-go]')[1].click());
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
const draws = ev.filter((e) => e.name === 'DirectRenderer::DrawFrame').map((e) => e.ts).sort((a, b) => a - b);
const gaps = draws.slice(1).map((t, i) => (t - draws[i]) / 1000);
console.log('frames drawn', draws.length, 'in 1.4 s; gaps >25ms:', gaps.filter((g) => g > 25).map((g) => g.toFixed(0)).join(' '));
const long = ev.filter((e) => e.ph === 'X' && e.dur > 30000 && /RunTask/.test(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 8);
for (const e of long) {
  const kids = ev.filter((x) => x.ph === 'X' && x.pid === e.pid && x.tid === e.tid && x.ts >= e.ts && x.ts + x.dur <= e.ts + e.dur && x !== e && x.dur > 5000).sort((a, b) => b.dur - a.dur).slice(0, 5).map((x) => `${x.name} ${(x.dur / 1000).toFixed(0)}`);
  console.log(`${(e.dur / 1000).toFixed(0)}ms ${pn.get(e.pid)}/${tn.get(`${e.pid}:${e.tid}`)}#${e.pid} | ${kids.join(' ; ')}`);
}
