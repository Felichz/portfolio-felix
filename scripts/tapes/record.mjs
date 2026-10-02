// Records a tape: runs an app's scene in headless Chrome with the recorder (recorder.js) inside the
// page, and writes public/tapes/<id>.json. The app is served from public/apps/<id>/ (the vendored
// build), on localhost, by a tiny static server started here.
//
// Usage: node scripts/tapes/record.mjs <id>   (CHROME overrides the browser path)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
const browserUA = browser.userAgent().then((ua) => ua.replace('HeadlessChrome', 'Chrome'));
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

// A real-time app (PlaySync): its socket is pointed at the real server while recording, and what comes
// in over it is kept, so the live app's stand-in room can replay it (scripts/apps/playsync-room.js).
if (scene.socket)
  await page.evaluateOnNewDocument((target) => {
    const Real = window.WebSocket;
    window.__wsLog = [];
    window.WebSocket = class extends Real {
      constructor(url, protocols) {
        if (/\/ws$/.test(new URL(url, location.href).pathname)) url = target;
        super(url, protocols);
        this.addEventListener('message', (e) => typeof e.data === 'string' && window.__wsLog.push([performance.now(), e.data]));
      }
    };
  }, scene.socket.url);

await page.goto(origin + scene.base + (scene.start ?? ''), { waitUntil: 'networkidle0' });
await scene.setup(page);
await page.waitForSelector(scene.readySelector);
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 400));

// ---- Scene helpers: a cursor that moves like a hand (eased, slightly curved), clicks, rests
let cursor = { x: w * 0.62, y: h * 0.78 };
await page.mouse.move(cursor.x, cursor.y);
await page.evaluate((ignore) => (window.__tapeIgnore = ignore), scene.ignore ?? null);
if (scene.clip) await page.evaluate(() => (window.__tapeClip = true));
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
  /** Clicks the visible button (or link) whose text matches, the way a hand would. */
  async clickText(re, opts) {
    const handle = await page.evaluateHandle(
      (src) => [...document.querySelectorAll('button, a, [role=button], [role=tab]')].find((e) => e.offsetParent !== null && new RegExp(src, 'i').test(((e.getAttribute('aria-label') ?? '') + ' ' + e.textContent).trim())),
      re.source,
    );
    const box = await handle.asElement()?.boundingBox();
    if (!box) throw new Error(`no button matching ${re}`);
    await helpers.moveTo(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(opts?.rest ?? 180);
    await page.mouse.down();
    await sleep(90);
    await page.mouse.up();
  },
  async checkpoint(name) {
    await page.evaluate((n, keys, base, idb) => window.__tapeCheckpoint(n, keys, base, idb), name, scene.storage, scene.base, !!scene.idb);
  },
};

// A frame the tape can't keep (a YouTube player) is filmed while the scene runs, and kept as a clip.
const shots = [];
const cdp = scene.clip ? await page.createCDPSession() : null;
if (cdp) {
  cdp.on('Page.screencastFrame', async (f) => {
    shots.push({ at: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
}
await scene.run(helpers);
if (cdp) await cdp.send('Page.stopScreencast');
const clipRect = scene.clip
  ? await page.evaluate(() => {
      const f = document.querySelector('iframe');
      const r = f.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    })
  : null;
const wall0 = await page.evaluate(() => performance.timeOrigin + window.__tapeT0);
const socketLog = scene.socket ? await page.evaluate(() => window.__wsLog) : null;
const pageT0 = await page.evaluate(() => window.__tapeT0);
const tape = await page.evaluate(() => window.__tapeStop());
await browser.close();
await scene.teardown?.();
server.close();

// The clip: the frames' crop of the player, at 30 fps, starting at the tape time of its first frame.
let clip;
if (shots.length > 1) {
  const dir = mkdtempSync(join(tmpdir(), 'tape-clip-'));
  const list = [];
  shots.forEach((s, i) => {
    writeFileSync(join(dir, `${i}.jpg`), Buffer.from(s.data, 'base64'));
    const next = shots[i + 1]?.at ?? s.at + 33;
    list.push(`file '${i}.jpg'`, `duration ${((next - s.at) / 1000).toFixed(4)}`);
  });
  list.push(`file '${shots.length - 1}.jpg'`);
  writeFileSync(join(dir, 'list.txt'), list.join('\n'));
  const { x, y, w, h } = clipRect;
  const even = (n) => n - (n % 2);
  const width = Math.min(960, even(w));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-vf', `crop=${even(w)}:${even(h)}:${x}:${y},scale=${width}:-2,fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(tapes, `${id}.clip.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  clip = { src: `/tapes/${id}.clip.mp4`, t: Math.round(shots[0].at - wall0) };
}

// Stylesheets from another origin (a font service) came as @import lines, which a constructed
// stylesheet (the player's) refuses: their text goes on the tape instead, fetched as Chrome would.
for (const [line, href] of [...tape.css.matchAll(/@import url\("([^"]+)"\);\n?/g)].map((m) => [m[0], m[1]])) {
  const text = await fetch(href, { headers: { 'user-agent': await browserUA } }).then((r) => r.text(), () => '');
  tape.css = tape.css.replace(line, text + '\n');
}

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
    spa: scene.spa,
    storage: scene.storage,
    themeKey: scene.themeKey,
    restore: scene.restore,
    prefetch,
    ...(exchanges.length ? { network: `/tapes/${id}.net.json` } : {}),
    ...(socketLog ? { socket: { in: socketLog.map(([at, data]) => [Math.round(at - pageT0), data]) } } : {}),
  },
  ...tape,
  ...(clip ? { clip } : {}),
};
mkdirSync(tapes, { recursive: true });
const file = join(tapes, `${id}.json`);
const json = JSON.stringify(out);
writeFileSync(file, json);
if (exchanges.length) writeFileSync(join(tapes, `${id}.net.json`), JSON.stringify(dedupe(exchanges)));
const kinds = {};
for (const e of tape.events) kinds[e[0]] = (kinds[e[0]] ?? 0) + 1;
console.log(
  `tape ${id}: ${(tape.duration / 1000).toFixed(1)}s, ${tape.events.length} events ${JSON.stringify(kinds)}, ` +
    `${tape.checkpoints.length} checkpoints, ${(json.length / 1024).toFixed(0)} KB (${(gzipSync(json).length / 1024).toFixed(0)} KB gzip)`,
);
