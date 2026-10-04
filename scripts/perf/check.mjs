// Functional check of the showcase's live previews: countdown, tape, hover to live, window. Screenshots
// go to scripts/perf/out/check-*.png.
//
//   node scripts/perf/check.mjs                     # functional only
//   IDS=lifeui,lolimpact node scripts/perf/check.mjs --gate          # + frame budgets, exit 1 on breach
//   IDS=lifeui node scripts/perf/check.mjs --gate --throttle         # budgets at 2x CPU throttling
//
// Gate budgets, per interaction phase. Steady phases (use, window, close — everything that renders
// continuously) get the real budget: frame-interval p99 <= 16.7 ms and no gap over 100 ms. Cold-path
// transients (arrive: a slide's first mount and switch; hover: a cold boot's second; open: the
// morph's one capture) are a bounded burst, not a rate: their budget is p99 <= 100 ms and no gap
// over 500 ms — held both unthrottled and at 2x CPU (--throttle), and meant to shrink as the cold
// paths get warmer, never to grow. The page's black box (`__bb`) is read for any freeze dumps it
// caught along the way.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gate = process.argv.includes('--gate');
const throttle = process.argv.includes('--throttle');
const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
  headless: false, defaultViewport: null, userDataDir: process.env.PROFILE || mkdtempSync(join(tmpdir(), 'perf-check-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--lang=en-US', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(/ (?=--)/) : [])],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.evaluateOnNewDocument(() => {
  if (window !== window.top) return;
  try {
    sessionStorage.setItem('perf', '1'); // the page's black box runs only when measuring
  } catch {}
  const F = (window.__frames = []);
  const tick = (t) => { F.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
if (throttle) await page.emulateCPUThrottling(2);
// The gate measures this machine, so it first asks whether the machine is free to measure: a blank
// page's frames are the ceiling. Under a game client, a video call, a hundred tabs — whatever keeps
// the CPU busy — the numbers would be about that, not about the site, and the gate says so instead
// of crying wolf.
await page.goto('about:blank');
const ceiling = await page.evaluate(() => new Promise((done) => {
  const ts = [];
  const tick = (t) => { ts.push(t); ts.length < 61 ? requestAnimationFrame(tick) : done([...ts.slice(1).map((x, i) => x - ts[i])].sort((a, b) => a - b)[30]); };
  requestAnimationFrame(tick);
}));
if (!throttle && ceiling > 8.4) {
  console.log(`GATE: the machine is busy (a blank page holds ${Math.round(1000 / ceiling)} fps; it should hold 240+). Close what's running and run it again — otherwise the numbers would be about that, not about the site.`);
  await browser.close();
  process.exit(2);
}
const ids = (process.env.IDS ?? 'lifeui').split(',');
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(1500);
await page.mouse.move(700, 400, { steps: 5 });
await page.keyboard.press('ArrowDown');
await sleep(2000);

const now = () => page.evaluate(() => performance.now());
const phases = [];
const phase = async (name, fn) => {
  const t0 = await now();
  const extra = (await fn()) ?? {};
  const t1 = await now();
  phases.push({ name, t0, t1, ...extra });
  process.stdout.write(`  ${name}\n`);
};

for (const id of ids) {
  await page.mouse.move(1530, 770);
  await phase(`${id}:arrive`, async () => {
    await page.evaluate((id) => {
      const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
      document.querySelectorAll('[data-go]')[i]?.click();
    }, id);
    await page.mouse.move(1530, 770);
    await sleep(4000);
  });
  const st = await page.evaluate(() => {
    const slide = document.querySelector('.slide[data-state="active"]');
    const plate = slide.querySelector('.plate');
    const tp = plate.querySelector('tape-player');
    const bar = document.querySelector('.rail-item[aria-current="true"] .rail-progress i');
    return { state: plate.dataset.state, t: tp?.currentTime?.toFixed(2), paused: tp?.paused, bar: bar?.getAnimations().map((a) => `${a.playState} ${Math.round(a.currentTime)}`), stage: tp?.frame?.src };
  });
  console.log(id, JSON.stringify(st));
  await page.screenshot({ path: join(out, `check-${id}-tape.png`) });
  const r = await page.evaluate(() => { const b = document.querySelector('.slide[data-state="active"] .plate').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  const wiggle = async (ms) => {
    const end = Date.now() + ms;
    let a = 0;
    while (Date.now() < end) { a += 0.4; await page.mouse.move(r.x + Math.cos(a) * 30, r.y + Math.sin(a) * 30); await sleep(10); }
  };
  await phase(`${id}:hover`, async () => {
    const t0 = await now();
    await page.mouse.move(r.x - 40, r.y, { steps: 4 });
    let live = false;
    for (let i = 0; i < 250 && !live; i++) {
      await wiggle(60);
      live = await page.evaluate(() => document.querySelector('.slide[data-state="active"] .plate').hasAttribute('data-live'));
    }
    return { goLive: live ? Math.round((await now()) - t0) : null };
  });
  console.log('  live', phases.at(-1)?.goLive ?? null, 'ms after hover; out-of-process frames:', (await (await browser.target().createCDPSession()).send('Target.getTargets')).targetInfos.filter((t) => t.type === 'iframe').map((t) => t.url.replace(/^https?:\/\//, '')).join(' '));
  await page.screenshot({ path: join(out, `check-${id}-live.png`) });
  await phase(`${id}:use`, () => wiggle(2000));
  const zoom = await page.evaluate(() => {
    const g = document.querySelector('.slide[data-state="active"] .plate .lights--left .light--zoom');
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  if (zoom) {
    await phase(`${id}:open`, async () => {
      await page.mouse.move(zoom.x, zoom.y, { steps: 4 });
      await page.mouse.click(zoom.x, zoom.y);
      await sleep(1200);
    });
    await phase(`${id}:window`, () => wiggle(2000));
    await phase(`${id}:close`, async () => {
      await page.keyboard.press('Escape');
      await sleep(1200);
    });
  }
  await page.mouse.move(1530, 770);
  await sleep(500);
}

// ---- Frame budgets
const frames = await page.evaluate(() => window.__frames.slice());
const bb = await page.evaluate(() => (window.__bb ? window.__bb.dumps : []));
const VSYNC = 1000 / 240;
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : 0);
let bad = 0;
console.log('\nphase               fps  p99ms  maxms  janky  dropped' + (gate ? '  gate' : ''));
for (const ph of phases) {
  const f = frames.filter((t) => t >= ph.t0 && t <= ph.t1);
  const iv = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
  const span = Math.max(1, ph.t1 - ph.t0);
  const p99 = +pct(iv, 0.99).toFixed(1);
  const max = Math.round(iv.at(-1) ?? 0);
  const janky = +((iv.filter((d) => d > 1000 / 60).reduce((a, d) => a + d, 0) / span) * 100).toFixed(1);
  const dropped = iv.reduce((a, d) => a + Math.max(0, Math.round(d / VSYNC) - 1), 0);
  const transient = /:(arrive|hover|open)$/.test(ph.name);
  const [p99Max, maxMax] = transient ? [100, 500] : [16.7, 100];
  const ok = p99 <= p99Max && max <= maxMax;
  if (gate && !ok) bad++;
  console.log(ph.name.padEnd(18), String(Math.round(f.length / (span / 1000))).padStart(4), String(p99).padStart(6), String(max).padStart(6), (janky + '%').padStart(6), String(dropped).padStart(7), gate ? '  ' + (ok ? 'ok' : 'BREACH') : '');
}
if (bb.length) console.log('\nblackbox dumps:', JSON.stringify(bb).slice(0, 1500));
console.log('errors:', errors);
await browser.close();
if (gate) {
  console.log(bad || errors.length ? `\nGATE: FAIL (${bad} phase(s) over budget${errors.length ? `, ${errors.length} page errors` : ''})` : '\nGATE: PASS');
  process.exit(bad || errors.length ? 1 : 0);
}
