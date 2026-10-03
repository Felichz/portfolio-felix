// Functional check of the showcase's live previews: countdown, tape, hover to live, window. Screenshots
// go to scripts/perf/out/check-*.png.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
  headless: false, defaultViewport: null, userDataDir: mkdtempSync(join(tmpdir(), 'perf-check-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--lang=en-US', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const ids = (process.env.IDS ?? 'lifeui').split(',');
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1500);
await page.mouse.move(700, 400, { steps: 5 });
await page.keyboard.press('ArrowDown');
await sleep(2000);
for (const id of ids) {
  await page.evaluate((id) => {
    const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
    document.querySelectorAll('[data-go]')[i]?.click();
  }, id);
  await page.mouse.move(1530, 770);
  await sleep(4000);
  const st = await page.evaluate(() => {
    const slide = document.querySelector('.slide[data-state="active"]');
    const plate = slide.querySelector('.plate');
    const tp = plate.querySelector('tape-player');
    const bar = document.querySelector('.rail-item[aria-current="true"] .rail-progress i');
    return { state: plate.dataset.state, t: tp?.currentTime?.toFixed(2), paused: tp?.paused, bar: bar?.getAnimations().map((a) => `${a.playState} ${Math.round(a.currentTime)}`), cursor: plate.querySelector('.tape-cursor')?.getAnimations().map((a) => a.playState), app: !!plate.querySelector('.live-app') };
  });
  console.log(id, JSON.stringify(st));
  await page.screenshot({ path: join(out, `check-${id}-tape.png`) });
  const r = await page.evaluate(() => { const b = document.querySelector('.slide[data-state="active"] .plate').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const t0 = await page.evaluate(() => performance.now());
  await page.mouse.move(r.x - 40, r.y, { steps: 4 });
  for (let i = 0; i < 30; i++) { await page.mouse.move(r.x - 40 + (i % 5), r.y); await sleep(30); }
  const marks = await page.evaluate((t0) => performance.getEntriesByType('mark').filter((m) => m.name.startsWith('live:')).map((m) => `${m.name} ${Math.round(m.startTime - t0)}`), t0);
  console.log('  marks rel. to hover:', marks.join(', '), '| live:', await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate').hasAttribute('data-live')));
  await page.screenshot({ path: join(out, `check-${id}-live.png`) });
  await page.mouse.move(1530, 770);
  await sleep(500);
}
console.log('errors:', errors);
await browser.close();
