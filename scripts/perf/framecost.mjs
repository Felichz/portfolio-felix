/**
 * What one frame costs the GPU, as the page is built: a 30px square moves (a compositor animation, so
 * it changes almost nothing on screen) over a blank page and over the site's panels, with one layer
 * of the site removed at a time. If a frame costs far more here than on a blank page, the compositor
 * is redrawing much more than the square, and the variant that brings it down names the layer.
 *
 *   node scripts/perf/framecost.mjs [variants]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VARIANTS = {
  blank: { url: 'data:text/html,<body style="margin:0;background:%23eee">', css: '' },
  intro: { url: '/', css: '' },
  work: { url: '/#work', css: '', still: true },
  'work-noambient': { url: '/#work', css: '.ambient{display:none!important}', still: true },
  'work-nocursorlight': { url: '/#work', css: '.cursor-light{display:none!important}', still: true },
  'work-noplate': { url: '/#work', css: '.slide-media{visibility:hidden!important}', still: true },
  'work-noshadow': { url: '/#work', css: '.plate,.glass{box-shadow:none!important}', still: true },
  'work-notransform': { url: '/#work', css: '.slide-media .plate{transform:none!important}', still: true },
  'work-nostage': { url: '/#work', css: '.stage-frame{display:none!important}', still: true },
  'work-norail': { url: '/#work', css: '.rail{visibility:hidden!important}', still: true },
  playing: { url: '/#work/lifeui', css: '', play: true },
  'playing-noclip': { url: '/#work/lifeui', css: '.plate-frame,.plate-motion,.plate-screen{overflow:visible!important;border-radius:0!important}', play: true },
  'playing-nocursor': { url: '/#work/lifeui', css: '', play: true, stageCss: '.tape-cursor-layer{display:none!important}' },
  'playing-nocontain': { url: '/#work/lifeui', css: '', play: true, stageCss: 'tape-core{contain:none!important;overflow:visible!important}' },
  'playing-noscale': { url: '/#work/lifeui', css: '', play: true, stageCss: '.tape-frame{transform:none!important}' },
  'playing-noapp': { url: '/#work/lifeui', css: '', play: true, stageCss: '.live-app{display:none!important}' },
  'playing-nostage-anim': { url: '/#work/lifeui', css: '', play: true, stageStill: true },
  'work-nobar': { url: '/#work', css: '.bar,.dock{visibility:hidden!important}', still: true },
};
const pick = (process.argv[2] ?? Object.keys(VARIANTS).join(',')).split(',');
const rounds = Number(process.env.ROUNDS ?? 2);

async function run(name) {
  const v = VARIANTS[name];
  const dir = mkdtempSync(join(tmpdir(), 'fc-'));
  const browser = await puppeteer.launch({
    executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
    headless: false,
    defaultViewport: null,
    userDataDir: dir,
    args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const [page] = await browser.pages();
  await page.goto(v.url.startsWith('data:') ? v.url : BASE + v.url, { waitUntil: 'load' });
  await sleep(2500);
  if (v.play) {
    await page.mouse.move(1500, 800, { steps: 3 });
    await sleep(3000);
  }
  await page.evaluate(
    (css, still) => {
      document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
      if (still) {
        // Everything that moves on its own stops: the countdown, the tapes, the light's ripple.
        document.querySelector('[data-auto][aria-pressed="true"]')?.click();
        document.querySelectorAll('tape-player').forEach((p) => p.pause());
        document.head.insertAdjacentHTML('beforeend', '<style>*,*::before,*::after{animation-play-state:paused!important}</style>');
      }
      const sq = document.createElement('div');
      sq.style.cssText = 'position:fixed;left:50%;top:50%;width:30px;height:30px;background:#e33;z-index:99999;pointer-events:none';
      document.body.append(sq);
      sq.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(40px,0)' }], { duration: 1000, iterations: Infinity, direction: 'alternate' });
    },
    v.css,
    !!v.still,
  );
  if (v.stageCss)
    for (const f of page.frames()) if (f.url().includes('/stage/')) await f.evaluate((css) => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`), v.stageCss);
  if (v.stageStill)
    for (const f of page.frames()) if (f.url().includes('/stage/')) await f.evaluate(() => document.querySelectorAll('iframe').forEach((i) => i.contentDocument?.getAnimations().forEach((a) => a.pause())));
  await sleep(1500);
  const path = join(dir, 'trace.json');
  await page.tracing.start({ path, categories: ['viz', 'gpu', 'toplevel', 'disabled-by-default-devtools.timeline.frame'] });
  await sleep(3000);
  await page.tracing.stop();
  const { traceEvents: ev } = JSON.parse(readFileSync(path, 'utf8'));
  await browser.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
  const tn = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') tn.set(`${e.pid}:${e.tid}`, e.args.name);
  const on = (thread, name) => ev.filter((e) => e.ph === 'X' && e.name === name && tn.get(`${e.pid}:${e.tid}`) === thread);
  const drawn = on('VizCompositorThread', 'DirectRenderer::DrawFrame').map((e) => e.ts).sort((a, b) => a - b);
  const frames = drawn.length;
  const gaps = drawn.slice(1).map((t, i) => (t - drawn[i]) / 1000).sort((a, b) => a - b);
  const p = (q) => gaps[Math.floor((gaps.length - 1) * q)] ?? 0;
  // Busy main threads per renderer process (the page and, out of process, the stages).
  const mains = {};
  for (const e of ev) if (e.ph === 'X' && tn.get(`${e.pid}:${e.tid}`) === 'CrRendererMain' && e.name === 'ThreadControllerImpl::RunTask') mains[e.pid] = (mains[e.pid] ?? 0) + e.dur / 1000 / 30;
  const passes = on('VizCompositorThread', 'DirectRenderer::DrawRenderPass').length;
  const sum = (a) => a.reduce((s, e) => s + e.dur, 0) / 1000;
  const paint = sum(on('CrGpuMain', 'SkiaOutputSurfaceImplOnGpu::FinishPaintRenderPass'));
  const present = sum(on('CrGpuMain', 'DXGISwapChainImageBacking::Present'));
  return { p50: p(0.5), p95: p(0.95), max: p(1), mains: Object.values(mains).map((x) => x.toFixed(0) + '%').join('/'), fps: frames / 3, passes: frames ? passes / frames : 0, paintPerFrame: frames ? paint / frames : 0, gpuDraw: paint / 3 / 10, present: present / 3 / 10 };
}

const res = Object.fromEntries(pick.map((k) => [k, []]));
for (let r = 0; r < rounds; r++) for (const k of pick) res[k].push(await run(k));
const avg = (a, k) => a.reduce((s, x) => s + x[k], 0) / a.length;
console.log('variant              fps   passes/frame   draw ms/frame   draw %   present %   frame gap p50/p95/max   main threads');
for (const k of pick)
  console.log(
    k.padEnd(20),
    avg(res[k], 'fps').toFixed(0).padStart(4),
    avg(res[k], 'passes').toFixed(1).padStart(11),
    avg(res[k], 'paintPerFrame').toFixed(2).padStart(14),
    avg(res[k], 'gpuDraw').toFixed(0).padStart(9),
    avg(res[k], 'present').toFixed(0).padStart(9),
    `   ${res[k].map((r) => `${r.p50.toFixed(1)}/${r.p95.toFixed(1)}/${r.max.toFixed(0)}`).join(' ')}`,
    `  ${res[k].map((r) => r.mains).join(' | ')}`,
  );
