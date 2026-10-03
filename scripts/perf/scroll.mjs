// FPS while scrolling the portfolio itself: slow wheel down through every panel, then fling back up.
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.BASE ?? 'http://localhost:4391';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, defaultViewport: null,
  args: ['--window-size=1600,1047', '--window-position=0,0', '--lang=en-US', '--no-first-run',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinocclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
await page.evaluateOnNewDocument(() => {
  if (window !== window.top) return;
  const P = (window.__perf = { frames: [], loaf: [], marks: [] });
  const tick = (t) => { P.frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        P.loaf.push({
          t: e.startTime, d: e.duration, b: e.blockingDuration,
          scripts: e.scripts.map((s) => ({ d: s.duration, src: s.sourceURL, fn: s.sourceFunctionName, inv: s.invoker, win: s.windowAttribution })),
        });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  P.mark = (w) => P.marks.push({ t: performance.now(), what: w });
  // Mark each panel as it becomes the deck's active one.
  document.addEventListener('deck:change', (e) => P.mark('panel:' + e.detail.id));
});
await page.goto(BASE + '/', { waitUntil: 'load' });
await sleep(2500);
await page.mouse.move(800, 500);
await page.mouse.wheel({ deltaY: 60 }); // first input
await sleep(1200);

const phases = [];
const phase = async (name, fn) => {
  const t0 = await page.evaluate(() => performance.now());
  const w0 = Date.now();
  await fn();
  const t1 = await page.evaluate(() => performance.now());
  phases.push({ name, t0, t1, wall: Date.now() - w0 });
  console.log('  phase done:', name);
};

// Slow, steady scroll: 120px per wheel tick every 28ms, in bursts of 20 ticks, until the bottom.
await phase('scroll-down-slow', async () => {
  for (let burst = 0; burst < 40; burst++) {
    await page.evaluate(() => window.__perf.mark('wheel'));
    for (let i = 0; i < 20; i++) { await page.mouse.wheel({ deltaY: 120 }); await sleep(28); }
    const atEnd = await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4);
    await sleep(700);
    if (atEnd) break;
  }
});
await sleep(1500);
// Fling up: big deltas, fast.
await phase('scroll-up-fast', async () => {
  for (let burst = 0; burst < 12; burst++) {
    for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: -600 }); await sleep(12); }
    const atTop = await page.evaluate(() => scrollY <= 4);
    await sleep(500);
    if (atTop) break;
  }
});

// ---- Analysis (same shape as live.mjs)
const perf = await page.evaluate(() => window.__perf);
const VSYNC = 1000 / 240;
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] : 0);
console.log('\nphase               fps  p95ms  maxms  janky  dropped   loaf  top-scripts-in-long-frames');
for (const ph of phases) {
  const f = perf.frames.filter((t) => t >= ph.t0 && t <= ph.t1);
  const iv = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
  const span = ph.t1 - ph.t0;
  const lo = perf.loaf.filter((e) => e.t >= ph.t0 && e.t <= ph.t1);
  const by = {};
  for (const e of lo) for (const s of e.scripts) {
    const k = `${(s.src || s.inv || '?').replace(BASE, '').replace(/\?.*$/, '').slice(0, 60)}${s.fn ? ' ' + s.fn : ''} [${s.win}]`;
    by[k] = (by[k] ?? 0) + s.d;
  }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, d]) => `${Math.round(d)}ms ${k}`).join('; ');
  console.log(
    ph.name.padEnd(18), String(Math.round(f.length / (span / 1000))).padStart(4),
    pct(iv, 0.95).toFixed(1).padStart(6), String(Math.round(iv.at(-1) ?? 0)).padStart(5),
    ((iv.filter((d) => d > 1000 / 60).reduce((a, d) => a + d, 0) / span) * 100).toFixed(1).padStart(5) + '%',
    String(iv.reduce((a, d) => a + Math.max(0, Math.round(d / VSYNC) - 1), 0)).padStart(7),
    String(lo.length).padStart(5), ' ' + top,
  );
}
// The worst individual gaps during scrolling, with the nearest mark (what was happening).
const all = perf.frames;
const gaps = [];
for (let i = 1; i < all.length; i++) if (all[i] - all[i - 1] > 12) gaps.push({ gap: all[i] - all[i - 1], t: all[i] });
gaps.sort((a, b) => b.gap - a.gap);
console.log('\nworst frame gaps while scrolling (gap ms @ s, nearest event):');
for (const g of gaps.slice(0, 10)) {
  const near = perf.marks.filter((m) => Math.abs(m.t - g.t) < 900).map((m) => m.what);
  const loaf = perf.loaf.filter((e) => e.t <= g.t && g.t - e.t < 600).at(-1);
  console.log(`  ${Math.round(g.gap)}ms @ ${(g.t / 1000).toFixed(1)}s  ${near.join(',') || '-'}${loaf ? `  loaf ${Math.round(loaf.d)}ms` : ''}`);
}
writeFileSync('scripts/perf/out/scroll.json', JSON.stringify({ phases, perf }, null, 1));
await browser.close();
