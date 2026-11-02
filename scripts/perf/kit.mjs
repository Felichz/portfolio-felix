// What the ledger and the frame count share: a build served on [::1] (stages in the page's process,
// as deployed), Chrome off screen, and the hand that drives the showcase (go live, aim at the lights
// through the plate's tilt, read what is on screen).
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import sourceMap from 'source-map-js';
import { chromePath, windowPosition } from './chrome.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };

/** Serves a build on [::1] at a free port; resolves to its base URL and a close(). */
export async function serve(dist) {
  const server = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = normalize(join(dist, p));
    if (!f.startsWith(dist)) return res.writeHead(403).end();
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) {
      // The vendored apps are single-page apps under /apps/<id>/.
      const m = p.match(/^\/apps\/([^/]+)\//);
      const spa = m && join(dist, 'apps', m[1], 'index.html');
      if (!spa || !existsSync(spa)) return res.writeHead(404).end();
      f = spa;
    }
    const size = statSync(f).size;
    const type = TYPES[extname(f)] ?? 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? +range[1] : 0;
      const end = range[2] ? +range[2] : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
      return createReadStream(f, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
    createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '::1', r));
  return { base: `http://[::1]:${server.address().port}`, close: () => server.close() };
}

/** Chrome, headful and off screen (SHOW=1 to see it, HEADLESS=1 for true headless). */
export function launch(tag, { profile } = {}) {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: !!process.env.HEADLESS,
    defaultViewport: null,
    // PROFILE=<dir> keeps one profile across runs: its caches (the GPU's compiled shaders among them)
    // stay warm, as in a visitor's own browser. A fresh one starts cold.
    userDataDir: profile ?? (process.env.PROFILE || mkdtempSync(join(tmpdir(), `perf-${tag}-`))),
    args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion', '--disable-background-timer-throttling'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
}

/** The hand on the showcase. */
export function hand(page) {
  const plateBox = () => page.evaluate(() => {
    const r = document.querySelector('.slide[data-state="active"] .plate')?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const isLive = () => page.evaluate(() => !!document.querySelector('.slide[data-state="active"] .plate')?.hasAttribute('data-live'));
  const wiggle = async (at, ms) => {
    const end = Date.now() + ms;
    let a = 0;
    while (Date.now() < end) {
      a += 0.4;
      await page.mouse.move(at.x + Math.cos(a) * 30, at.y + Math.sin(a) * 30);
      await sleep(16);
    }
  };
  const goLive = async () => {
    const at = await plateBox();
    await page.mouse.move(at.x, at.y, { steps: 6 });
    for (let i = 0; i < 80 && !(await isLive()); i++) await wiggle(at, 80);
    return at;
  };
  /** Clicks the green light. The lights show on the pointer's side, and the plate tilts toward the
      pointer, so the button moves as the pointer comes: aim at the set on show, again until the
      pointer is on it. */
  const clickZoom = async () => {
    const zoom = () => page.evaluate(() => {
      const pair = document.querySelector('.slide[data-state="active"] .plate .lights-pair');
      const r = pair?.querySelector(`.lights--${pair.dataset.side === 'right' ? 'right' : 'left'} .light--zoom`)?.getBoundingClientRect();
      return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const on = (at) => page.evaluate((z) => !!document.elementFromPoint(z.x, z.y)?.closest('.light--zoom'), at);
    let at = await zoom();
    await page.mouse.move(at.x, at.y, { steps: 8 });
    for (let i = 0; i < 20 && !(await on(at)); i++) {
      await sleep(30);
      at = await zoom();
      await page.mouse.move(at.x, at.y);
    }
    await page.mouse.click(at.x, at.y);
  };
  return {
    plateBox,
    isLive,
    wiggle,
    goLive,
    clickZoom,
    activeHref: () => page.evaluate(() => document.querySelector('.slide[data-state="active"] .slide-media')?.getAttribute('href') ?? ''),
    windowOpen: () => page.evaluate(() => !!document.querySelector('.thaw.landed')),
    theme: () => page.evaluate(() => document.documentElement.dataset.theme),
    deckTop: () => page.evaluate(() => document.querySelector('[data-deck]').scrollTop),
  };
}

/** Where a script position in a build comes from, through its source maps when it has them:
    `src/scripts/live.ts:412 name`, an app (`app:knowgraph`), or the url. `placeTrace` takes a trace's
    1-based position, `place` a CPU profile's 0-based one. */
export function placer(dist, base) {
  const maps = new Map();
  const consumerFor = (url) => {
    if (maps.has(url)) return maps.get(url);
    let c = null;
    try {
      const path = new URL(url).pathname;
      const file = join(dist, path + '.map');
      if (path.startsWith('/_astro/') && existsSync(file)) c = new sourceMap.SourceMapConsumer(JSON.parse(readFileSync(file, 'utf8')));
    } catch {}
    maps.set(url, c);
    return c;
  };
  const place = (url, line, col, name) => {
    if (!url) return { file: '(native)', where: name || '(native)' };
    const app = url.match(/\/apps\/([^/]+)\//);
    if (app) return { file: `app:${app[1]}`, where: `app:${app[1]}` };
    const c = line >= 0 ? consumerFor(url) : null;
    if (c) {
      const o = c.originalPositionFor({ line: line + 1, column: col ?? 0 });
      if (o.source) {
        const file = o.source.replace(/^.*?\/(src\/|node_modules\/)/, '$1').replace(/\?.*$/, '');
        return { file, where: `${file}:${o.line}${o.name || name ? ' ' + (o.name || name) : ''}` };
      }
    }
    const short = url.replace(base, '').replace(/\?.*$/, '');
    return { file: short, where: `${short}:${line + 1}${name ? ' ' + name : ''}` };
  };
  return { place, placeTrace: (s) => place(s.url, (s.lineNumber ?? 1) - 1, (s.columnNumber ?? 1) - 1, s.functionName) };
}
