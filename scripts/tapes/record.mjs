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
const id = process.argv[2];
if (!id) throw new Error('Usage: node scripts/tapes/record.mjs <id>');
const scene = (await import(pathToFileURL(resolve(here, 'scenes', `${id}.mjs`)).href)).default;
// What to serve: public/ for vendored apps, or the built site itself (dist/) for its own tape.
const pub = resolve(root, scene.root ?? 'public');
const tapes = resolve(root, 'public', 'tapes');

// ---- Static server over public/, with the app's routes falling back to its index.html
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.txt': 'text/plain', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm' };
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
if (scene.clock !== null) await page.evaluateOnNewDocument((pin) => {
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

// The app's backend, for apps that have one: requests can be pointed elsewhere while recording
// (scene.network.rewrite), and what comes back is kept, so the live app gets the same answers.
const exchanges = [];
if (scene.network) {
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const to = scene.network.rewrite?.(r.url());
    if (to) r.continue({ url: to });
    else r.continue();
  });
  page.on('requestfinished', async (r) => {
    if (!scene.network.match.test(r.url())) return;
    const res = r.response();
    if (!res) return;
    const u = new URL(r.url());
    try {
      exchanges.push({ m: r.method(), u: u.origin === origin ? u.pathname + u.search : u.href, s: res.status(), h: res.headers()['content-type'] ?? '', b: await res.text() });
    } catch {}
  });
}

await page.goto(origin + scene.base + (scene.start ?? ''), { waitUntil: 'networkidle0' });
await scene.setup(page);
await page.waitForSelector(scene.readySelector);
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 400));

// ---- Scene helpers: a cursor that moves like a hand (eased, slightly curved), clicks, rests
let cursor = { x: w * 0.62, y: h * 0.78 };
await page.mouse.move(cursor.x, cursor.y);
await page.evaluate((ignore) => (window.__tapeIgnore = ignore), scene.ignore ?? null);
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
    await page.evaluate((n, keys, base, idb) => window.__tapeCheckpoint(n, keys, base, idb), name, scene.storage, scene.base, !!scene.idb);
  },
};

await scene.run(helpers);
const tape = await page.evaluate(() => window.__tapeStop());
await browser.close();
server.close();

// One answer per request (the last one: the state the scene ended in).
function dedupe(list) {
  const seen = new Map();
  for (const x of list) seen.set(`${x.m} ${x.u}`, x);
  return [...seen.values()];
}

// Everything the player and the live app need, in one file.
const index = readFileSync(join(pub, scene.base, 'index.html'), 'utf8');
// Files to prefetch on intent. Not for this site's own tape: it is already loaded, and its hashed
// file names change with every build.
const prefetch = scene.prefetch === false ? [] : [...index.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const out = {
  v: 1,
  id,
  viewport: scene.viewport,
  themeAttr: scene.themeAttr,
  app: {
    entry: scene.base,
    readySelector: scene.readySelector,
    storage: scene.storage,
    themeKey: scene.themeKey,
    restore: scene.restore,
    prefetch,
    ...(exchanges.length ? { network: dedupe(exchanges) } : {}),
  },
  ...tape,
};
mkdirSync(tapes, { recursive: true });
const file = join(tapes, `${id}.json`);
const json = JSON.stringify(out);
writeFileSync(file, json);
const kinds = {};
for (const e of tape.events) kinds[e[0]] = (kinds[e[0]] ?? 0) + 1;
console.log(
  `tape ${id}: ${(tape.duration / 1000).toFixed(1)}s, ${tape.events.length} events ${JSON.stringify(kinds)}, ` +
    `${tape.checkpoints.length} checkpoints, ${(json.length / 1024).toFixed(0)} KB (${(gzipSync(json).length / 1024).toFixed(0)} KB gzip)`,
);
