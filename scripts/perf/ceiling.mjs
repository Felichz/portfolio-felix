// Frame-rate ceiling of this machine's Chrome: a blank page vs the site's intro at rest, same flags.
import puppeteer from 'puppeteer-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'perf-ceil-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const fps = async () => page.evaluate(() => new Promise((r) => { const f = []; const t = (x) => { f.push(x); if (f.length < 400 && x - f[0] < 2000) requestAnimationFrame(t); else { const iv = f.slice(1).map((x, i) => x - f[i]).sort((a, b) => a - b); r({ fps: (f.length - 1) / ((f.at(-1) - f[0]) / 1000), p50: iv[iv.length >> 1], p95: iv[Math.floor(iv.length * 0.95)] }); } }; requestAnimationFrame(t); }));
await sleep(4000);
await page.goto('data:text/html,<body style="background:#eee">blank</body>');
await sleep(1500);
console.log('blank', JSON.stringify(await fps()));
for (const u of (process.env.URLS ?? 'http://localhost:4391/').split(',')) {
  await page.goto(u, { waitUntil: 'load' });
  await sleep(3000);
  console.log(u, 'rest', JSON.stringify(await fps()));
}
console.log('screen', JSON.stringify(await page.evaluate(() => ({ w: screen.width, h: screen.height, dpr: devicePixelRatio, iw: innerWidth, ih: innerHeight }))));
await browser.close();
