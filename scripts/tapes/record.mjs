// Records a tape: runs an app's scene in headless Chrome with the recorder (recorder.js) inside the
// page, and writes public/tapes/<id>.json. The app is served from public/apps/<id>/ (the vendored
// build), on localhost, by a tiny static server started here.
//
// Usage: node scripts/tapes/record.mjs <id>   (CHROME overrides the browser path)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pub = resolve(root, 'public');
const id = process.argv[2];
if (!id) throw new Error('Usage: node scripts/tapes/record.mjs <id>');
const scene = (await import(pathToFileURL(resolve(here, 'scenes', `${id}.mjs`)).href)).default;

// ---- Static server over public/, with the app's routes falling back to its index.html
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(pub, path);
  if (!file.startsWith(pub)) return res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(file, 'index.html');
    file = existsSync(index) ? index : join(pub, scene.base, 'index.html');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, 'localhost', r));
const origin = `http://localhost:${server.address().port}`;

const chrome =
  process.env.CHROME ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync);
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--lang=en-US', '--hide-scrollbars', '--font-render-hinting=none'] });
const page = await browser.newPage();
const [w, h] = scene.viewport;
await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });

// Pin the clock (like cy.clock, but still running) so every recording shows the same time of day.
await page.evaluateOnNewDocument((pin) => {
  const RealDate = Date;
  const offset = (() => {
    const d = new RealDate();
    d.setHours(pin[0], pin[1], 0, 0);
    return d.getTime() - RealDate.now();
  })();
  class PinnedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  window.Date = new Proxy(PinnedDate, { apply: () => new PinnedDate().toString() });
}, scene.clock ?? [15, 24]);

await page.goto(origin + scene.base, { waitUntil: 'networkidle0' });
await scene.setup(page);
await page.waitForSelector(scene.readySelector);
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 400));

// ---- Scene helpers: a cursor that moves like a hand (eased, slightly curved), clicks, rests
let cursor = { x: w * 0.62, y: h * 0.78 };
await page.mouse.move(cursor.x, cursor.y);
await page.evaluate(readFileSync(resolve(here, 'recorder.js'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const helpers = {
  page,
  wait: sleep,
  async moveTo(x, y, ms) {
    const from = { ...cursor };
    const dist = Math.hypot(x - from.x, y - from.y);
    const duration = ms ?? Math.min(900, 260 + dist * 0.55);
    // A gentle arc: the path bows sideways a little, like a wrist turning.
    const bow = Math.min(60, dist * 0.12) * (from.x < x ? 1 : -1);
    const start = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - start) / duration);
      const e = ease(k);
      const nx = from.x + (x - from.x) * e - ((y - from.y) / (dist || 1)) * bow * Math.sin(Math.PI * e);
      const ny = from.y + (y - from.y) * e + ((x - from.x) / (dist || 1)) * bow * Math.sin(Math.PI * e);
      await page.mouse.move(nx, ny);
      if (k === 1) break;
      await sleep(14);
    }
    cursor = { x, y };
  },
  async point(selector) {
    const box = await page.$eval(selector, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await helpers.moveTo(box.x, box.y);
    return box;
  },
  async click(selector, { rest = 180 } = {}) {
    await helpers.point(selector);
    await sleep(rest);
    await page.mouse.down();
    await sleep(90);
    await page.mouse.up();
  },
  async checkpoint(name) {
    await page.evaluate((n, keys, base) => window.__tapeCheckpoint(n, keys, base), name, scene.storage, scene.base);
  },
};

await scene.run(helpers);
const tape = await page.evaluate(() => window.__tapeStop());
await browser.close();
server.close();

// Everything the player and the thaw need, in one file.
const index = readFileSync(join(pub, scene.base, 'index.html'), 'utf8');
const prefetch = [...index.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const out = {
  v: 1,
  id,
  viewport: scene.viewport,
  themeAttr: scene.themeAttr,
  app: { entry: scene.base, readySelector: scene.readySelector, storage: scene.storage, themeKey: scene.themeKey, prefetch },
  ...tape,
};
mkdirSync(join(pub, 'tapes'), { recursive: true });
const file = join(pub, 'tapes', `${id}.json`);
const json = JSON.stringify(out);
writeFileSync(file, json);
const kinds = {};
for (const e of tape.events) kinds[e[0]] = (kinds[e[0]] ?? 0) + 1;
console.log(
  `tape ${id}: ${(tape.duration / 1000).toFixed(1)}s, ${tape.events.length} events ${JSON.stringify(kinds)}, ` +
    `${tape.checkpoints.length} checkpoints, ${(json.length / 1024).toFixed(0)} KB (${(gzipSync(json).length / 1024).toFixed(0)} KB gzip)`,
);
