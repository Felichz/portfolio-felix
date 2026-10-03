/**
 * Measures the home page's showcase with its live apps, in headful Chrome (headless has no real
 * compositor timing). Against a built site served locally (npx astro preview --port 4391):
 *
 *   node scripts/perf/live.mjs [label] [--quick]
 *
 * Phases: load, idle, first input, the work panel, a full auto-advance cycle through the products
 * (pointer at rest), then for each product: select it, hover its preview until the app is live, move
 * over the app, open its window, move in it, close it. For each phase: the top page's frames (rAF
 * intervals), long animation frames with their scripts, main-thread task time, CPU per process type
 * and memory. Writes scripts/perf/out/<label>.json and prints a summary.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:4391';
const label = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'run';
const quick = process.argv.includes('--quick');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(existsSync);
const W = 1600;
const H = 960;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'perf-live-')),
  args: [
    `--window-size=${W},${H + 87}`,
    '--window-position=0,0',
    '--lang=en-US',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    // Keep measuring if the window is covered.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
    ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : []),
  ],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const client = await page.createCDPSession();
await client.send('Performance.enable', { timeDomain: 'timeTicks' });
const bsession = await browser.target().createCDPSession();

await page.evaluateOnNewDocument(() => {
  if (window !== window.top) return;
  const P = (window.__perf = { frames: [], loaf: [], marks: [] });
  const tick = (t) => {
    P.frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        P.loaf.push({
          t: e.startTime,
          d: e.duration,
          b: e.blockingDuration,
          style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
          scripts: e.scripts.map((s) => ({ d: s.duration, src: s.sourceURL, fn: s.sourceFunctionName, inv: s.invoker, type: s.invokerType, win: s.windowAttribution, forced: s.forcedStyleAndLayoutDuration })),
        });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  const mark = (what) => P.marks.push({ t: performance.now(), what });
  P.mark = mark;
  addEventListener('DOMContentLoaded', () => {
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target;
        if (m.type === 'attributes') {
          if (m.attributeName === 'data-state' && el.matches('[data-slide]') && el.dataset.state === 'active') mark('slide:' + el.dataset.id);
          if (m.attributeName === 'data-live') mark((el.hasAttribute('data-live') ? 'live:' : 'unlive:') + el.dataset.app);
        } else {
          for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains('live-app')) mark('boot:' + n.src.split('/apps/')[1]?.split('/')[0]);
          for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList.contains('live-app')) mark('drop:' + n.src.split('/apps/')[1]?.split('/')[0]);
        }
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state', 'data-live'] });
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => page.evaluate(() => performance.now());
const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const procs = async () => {
  const { processInfo } = await bsession.send('SystemInfo.getProcessInfo');
  return processInfo;
};
const memoryOf = (pids) => {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id) $($_.PrivateMemorySize64)" }`], { encoding: 'utf8' });
    return Object.fromEntries(out.trim().split(/\r?\n/).filter(Boolean).map((l) => l.split(' ').map(Number)));
  } catch {
    return {};
  }
};

const phases = [];
async function phase(name, fn) {
  const m0 = await metrics();
  const p0 = await procs();
  const t0 = await now();
  const w0 = Date.now();
  const extra = (await fn()) ?? {};
  const t1 = await now();
  const wall = Date.now() - w0;
  const m1 = await metrics();
  const p1 = await procs();
  const cpu = {};
  for (const p of p1) {
    const before = p0.find((q) => q.id === p.id)?.cpuTime ?? 0;
    cpu[p.type] = (cpu[p.type] ?? 0) + (p.cpuTime - before);
  }
  const mem = memoryOf(p1.map((p) => p.id));
  const memBy = {};
  for (const p of p1) memBy[p.type] = (memBy[p.type] ?? 0) + (mem[p.id] ?? 0);
  phases.push({
    name,
    t0,
    t1,
    wall,
    extra,
    task: m1.TaskDuration - m0.TaskDuration,
    script: m1.ScriptDuration - m0.ScriptDuration,
    layout: m1.LayoutDuration - m0.LayoutDuration,
    style: m1.RecalcStyleDuration - m0.RecalcStyleDuration,
    heap: m1.JSHeapUsedSize,
    docs: m1.Documents,
    frames: m1.Frames,
    nodes: m1.Nodes,
    cpu,
    procCount: p1.length,
    mem: memBy,
  });
  process.stdout.write(`  ${name} ${(wall / 1000).toFixed(1)}s\n`);
}

/** Moves the pointer in small circles around a point for a while (real input events). */
async function wiggle(x, y, ms, r = 40) {
  const end = Date.now() + ms;
  let a = 0;
  while (Date.now() < end) {
    a += 0.35;
    await page.mouse.move(x + Math.cos(a) * r, y + Math.sin(a) * r);
    await sleep(8);
  }
}

const plateBox = () =>
  page.evaluate(() => {
    const p = document.querySelector('.slide[data-state="active"] .plate[data-app]');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const g = p.querySelector('.lights--left .light--zoom')?.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, app: p.dataset.app, zoom: g ? { x: g.left + g.width / 2, y: g.top + g.height / 2 } : null };
  });

console.log(`${label}: ${BASE}`);
await phase('load', async () => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await sleep(3000);
});
await phase('idle', () => sleep(3000));
await phase('first-input', () => wiggle(800, 420, 3000, 120));
await page.mouse.move(W - 6, H - 6);
await phase('to-work', async () => {
  await page.keyboard.press('ArrowDown');
  await sleep(3000);
});

if (!only || only.includes('cycle')) {
  // The showcase goes through every product on its own while the pointer rests off it.
  await phase('cycle', async () => {
    const start = await now();
    const want = quick ? 2 : 6;
    for (;;) {
      await sleep(1000);
      const n = await page.evaluate((s) => window.__perf.marks.filter((m) => m.t > s && m.what.startsWith('slide:')).length, start);
      if (n >= want || (await now()) - start > (quick ? 45000 : 130000)) break;
    }
    await sleep(2500);
  });
}

if (!only || only.includes('hover')) {
  const ids = quick ? ['lifeui'] : ['katarch', 'knowgraph', 'playsync', 'lifeui', 'lolimpact'];
  for (const id of ids) {
    await page.evaluate((id) => {
      const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
      document.querySelectorAll('[data-go]')[i]?.click();
    }, id);
    await page.mouse.move(W - 6, H - 6);
    await phase(`${id}:arrive`, () => sleep(3500));
    const box = await plateBox();
    if (!box) continue;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    await phase(`${id}:hover`, async () => {
      const t = await now();
      await page.mouse.move(cx - 60, cy, { steps: 6 });
      let live = null;
      for (let i = 0; i < 80 && live === null; i++) {
        await wiggle(cx - 60, cy, 50, 6);
        live = await page.evaluate((t) => window.__perf.marks.find((m) => m.t > t && m.what.startsWith('live:'))?.t ?? null, t);
      }
      return { goLive: live === null ? null : Math.round(live - t) };
    });
    await phase(`${id}:use`, () => wiggle(cx, cy, 2500, 160));
    const after = await plateBox();
    if (after?.zoom) {
      await phase(`${id}:open`, async () => {
        await page.mouse.move(after.zoom.x, after.zoom.y, { steps: 4 });
        await page.mouse.click(after.zoom.x, after.zoom.y);
        await sleep(1100);
      });
      await phase(`${id}:window`, () => wiggle(W / 2, H / 2 - 40, 2000, 220));
      await phase(`${id}:close`, async () => {
        await page.keyboard.press('Escape');
        await sleep(1100);
      });
    }
    await page.mouse.move(W - 6, H - 6, { steps: 8 });
    await sleep(600);
  }
}

// ---- Analysis
const perf = await page.evaluate(() => ({ frames: window.__perf.frames, loaf: window.__perf.loaf, marks: window.__perf.marks }));
const VSYNC = 1000 / 240;
const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : 0);
for (const ph of phases) {
  const f = perf.frames.filter((t) => t >= ph.t0 && t <= ph.t1);
  const iv = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
  const span = ph.t1 - ph.t0;
  ph.fps = f.length / (span / 1000);
  ph.p50 = pct(iv, 0.5);
  ph.p95 = pct(iv, 0.95);
  ph.p99 = pct(iv, 0.99);
  ph.max = iv.at(-1) ?? 0;
  // Time spent in frames that took longer than 1/60 s: what a person sees as a hitch.
  ph.janky = iv.filter((d) => d > 1000 / 60).reduce((a, d) => a + d, 0) / span;
  ph.dropped = iv.reduce((a, d) => a + Math.max(0, Math.round(d / VSYNC) - 1), 0);
  const lo = perf.loaf.filter((e) => e.t >= ph.t0 && e.t <= ph.t1);
  ph.loafCount = lo.length;
  ph.loafTotal = lo.reduce((a, e) => a + e.d, 0);
  ph.blocking = lo.reduce((a, e) => a + e.b, 0);
  const by = {};
  for (const e of lo)
    for (const s of e.scripts) {
      const k = `${(s.src || s.inv || '?').replace(BASE, '').replace(/\?.*$/, '').slice(0, 70)} [${s.win}]`;
      by[k] = (by[k] ?? 0) + s.d;
    }
  ph.topScripts = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, d]) => `${Math.round(d)}ms ${k}`);
}
mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', `${label}.json`), JSON.stringify({ label, base: BASE, at: new Date().toISOString(), phases, marks: perf.marks, loaf: perf.loaf }, null, 1));

const row = (p) =>
  [
    p.name.padEnd(18),
    p.fps.toFixed(0).padStart(4),
    p.p95.toFixed(1).padStart(6),
    p.max.toFixed(0).padStart(5),
    (p.janky * 100).toFixed(1).padStart(6) + '%',
    String(p.dropped).padStart(6),
    Math.round(p.blocking).toString().padStart(6),
    ((p.task / (p.wall / 1000)) * 100).toFixed(0).padStart(5) + '%',
    Object.entries(p.cpu)
      .filter(([, v]) => v > 0.05)
      .map(([k, v]) => `${k} ${((v / (p.wall / 1000)) * 100).toFixed(0)}%`)
      .join(' '),
    `${(p.heap / 1e6).toFixed(0)}MB docs${p.docs} fr${p.frames} procs${p.procCount}`,
    p.extra.goLive !== undefined ? `goLive ${p.extra.goLive}ms` : '',
  ].join(' ');
console.log('\nphase               fps  p95ms  maxms  janky  dropped block  main  cpu (of one core)  heap');
for (const p of phases) console.log(row(p));
console.log('\nmarks:', perf.marks.map((m) => `${(m.t / 1000).toFixed(1)} ${m.what}`).join(' | '));
console.log('\ntop scripts in long frames:');
for (const p of phases) if (p.topScripts.length) console.log(`  ${p.name}: ${p.topScripts.join('; ')}`);
await browser.close();
