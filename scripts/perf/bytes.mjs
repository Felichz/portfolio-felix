/**
 * What actually crosses the wire, phase by phase and frame by frame: the bytes a visitor pays for, and
 * which of them they never see. Nothing else in the harness counts bytes; the traces count frames.
 *
 *   node scripts/perf/bytes.mjs                       # the whole tour, cold profile
 *   BASE='http://[::1]:4391' node scripts/perf/bytes.mjs
 *   PHASES=load,input,theme node scripts/perf/bytes.mjs   # which phases to run
 *   IDS=lifeui,lolimpact node scripts/perf/bytes.mjs      # which products the tour visits
 *
 * A fresh profile every run, so nothing comes from cache. Resources are read from every frame the page
 * can reach: a stage in its own process still reports its own timings, and its sizes are only readable
 * there (cross-origin resource timing zeroes them).
 *
 * The lazy images get a verdict of their own. `warm.ts` fetches `img.currentSrc || img.src`, and an image
 * the visitor hasn't reached yet has no `currentSrc`, so it warms the `src` fallback — one fixed file,
 * usually the heaviest format of the set. Each fallback the tour actually fetched is priced against the
 * candidate the browser would have chosen for that box, read off the srcset and the file on disk.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, windowPosition } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4391';
const IDS = (process.env.IDS ?? 'katarch,knowgraph,lifeui,lolimpact,playsync').split(',');
const PHASES = (process.env.PHASES ?? 'load,input,tour,hover,window,theme').split(',');
const DIST = process.env.DIST ?? join(root, 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (n) => (n / 1024).toFixed(1).padStart(8);

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'bytes-')),
  args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
if (process.env.THROTTLE) await page.emulateCPUThrottling(Number(process.env.THROTTLE));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

/** A frame's own timings, on the wall clock, plus its document. New ones only, since the last look. */
const counts = new Map();
const harvest = async () => {
  const fresh = [];
  const live = new Set();
  for (const f of page.frames()) {
    const got = await f
      .evaluate(() => ({
        origin: location.origin,
        timeOrigin: performance.timeOrigin,
        res: performance.getEntriesByType('resource').map((e) => ({
          name: e.name, it: e.initiatorType, start: e.startTime, dur: e.duration, xfer: e.transferSize, enc: e.encodedBodySize,
        })),
        nav: performance.getEntriesByType('navigation').map((e) => ({
          name: location.href, it: 'document', start: e.startTime, dur: e.duration, xfer: e.transferSize, enc: e.encodedBodySize,
        })),
      }))
      .catch(() => null);
    if (!got) continue;
    live.add(f);
    const rows = [...got.nav, ...got.res];
    const seen = counts.get(f) ?? 0;
    for (const e of rows.slice(seen)) fresh.push({ ...e, frame: got.origin, at: got.timeOrigin + e.start });
    counts.set(f, rows.length);
  }
  for (const f of [...counts.keys()]) if (!live.has(f)) counts.delete(f);
  return fresh;
};

const FONTS = /\.(woff2?|ttf|otf)$/i;
const kind = (e) => {
  const p = e.name.split('?')[0];
  if (e.it === 'document' || /\.x?html?$/i.test(p)) return 'doc';
  if (FONTS.test(p)) return 'font';
  if (/\.(mp4|webm|ogv)$/i.test(p) || e.it === 'video') return 'media';
  if (/\.(mp3|wav|ogg|m4a)$/i.test(p)) return 'audio';
  if (/\.(avif|webp|jpe?g|png|gif|svg|ico)$/i.test(p) || e.it === 'img') return 'image';
  if (/\.(mjs|cjs|js)$/i.test(p) || e.it === 'script') return 'js';
  if (/\.(css)$/i.test(p) || e.it === 'css') return 'css';
  if (e.it === 'fetch' || e.it === 'xmlhttprequest') return /\.json$/i.test(p) ? 'json' : 'fetch';
  return 'other';
};

const marks = [];
const phase = async (name, fn) => {
  const t0 = Date.now();
  await fn();
  const rows = await harvest();
  marks.push({ name, t0, t1: Date.now(), rows });
  process.stdout.write(`  ${name}: ${(rows.reduce((a, e) => a + e.xfer, 0) / 1024).toFixed(0)} KB over ${rows.length} requests\n`);
};

const rail = (id) => page.evaluate((id) => {
  const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
  document.querySelectorAll('[data-go]')[i]?.click();
}, id);
const centre = () => page.evaluate(() => {
  const r = document.querySelector('.slide[data-state="active"] .plate')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 800, y: 500 };
});
const wiggle = async (ms) => {
  const r = await centre();
  const end = Date.now() + ms;
  let a = 0;
  while (Date.now() < end) { a += 0.4; await page.mouse.move(r.x + Math.cos(a) * 30, r.y + Math.sin(a) * 30); await sleep(10); }
};
const click = async (sel) => {
  const p = await page.evaluate((sel) => {
    const b = document.querySelector(sel)?.getBoundingClientRect();
    return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
  }, sel);
  if (!p) return false;
  await page.mouse.click(p.x, p.y);
  return true;
};

// ---- The tour
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
const allRows = [];
const step = async (name, fn) => { await phase(name, fn); allRows.push(...marks.at(-1).rows); };

await step('load', () => sleep(4000));
if (PHASES.includes('input'))
  await step('input', async () => {
    await page.mouse.move(1530, 770, { steps: 4 });
    await page.mouse.wheel({ deltaY: 60 });
    await sleep(8000); // the first input's sweep: stages built in turn, images warmed
  });
if (PHASES.includes('tour'))
  for (const id of IDS) await step(`tour:${id}`, async () => { await rail(id); await sleep(5000); await page.mouse.move(1530, 770); });
if (PHASES.includes('hover')) {
  await step('hover:park', () => sleep(4000));
  await step('hover:live', () => wiggle(7000));
}
if (PHASES.includes('window')) {
  const zoom = await page.evaluate(() => {
    const g = document.querySelector('.slide[data-state="active"] .plate .lights--left .light--zoom');
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await step('window', async () => {
    if (!zoom) return void errors.push('no zoom light to click');
    await page.mouse.move(zoom.x, zoom.y, { steps: 30 });
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate((z) => !!document.elementFromPoint(z.x, z.y)?.closest('.light--zoom'), zoom)) break;
      await page.mouse.move(zoom.x + (i % 2 ? 1 : -1), zoom.y);
      await sleep(50);
    }
    await page.mouse.click(zoom.x, zoom.y);
    await sleep(7000);
  });
  await step('window:close', async () => { await page.keyboard.press('Escape'); await sleep(3000); });
}
if (PHASES.includes('theme')) {
  await step('theme', async () => { if (!(await click('[data-theme-toggle]'))) errors.push('no theme toggle'); await sleep(7000); });
  await step('theme:back', async () => { await click('[data-theme-toggle]'); await sleep(7000); });
}

// ---- Report, by phase and kind
const COLS = ['doc', 'image', 'js', 'css', 'font', 'json', 'media', 'audio', 'fetch', 'other'];
console.log(`\n${'phase'.padEnd(16)}${'total'.padStart(8)}  ${COLS.map((c) => c.padStart(7)).join(' ')}   frames`);
for (const m of marks) {
  const t = {};
  for (const e of m.rows) t[kind(e)] = (t[kind(e)] ?? 0) + e.xfer;
  console.log(
    m.name.padEnd(16), kb(m.rows.reduce((a, e) => a + e.xfer, 0)),
    COLS.map((c) => kb(t[c] ?? 0)).join(' '),
    '  ', new Set(m.rows.map((e) => e.frame)).size,
  );
}
console.log(`${'ALL'.padEnd(16)}${kb(allRows.reduce((a, e) => a + e.xfer, 0))} KB over ${allRows.length} requests`);

// ---- The warmed fallbacks, priced against the candidate the browser would pick
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('img')].map((i) => {
    const set = (i.getAttribute('srcset') ?? '')
      .split(',')
      .map((p) => p.trim().split(/\s+/))
      .filter(([u]) => u)
      .map(([u, w]) => ({ url: new URL(u, location.href).href, w: parseInt(w) || 0 }));
    const av = (i.parentElement?.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? '')
      .split(',').map((p) => p.trim().split(/\s+/)).filter(([u]) => u).map(([u, w]) => ({ url: new URL(u, location.href).href, w: parseInt(w) || 0 }));
    return {
      src: new URL(i.src, location.href).href, current: i.currentSrc ? new URL(i.currentSrc, location.href).href : '',
      loading: i.loading, complete: i.complete, w: Math.round(i.getBoundingClientRect().width),
      h: Math.round(i.getBoundingClientRect().height), dpr: devicePixelRatio, set, av,
    };
  }),
);
const onDisk = (url) => {
  try {
    return statSync(join(DIST, new URL(url).pathname)).size;
  } catch { return 0; }
};
const pick = (list, cssPx) => {
  if (!list.length) return null;
  const need = cssPx;
  const enough = list.filter((c) => c.w >= need).sort((a, b) => a.w - b.w)[0];
  return enough ?? list.sort((a, b) => b.w - a.w)[0];
};
const fetched = new Set(allRows.filter((e) => kind(e) === 'image').map((e) => e.name));
const rows = [];
for (const i of imgs) {
  if (!fetched.has(i.src)) continue; // the fallback never came over the wire this run
  const cand = i.av.length ? i.av : i.set;
  const would = pick(cand, Math.max(1, Math.round(i.w * i.dpr)));
  const fbBytes = onDisk(i.src);
  const wouldBytes = would ? onDisk(would.url) : 0;
  if (!would || !wouldBytes) continue;
  rows.push({ box: `${i.w}x${i.h}@${i.dpr}`, file: new URL(i.src).pathname, fb: fbBytes, alt: wouldBytes, altUrl: new URL(would.url).pathname, altW: would.w });
}
const wasted = rows.reduce((a, r) => a + Math.max(0, r.fb - r.alt), 0);
console.log(`\nfallback warmed where a lighter candidate fits (overpaying ${kb(wasted)} KB over ${rows.length} fetch(es)):`);
for (const r of rows.sort((a, b) => b.fb - b.alt - (a.fb - a.alt)).slice(0, 15))
  console.log(kb(r.fb), 'KB', 'fits', kb(r.alt), `@${r.altW}w`, r.box.padEnd(14), r.file);

console.log('\nheaviest over the tour:');
const byFile = new Map();
for (const e of allRows) {
  const k = `${kind(e)} ${e.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 78)} [${e.frame.replace(/^https?:\/\//, '')}]`;
  const v = byFile.get(k) ?? { xfer: 0, n: 0 };
  byFile.set(k, { xfer: v.xfer + e.xfer, n: v.n + 1 });
}
for (const [k, v] of [...byFile].sort((a, b) => b[1].xfer - a[1].xfer).slice(0, 22))
  console.log(kb(v.xfer), 'KB', `n=${String(v.n).padStart(2)}`, k);

// What the page actually did, so an empty byte column reads as "that never happened" and not as "it
// cost nothing".
console.log(
  'state:',
  JSON.stringify(
    await page.evaluate(() => ({
      live: document.querySelectorAll('.plate[data-live]').length,
      stages: document.querySelectorAll('iframe.stage-frame').length,
      window: !!document.querySelector('.thaw'),
    })),
  ),
);

console.log('\nerrors:', errors);
writeFileSync(join(out, 'bytes.json'), JSON.stringify({ BASE, IDS, PHASES, marks, imgs, rows, wasted }, null, 1));
await browser.close();
