// What a pointer sweep costs in layout work.
//
// The frames did not move when the pointer handlers started reading the size of the element under the
// cursor once per frame instead of once per event, so the claim has to be made in work: each of those
// reads asks the document for an up-to-date layout, and on a page that is animating, that is a forced
// recalculation. This counts them. It opens the landing page, finds the two elements that carry the
// handlers (a spotlight plate and a magnetic button), sweeps the cursor across each at a rate like a
// real hand, and reads Blink's own counters before and after. RecalcStyleCount and LayoutCount are
// cumulative, so the delta over the sweep is the answer, and nothing else on the page has to be quiet
// for the delta to mean something.
//
//   BASE='http://[::1]:4391' MOVES=400 node scripts/perf/pointerlab.mjs
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath, windowPosition } from './chrome.mjs';

const BASE = process.env.BASE ?? 'http://[::1]:4391';
const MOVES = Number(process.env.MOVES ?? 400);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  defaultViewport: { width: 1440, height: 860 },
  userDataDir: mkdtempSync(join(tmpdir(), 'plab-')),
  args: ['--window-size=1440,860', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const page = await browser.newPage();
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await sleep(4000);

const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
const metrics = async () => {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  const pick = (n) => m.find((x) => x.name === n)?.value ?? 0;
  return { style: pick('RecalcStyleCount'), layout: pick('LayoutCount'), task: pick('TaskDuration') };
};

// The spotlight reads the element it lights, the magnetic button reads itself to pull toward the cursor.
// Whichever exists is swept; the two are reported apart because they are two different handlers.
const targets = await page.evaluate(() => {
  const found = [];
  for (const [name, sel] of [['spot', '.plate .spot, .spot'], ['btn', '.plate .btn, .btn, .icon-btn']]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    found.push({ name, x: r.x, y: r.y, width: r.width, height: r.height });
  }
  return found;
});
if (!targets.length) {
  console.log('no .spot or .btn on the page; nothing to sweep');
  await browser.close();
  process.exit(1);
}

for (const t of targets) {
  const before = await metrics();
  for (let i = 0; i < MOVES; i++) {
    const p = i / MOVES;
    await page.mouse.move(t.x + t.width * p, t.y + t.height * (0.25 + 0.5 * p));
    if (i % 8 === 7) await sleep(16); // a mouse sends about this much per frame
  }
  await sleep(600);
  const after = await metrics();
  const d = (k) => after[k] - before[k];
  console.log(`${t.name} ${Math.round(t.width)}x${Math.round(t.height)} px, ${MOVES} moves: style ${d('style')}  layouts ${d('layout')}  main-thread ${(d('task') * 1000).toFixed(0)} ms`);
  console.log(`${t.name} per move: style ${(d('style') / MOVES).toFixed(2)}  layout ${(d('layout') / MOVES).toFixed(2)}  task ${((d('task') * 1000) / MOVES).toFixed(2)} ms`);
}
await browser.close();
