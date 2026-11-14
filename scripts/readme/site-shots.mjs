/**
 * The portfolio's own screenshots for its README panels: the built site (dist/) served from this
 * process and captured headless, in both editions. Run `npm run build` first.
 *
 *   node scripts/readme/site-shots.mjs      writes scripts/readme/shots/portfolio-<name>-<edition>.webp
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromePath } from '../perf/chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../../dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/ not found: run `npm run build` first.');
const out = join(here, 'shots');
mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  let file = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(dist) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// name, path, viewport, and how long the section takes to settle (reveals, the showcase's first recording).
const SHOTS = [
  ['intro', '/', DESKTOP, 2500],
  ['work', '/#work', DESKTOP, 6000],
  ['experience', '/#experience', DESKTOP, 3000],
  ['case', '/work/katarch/', DESKTOP, 4000],
  ['mobile', '/', PHONE, 2500],
];

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars'] });
for (const edition of ['light', 'dark']) {
  for (const [name, path, viewport, settle] of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: edition }]);
    await page.goto(origin + path, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, settle));
    await page.screenshot({ path: join(out, `portfolio-${name}-${edition}.webp`), type: 'webp', quality: 92 });
    await page.close();
    console.log(`portfolio-${name}-${edition}.webp`);
  }
}
await browser.close();
server.close();
