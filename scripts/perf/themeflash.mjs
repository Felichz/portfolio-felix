/**
 * Frame by frame, what a live preview shows while the site's theme switches: the brightness of the
 * middle of the app on every screencast frame, and where the reveal's circle is. A clean switch reads
 * old, old, ..., then new once the circle has reached the app; a flash reads old, new, old, ..., new.
 *
 *   node scripts/perf/themeflash.mjs [product]
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
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
  userDataDir: mkdtempSync(join(tmpdir(), 'tf-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
});
const [page] = await browser.pages();
await page.goto(`${BASE}/#work/${ID}`, { waitUntil: 'load' });
await sleep(2500);
const box = await page.evaluate(() => {
  const r = document.querySelector('.slide[data-state="active"] .plate').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
});
// The app live under the pointer, then the pointer to the side so nothing else moves.
await page.mouse.move(box.x, box.y, { steps: 5 });
for (let i = 0; i < 40; i++) {
  await page.mouse.move(box.x + (i % 2 ? 6 : -6), box.y);
  await sleep(150);
  if (await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate').hasAttribute('data-live'))) break;
}
await sleep(800);
const live = await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate').hasAttribute('data-live'));

// The screen itself, not Chrome's screencast: while the page waits on the switch's snapshot it
// produces no frames, but a frame from another process keeps painting on screen, and that's where a
// flash would be. ffmpeg grabs the desktop around the app's middle.
const at = await page.evaluate((b) => {
  const k = devicePixelRatio;
  const x = (screenX + (outerWidth - innerWidth) / 2 + b.x) * k;
  const y = (screenY + (outerHeight - innerHeight) + b.y) * k;
  return { x: Math.round(x - 160), y: Math.round(y - 100) };
}, box);
const { spawn } = await import('node:child_process');
const raw = join(mkdtempSync(join(tmpdir(), 'tfv-')), 'grab.rgb');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'gdigrab', '-framerate', '60', '-offset_x', String(at.x), '-offset_y', String(at.y), '-video_size', '320x200', '-draw_mouse', '0', '-t', '4', '-i', 'desktop', '-f', 'rawvideo', '-pix_fmt', 'gray', raw]);
await sleep(2000);
const clicked = Date.now();
await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
await new Promise((r) => ff.on('close', r));
await browser.close();
const { readFileSync } = await import('node:fs');
const buf = readFileSync(raw);
const N = 320 * 200;
const means = [];
for (let i = 0; i + N <= buf.length; i += N) {
  let sum = 0;
  for (let j = i; j < i + N; j++) sum += buf[j];
  means.push(Math.round(sum / N));
}
console.log(`${ID} live=${live}  brightness around the app's middle, one value per 1/60 s:`);
console.log(means.join(' '));
// A contact sheet of the frames around the change, for the eye.
const first = means.findIndex((m, i) => i > 0 && Math.abs(m - means[0]) > 6);
if (first >= 0 && process.argv[3]) {
  const pick = [];
  for (let i = Math.max(0, first - 12); i < Math.min(means.length, first + 36); i++) pick.push(i);
  const cols = 8;
  const sheet = sharp({ create: { width: 320 * cols, height: 200 * Math.ceil(pick.length / cols), channels: 3, background: '#000' } });
  const tiles = await Promise.all(pick.map(async (i, n) => ({ input: await sharp(buf.subarray(i * N, (i + 1) * N), { raw: { width: 320, height: 200, channels: 1 } }).png().toBuffer(), left: (n % cols) * 320, top: Math.floor(n / cols) * 200 })));
  await sheet.composite(tiles).png().toFile(process.argv[3]);
  console.log(`frames ${pick[0]}..${pick.at(-1)} -> ${process.argv[3]}`);
}
