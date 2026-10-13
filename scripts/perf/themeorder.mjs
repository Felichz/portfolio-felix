/**
 * When a stage takes a theme switch, against when the page's switch starts its reveal. A stage that
 * switches before the reveal starts paints the new edition over the frozen page (another process
 * keeps painting): a flash. After it, the switch only shows inside the circle.
 *
 *   node scripts/perf/themeorder.mjs [product]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const ID = process.argv[2] ?? 'lifeui';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
  headless: false,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'to-')),
  args: ['--window-size=1600,1047', '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
});
const [page] = await browser.pages();
await page.goto(`${BASE}/#work/${ID}`, { waitUntil: 'load' });
await sleep(2500);
const box = await page.evaluate(() => {
  const r = document.querySelector('.slide[data-state="active"] .plate').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
for (let i = 0; i < 40; i++) {
  await page.mouse.move(box.x + (i % 2 ? 6 : -6), box.y);
  await sleep(150);
  if (await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate').hasAttribute('data-live'))) break;
}
await sleep(800);
const stage = page.frames().find((f) => f.url().includes(`/stage/#${ID}`));
// In the stage: when the app's theme attribute changes, on the clock all frames share.
await stage.evaluate(() => {
  const app = document.querySelector('.live-app')?.contentDocument?.documentElement;
  const tape = document.querySelector('.tape-frame')?.contentDocument?.documentElement;
  window.__switched = [];
  for (const [name, el] of [['app', app], ['tape', tape]])
    if (el) new MutationObserver((ms) => ms.some((m) => /theme/i.test(m.attributeName)) && window.__switched.push(`${name}@${Math.round(performance.timeOrigin + performance.now())}`)).observe(el, { attributes: true });
});
// In the page: when the switch starts, and when its reveal starts (the view transition's ready).
await page.evaluate(() => {
  window.__marks = [];
  const at = (k) => window.__marks.push(`${k}@${Math.round(performance.timeOrigin + performance.now())}`);
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = (cb) => {
    at('switch');
    const vt = start(cb);
    vt.ready.then(() => at('reveal'));
    return vt;
  };
  document.querySelector('[data-theme-toggle]').click();
});
await sleep(1500);
const marks = await page.evaluate(() => window.__marks);
const switched = await stage.evaluate(() => window.__switched);
await browser.close();
const t = (s) => Number(s.split('@')[1]);
const reveal = t(marks.find((m) => m.startsWith('reveal')) ?? 'x@NaN');
const sw = t(marks[0]);
console.log(`${ID}: switch +0, reveal +${reveal - sw} ms; stage: ${switched.map((s) => `${s.split('@')[0]} +${t(s) - sw}`).join(', ')}`);
console.log(switched.every((s) => t(s) >= reveal) ? 'OK: the stage switched after the reveal started' : 'FLASH: the stage switched before the reveal started');
