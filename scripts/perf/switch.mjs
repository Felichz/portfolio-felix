/**
 * The showcase's product change, alone: clicks through the rail (pointer resting off the preview) and
 * records the page's frames for the second after each click. Variants switch one thing off by
 * injected CSS, alternating, to find what the change's frames pay for.
 *
 *   node scripts/perf/switch.mjs [variant,variant]   (ROUNDS=2)
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath, windowPosition } from './chrome.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CSS = {
  base: '',
  nostage: '.stage-frame { display: none !important; }',
  nomedia: '.slide-media { transition: none !important; }',
  notext: '.slide-head > *, .slide-side > * { transition: none !important; }',
  noglow: '.ambient, .cursor-light { transition: none !important; } .slide-media::before { display: none !important; }',
  noshadow: '.plate { box-shadow: none !important; }',
  awake: ".slide .stage-frame { visibility: visible !important; } .slide:not([data-state='active']) .stage-frame { opacity: 0 !important; }",
  nobar: '.rail-progress { display: none !important; }',
  plateTx: '.slide-media .plate { transition: translate 0.7s var(--ease-out) !important; }',
  pool: '.slide-media::before { display: none !important; }',
  ambientTx: '.ambient, .cursor-light { transition: none !important; }',
  lightTx: '.cursor-light { transition: none !important; }',
  rail: '.rail-item, .rail-item *, .rail-progress { transition: none !important; }',
  cvSlides: "article.slide:not([data-state='active']):not([data-pre]) { content-visibility: hidden; }",
  stageVis: '.stage-frame { visibility: hidden !important; }',
  tapeOff: 'tape-player { display: none !important; }',
  cvOff: "article.slide:not([data-state='active']) { content-visibility: visible !important; }",
};
const variants = (process.argv[2] ?? 'base').split(',');
const rounds = Number(process.env.ROUNDS ?? 2);

async function run(variant) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: !!process.env.HEADLESS,
    defaultViewport: null,
    userDataDir: mkdtempSync(join(tmpdir(), 'sw-')),
    args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const [page] = await browser.pages();
  // THROTTLE=4 slows the CPU 4x: a modest machine, to see what a 100 Hz panel hides.
  if (process.env.THROTTLE) await page.emulateCPUThrottling(Number(process.env.THROTTLE));
  await page.evaluateOnNewDocument((css) => {
    if (window !== top) return;
    window.__f = [];
    const tick = (t) => (window.__f.push(t), requestAnimationFrame(tick));
    requestAnimationFrame(tick);
    if (css) addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`));
  }, CSS[variant]);
  await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
  await page.mouse.move(1530, 900, { steps: 4 });
  // Let the first input's warm-up (stages built in turn) finish, as a visitor reading would.
  await sleep(9000);
  const res = [];
  for (const i of [1, 2, 3, 4, 0, 2, 4]) {
    const t0 = await page.evaluate((i) => {
      const t = performance.now();
      document.querySelectorAll('[data-go]')[i].click();
      return t;
    }, i);
    // WINDOW=ms: how long after the click the frames count (default 1 s). Longer shows what an early
    // boot moves out of the first second.
    const WIN = Number(process.env.WINDOW ?? 1000);
    await sleep(WIN + 100);
    const f = await page.evaluate((args) => window.__f.filter((t) => t >= args.t0 && t <= args.t0 + args.win), { t0, win: WIN });
    const gaps = f.slice(1).map((t, k) => t - f[k]);
    res.push({ fps: f.length, worst: Math.max(...gaps), janky: (gaps.reduce((a, g) => a + Math.max(0, g - 1000 / 60), 0) / WIN) * 100 });
    await sleep(1400);
  }
  await browser.close();
  return res;
}

const out = Object.fromEntries(variants.map((v) => [v, []]));
for (let r = 0; r < rounds; r++) for (const v of variants) out[v].push(...(await run(v)));
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log('variant     fps(1s after click)  worst frame ms  % of the second in hitches   (medians over all clicks)');
for (const v of variants) {
  const r = out[v];
  console.log(v.padEnd(12), String(med(r.map((x) => x.fps))).padStart(8), med(r.map((x) => x.worst)).toFixed(0).padStart(14), (med(r.map((x) => x.janky)).toFixed(0) + '%').padStart(14), '   worsts:', r.map((x) => Math.round(x.worst)).join(' '));
}
