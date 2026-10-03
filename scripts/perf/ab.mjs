/**
 * A/B of the showcase's steady state: which part of the page costs what. Each variant switches one
 * thing off (by injected CSS or script, no source changes), and variants run alternately, twice:
 *
 *   node scripts/perf/ab.mjs base,noapps,notape,noglass,noprogress,nocursor
 *
 * Moments measured per run: a product playing with its app under it (pointer at rest), a change of
 * product, and the pointer moving over the preview.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:4391';
const variants = (process.argv[2] ?? 'base').split(',');
const rounds = Number(process.env.ROUNDS ?? 2);
const PRODUCT = process.env.PRODUCT ?? 'lifeui';
const NEXT = process.env.NEXT ?? 'lolimpact';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS = {
  noglass: '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
  nocursor: '.tape-cursor { display: none !important; }',
  noshadow: '.plate, .plate *, .slide-media, .slide-media * { box-shadow: none !important; filter: none !important; }',
  noripple: '.light--zoom::after { animation: none !important; }',
  notilt: '.slide-media .plate { transform: none !important; }',
  noclip: '.plate-frame, .plate-motion, .plate { overflow: visible !important; border-radius: 0 !important; }',
  noambient: '.ambient, .cursor-light { display: none !important; }',
};
const SCRIPT = {
  notape: () =>
    customElements.whenDefined('tape-player').then(() => {
      const P = customElements.get('tape-player').prototype;
      P.play = async function () {
        this.dispatchEvent(new Event('playing'));
      };
    }),
  noprogress: () => {
    const set = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (k, ...rest) {
      if (k === '--p') return;
      return set.call(this, k, ...rest);
    };
  },
};

async function run(variant) {
  const parts = variant.split('+');
  const browser = await puppeteer.launch({
    executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync),
    headless: false,
    defaultViewport: null,
    userDataDir: mkdtempSync(join(tmpdir(), 'perf-ab-')),
    args: ['--window-size=1600,1047', '--window-position=0,0', '--lang=en-US', '--no-first-run', '--disable-extensions', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const [page] = await browser.pages();
  const client = await page.createCDPSession();
  await client.send('Performance.enable');
  const bs = await browser.target().createCDPSession();
  if (parts.includes('noapps')) {
    await page.setRequestInterception(true);
    page.on('request', (r) => (/\/apps\/|\.net\.json/.test(r.url()) ? r.abort() : r.continue()));
  }
  await page.evaluateOnNewDocument(
    (css, scripts) => {
      if (window !== window.top) return;
      window.__frames = [];
      const tick = (t) => (window.__frames.push(t), requestAnimationFrame(tick));
      requestAnimationFrame(tick);
      if (css) addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`));
      for (const s of scripts) (0, eval)(`(${s})()`);
    },
    parts.map((p) => CSS[p]).filter(Boolean).join('\n'),
    parts.map((p) => SCRIPT[p]?.toString()).filter(Boolean),
  );
  const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const cpu = async () => {
    const { processInfo } = await bs.send('SystemInfo.getProcessInfo');
    const by = {};
    for (const p of processInfo) by[p.type] = (by[p.type] ?? 0) + p.cpuTime;
    return by;
  };
  const measure = async (fn) => {
    const m0 = await metrics();
    const c0 = await cpu();
    const t0 = await page.evaluate(() => performance.now());
    const w0 = Date.now();
    await fn();
    const wall = (Date.now() - w0) / 1000;
    const t1 = await page.evaluate(() => performance.now());
    const m1 = await metrics();
    const c1 = await cpu();
    const f = await page.evaluate((a, b) => window.__frames.filter((t) => t >= a && t <= b), t0, t1);
    const iv = f.slice(1).map((t, i) => t - f[i]);
    const span = t1 - t0;
    return {
      fps: f.length / (span / 1000),
      janky: iv.filter((d) => d > 1000 / 60).reduce((a, d) => a + d, 0) / span,
      max: Math.max(0, ...iv),
      main: (m1.TaskDuration - m0.TaskDuration) / wall,
      renderer: ((c1.renderer ?? 0) - (c0.renderer ?? 0)) / wall,
      gpu: ((c1.GPU ?? 0) - (c0.GPU ?? 0)) / wall,
    };
  };
  const select = (id) =>
    page.evaluate((id) => {
      const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
      document.querySelectorAll('[data-go]')[i]?.click();
    }, id);
  const wiggle = async (x, y, ms, r) => {
    const end = Date.now() + ms;
    let a = 0;
    while (Date.now() < end) {
      a += 0.35;
      await page.mouse.move(x + Math.cos(a) * r, y + Math.sin(a) * r);
      await sleep(8);
    }
  };
  await sleep(2500);
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await sleep(2000);
  const rest = await measure(() => sleep(2500));
  await page.mouse.move(700, 400, { steps: 10 });
  await page.keyboard.press('ArrowDown');
  await sleep(2500);
  await select(PRODUCT);
  await page.mouse.move(1530, 770);
  await sleep(4500);
  const playing = await measure(() => sleep(4000));
  const change = await measure(async () => {
    await select(NEXT);
    await sleep(3500);
  });
  await select(PRODUCT);
  await sleep(4500);
  const p = await page.evaluate(() => {
    const r = document.querySelector('.slide[data-state="active"] .plate[data-app]')?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(p.x - 40, p.y, { steps: 6 });
  const over = await measure(() => wiggle(p.x, p.y, 3000, 150));
  await browser.close();
  return { rest, playing, change, over };
}

const results = Object.fromEntries(variants.map((v) => [v, []]));
for (let r = 0; r < rounds; r++)
  for (const v of variants) {
    process.stdout.write(`round ${r + 1} ${v}\n`);
    results[v].push(await run(v));
  }
mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', `ab-${Date.now()}.json`), JSON.stringify(results, null, 1));
const avg = (rs, moment, k) => rs.reduce((a, r) => a + r[moment][k], 0) / rs.length;
console.log('\nvariant          moment    fps  janky   max  main%  renderer%  gpu%');
for (const v of variants)
  for (const moment of ['rest', 'playing', 'change', 'over'])
    console.log(
      [
        v.padEnd(16),
        moment.padEnd(8),
        avg(results[v], moment, 'fps').toFixed(0).padStart(5),
        (avg(results[v], moment, 'janky') * 100).toFixed(0).padStart(5) + '%',
        avg(results[v], moment, 'max').toFixed(0).padStart(5),
        (avg(results[v], moment, 'main') * 100).toFixed(0).padStart(5),
        (avg(results[v], moment, 'renderer') * 100).toFixed(0).padStart(9),
        (avg(results[v], moment, 'gpu') * 100).toFixed(0).padStart(5),
      ].join(' '),
    );
