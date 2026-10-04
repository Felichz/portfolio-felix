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
};
const variants = (process.argv[2] ?? 'base').split(',');
const rounds = Number(process.env.ROUNDS ?? 2);

async function run(variant) {
  const browser = await puppeteer.launch({
    executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
    headless: false,
    defaultViewport: null,
    userDataDir: mkdtempSync(join(tmpdir(), 'sw-')),
    args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const [page] = await browser.pages();
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
    await sleep(1100);
    const f = await page.evaluate((t0) => window.__f.filter((t) => t >= t0 && t <= t0 + 1000), t0);
    const gaps = f.slice(1).map((t, k) => t - f[k]);
    res.push({ fps: f.length, worst: Math.max(...gaps), janky: gaps.filter((g) => g > 1000 / 60).reduce((a, g) => a + g, 0) / 10 });
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
