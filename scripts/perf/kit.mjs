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

/** Serves a build on [::1] at a free port (stages in the page's process, as deployed), or on 127.0.0.1
    with HOST=127.0.0.1 (stages load from localhost, another site, each in its own process, as with
    PUBLIC_STAGE_ORIGIN); resolves to its base URL and a close(). */
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
  const host = process.env.HOST ?? '::1';
  await new Promise((r) => server.listen(0, host, r));
  return { base: `http://${host.includes(':') ? `[${host}]` : host}:${server.address().port}`, close: () => server.close() };
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

/** A fresh page on the showcase at a product, its auto-advance off (which product is on screen would
    otherwise depend on how long each step took), the pointer off the plate, settled. */
export async function arrive(page, base, id) {
  await page.goto(`${base}/#work/${id}`, { waitUntil: 'load' });
  await page.evaluate(() => {
    const auto = document.querySelector('[data-auto]');
    if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
  });
  await page.mouse.move(40, 900);
  await sleep(3000);
}

/**
 * The interactions the frame counts repeat, each a `ready` and its steps (each step acts, and says with
 * `did` whether it did what it says, or what went wrong). `id` is the product they run on.
 */
export const cycles = (id) => ({
  window: (h, page) => ({
    ready: async () => {
      if (await h.windowOpen()) {
        await page.keyboard.press('Escape');
        await sleep(1500);
      }
      await h.goLive();
      await sleep(300);
      if (!(await h.isLive())) throw new Error('the preview never went live');
    },
    steps: [
      { name: 'open', act: () => h.clickZoom(), did: async () => ((await h.windowOpen()) ? null : 'the window did not open') },
      // Escape on the page itself (live.ts listens there): pressed for real it goes to the app, which
      // may take it for a dialog of its own, and the step would measure something else.
      { name: 'close', act: () => page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))), did: async () => ((await h.windowOpen()) ? 'the window is still open' : null) },
    ],
  }),
  scroll: (h, page) => {
    let top;
    return {
      // The keys go to the page, not to an app that has focus.
      ready: async () => {
        await page.evaluate(() => document.activeElement?.blur());
        await page.mouse.move(80, 500);
        top = await h.deckTop();
      },
      steps: [
        { name: 'down', act: () => page.keyboard.press('ArrowDown'), did: async () => ((await h.deckTop()) > top ? null : 'the deck did not move down') },
        { name: 'up', act: () => page.keyboard.press('ArrowUp'), did: async () => (Math.abs((await h.deckTop()) - top) < 2 ? null : 'the deck did not come back') },
      ],
    };
  },
  live: (h, page, base) => ({
    ready: async () => {
      await arrive(page, base, id);
    },
    steps: [{ name: 'live', act: () => h.goLive(), did: async () => ((await h.isLive()) ? null : 'the preview never went live') }],
  }),
  product: (h, page) => {
    let from;
    // As a hand does it: the pointer onto the product's item in the rail (which prepares its slide, see
    // preraster in Work.astro), a moment there, then a real click. (A click made from script skipped
    // that, and measured a change no pointer makes.)
    const go = async (d) => {
      const target = await page.evaluate((d) => {
        const go = [...document.querySelectorAll('[data-go]')];
        const i = go.findIndex((b) => b.getAttribute('aria-current') === 'true' || b.closest('[aria-current="true"]'));
        return (i + d + go.length) % go.length;
      }, d);
      const aim = () => page.evaluate((k) => {
        const r = document.querySelectorAll('[data-go]')[k].getBoundingClientRect();
        const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        return { ...at, on: document.elementFromPoint(at.x, at.y)?.closest('[data-go]') === document.querySelectorAll('[data-go]')[k] };
      }, target);
      let at = await aim();
      await page.mouse.move(at.x, at.y, { steps: 6 });
      await sleep(300);
      for (let i = 0; i < 10 && !(at = await aim()).on; i++) await page.mouse.move(at.x, at.y);
      await page.mouse.click(at.x, at.y);
      await sleep(50);
    };
    return {
      ready: async () => {
        await page.mouse.move(1530, 770, { steps: 3 });
        from = await h.activeHref();
      },
      steps: [
        { name: 'next', act: () => go(1), did: async () => ((await h.activeHref()) !== from ? null : 'the showcase stayed on the same product') },
        { name: 'back', act: () => go(-1), did: async () => ((await h.activeHref()) === from ? null : 'the showcase did not come back') },
      ],
    };
  },
  theme: (h, page) => {
    let from;
    return {
      ready: async () => {
        await page.mouse.move(1530, 770, { steps: 3 });
        from = await h.theme();
      },
      steps: [
        { name: 'switch', act: () => page.evaluate(() => document.querySelector('[data-theme-toggle]').click()), did: async () => ((await h.theme()) !== from ? null : 'the theme did not change') },
        { name: 'back', act: () => page.evaluate(() => document.querySelector('[data-theme-toggle]').click()), did: async () => ((await h.theme()) === from ? null : 'the theme did not come back') },
      ],
    };
  },
});
