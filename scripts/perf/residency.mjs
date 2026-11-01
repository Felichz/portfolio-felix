/**
 * What stays mounted, allocated and awake after it should have gone. The frame traces say what a second
 * costs; they say nothing about what a minute leaves behind. This counts, sample by sample: the stages
 * still in the page, the tape DOMs still built, the nodes and heap each document holds, the animations
 * still running, and the timers still firing when nobody touches anything.
 *
 *   node scripts/perf/residency.mjs                    # tour, window, then three minutes at rest
 *   BASE='http://[::1]:4391' REST=180 TOURS=2 node scripts/perf/residency.mjs
 *   IDS=lifeui,lolimpact node scripts/perf/residency.mjs
 *
 * A fresh profile, off-screen window, same flags as the other scripts. The counters are read the same
 * way in every document, so a stage in its own process and one inside the page's process are counted the
 * same way.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, windowPosition } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4391';
const IDS = (process.env.IDS ?? 'katarch,knowgraph,lifeui,lolimpact,playsync').split(',');
const TOURS = Number(process.env.TOURS ?? 2);
const REST = Number(process.env.REST ?? 180);
const EVERY = Number(process.env.EVERY ?? 30); // seconds between rest samples
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'resid-')),
  args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run',
    '--enable-precise-memory-info', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
if (process.env.THROTTLE) await page.emulateCPUThrottling(Number(process.env.THROTTLE));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// Every document, page or stage, counts the same things.
await page.evaluateOnNewDocument(() => {
  const T = (window.__t = { raf: 0, to: 0, iv: 0, frames: 0, since: 0 });
  const R = requestAnimationFrame, O = setTimeout, I = setInterval;
  window.requestAnimationFrame = (f) => (T.raf++, R((x) => (T.frames++, f(x))));
  window.setTimeout = (f, d, ...a) => (T.to++, O(f, d, ...a));
  window.setInterval = (f, d, ...a) => (T.iv++, I(f, d, ...a));
  const tick = () => R(tick);
  R(tick);
});

const sampleDoc = () => ({
  nodes: document.getElementsByTagName('*').length,
  iframes: document.querySelectorAll('iframe').length,
  stages: [...document.querySelectorAll('iframe')].map((f) => (f.getAttribute('src') || f.src || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 40)),
  players: document.querySelectorAll('tape-player').length,
  plates: document.querySelectorAll('.plate').length,
  states: [...document.querySelectorAll('.plate')].map((p) => p.dataset.state ?? '-').join(','),
  live: document.querySelectorAll('.plate[data-live], .live-app').length,
  anims: document.getAnimations().length,
  heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
  t: { ...window.__t },
  now: performance.now(),
  wall: Date.now(),
});

const samples = [];
const take = async (name) => {
  const docs = [];
  for (const f of page.frames()) {
    const d = await f.evaluate(sampleDoc).catch(() => null);
    if (d) docs.push({ frame: f === page.mainFrame() ? 'page' : f.url().replace(/^https?:\/\//, '').slice(0, 34), ...d });
  }
  const m = await page.metrics().catch(() => null);
  samples.push({ name, docs, cdp: m && { Nodes: m.Nodes, Listeners: m.Listeners, JSHeapUsedSize: Math.round(m.JSHeapUsedSize / 1048576), TaskDuration: +m.TaskDuration.toFixed(2) } });
  const p = docs[0];
  console.log(
    `${name.padEnd(14)} nodes ${String(p?.nodes).padStart(6)}  iframes ${String(p?.iframes).padStart(2)}  players ${String(p?.players).padStart(2)}  live ${String(p?.live).padStart(2)}  anims ${String(p?.anims).padStart(3)}  heap ${String(p?.heap).padStart(3)}MB  frames ${String(p?.t?.frames).padStart(6)}  docs ${docs.length}`,
  );
  return p;
};

const rail = (id) => page.evaluate((id) => {
  const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
  document.querySelectorAll('[data-go]')[i]?.click();
}, id);

await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await sleep(4000);
await take('load');
await page.mouse.move(1530, 770, { steps: 4 });
await page.mouse.wheel({ deltaY: 60 });
await sleep(8000);
await take('input');
for (let tour = 1; tour <= TOURS; tour++) {
  for (const id of IDS) { await rail(id); await sleep(4500); await page.mouse.move(1530, 770); }
  await sleep(3000);
  await take(`tour${tour}`);
}

// Bring apps to life: a live app is the heavy thing a preview can hold, and the two most recent are the
// ones kept when their plate leaves the screen. Without this the run never tests that.
const goLive = async (id) => {
  await rail(id);
  await sleep(4500);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.slide[data-state="active"] .plate')?.getBoundingClientRect();
    return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: 800, y: 500 };
  });
  const end = Date.now() + 12000;
  let a = 0;
  while (Date.now() < end) {
    a += 0.4;
    await page.mouse.move(r.x + Math.cos(a) * 24, r.y + Math.sin(a) * 24);
    if (await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate')?.hasAttribute('data-live'))) break;
    await sleep(10);
  }
  await sleep(2500);
  await take(`live:${id}`);
  await page.mouse.move(1530, 900);
  await sleep(2500);
};
for (const id of IDS.slice(0, 3)) await goLive(id);

// The window, and back.
const zoom = await page.evaluate(() => {
  const g = document.querySelector('.slide[data-state="active"] .plate .lights--left .light--zoom');
  if (!g) return null;
  const b = g.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
});
if (zoom) {
  await page.mouse.move(zoom.x, zoom.y, { steps: 30 });
  for (let i = 0; i < 20; i++) {
    if (await page.evaluate((z) => !!document.elementFromPoint(z.x, z.y)?.closest('.light--zoom'), zoom)) break;
    await page.mouse.move(zoom.x + (i % 2 ? 1 : -1), zoom.y);
    await sleep(50);
  }
  await page.mouse.click(zoom.x, zoom.y);
  await sleep(7000);
  await take('window');
  await page.keyboard.press('Escape');
  await sleep(4000);
  await take('closed');
} else errors.push('no zoom light to click');

// At rest: nobody touches anything, and the pointer sits off the previews.
await page.mouse.move(1530, 900);
let waited = 0;
let n = 0;
while (waited < REST) {
  await sleep(EVERY * 1000);
  waited += EVERY;
  await take(`rest:${waited}s`);
  if (++n > 20) break;
}

// ---- Report
const rate = (a, b) => {
  if (!a || !b) return null;
  const dt = (b.wall - a.wall) / 1000;
  if (dt <= 0) return null;
  return { fps: (b.t.frames - a.t.frames) / dt, to: (b.t.to - a.t.to) / dt, iv: (b.t.iv - a.t.iv) / dt, raf: (b.t.raf - a.t.raf) / dt };
};
console.log(`\nsample          nodes  iframes players  live anims  heapMB  page-fps  timers/s  stage-docs  stage-nodes  stage-heapMB`);
for (const s of samples) {
  const p = s.docs[0];
  const r = rate(samples[Math.max(0, samples.indexOf(s) - 1)]?.docs[0], p);
  const stages = s.docs.slice(1);
  console.log(
    s.name.padEnd(14), String(p?.nodes).padStart(6), String(p?.iframes).padStart(7), String(p?.players).padStart(6),
    String(p?.live).padStart(4), String(p?.anims).padStart(5), String(p?.heap).padStart(7),
    r ? String(Math.round(r.fps)).padStart(8) : '       -',
    r ? `${Math.round(r.to + r.iv + r.raf)}`.padStart(9) : '        -',
    String(stages.length).padStart(11), String(stages.reduce((a, d) => a + (d.nodes ?? 0), 0)).padStart(12),
    String(stages.reduce((a, d) => a + (d.heap ?? 0), 0)).padStart(13),
  );
}
const a = samples[1]?.docs[0], b = samples.at(-1)?.docs[0];
if (a && b) {
  console.log(`\nfrom "${samples[1].name}" to "${samples.at(-1).name}", untouched:`);
  console.log(`  page nodes  ${a.nodes} -> ${b.nodes}  (${b.nodes - a.nodes >= 0 ? '+' : ''}${b.nodes - a.nodes})`);
  console.log(`  page heap   ${a.heap} -> ${b.heap} MB  (${b.heap - a.heap >= 0 ? '+' : ''}${b.heap - a.heap} MB)`);
  console.log(`  iframes     ${a.iframes} -> ${b.iframes}`);
  console.log(`  tape DOMs   ${a.players} -> ${b.players} players, ${samples[1].docs.length - 1} -> ${samples.at(-1).docs.length - 1} stage documents`);
  const r = rate(a, b);
  console.log(`  still firing: ${Math.round(r.raf + r.to + r.iv)} page timer callbacks per second at rest (${Math.round(r.to)} timeouts, ${Math.round(r.iv)} intervals, ${Math.round(r.raf)} frames scheduled)`);
  console.log(`  animations at rest: ${a.anims} -> ${b.anims}`);
}
console.log('\ncdp (page target):');
for (const s of samples) if (s.cdp) console.log(' ', s.name.padEnd(14), JSON.stringify(s.cdp));
console.log('errors:', errors);
writeFileSync(join(out, 'residency.json'), JSON.stringify({ BASE, IDS, TOURS, REST, samples }, null, 1));
await browser.close();
