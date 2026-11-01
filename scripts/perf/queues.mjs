/**
 * Do the page's queues and handoffs do the work they mean to? The frame traces say what a second costs;
 * this says what a sequence of actions leaves behind: previews the warm queue gave up on, apps that
 * booted after nobody wanted them, previews marked live with no app answering, and pace loops still
 * watching a held app. Each scenario is one page, driven like a visitor, and one number per claim.
 *
 *   node scripts/perf/queues.mjs
 *   BASE='http://[::1]:4391' TAG=after ROUND=1 node scripts/perf/queues.mjs
 *   SCENARIOS=warm,held node scripts/perf/queues.mjs
 *
 * A fresh profile per scenario (nothing carried from one to the next), off-screen window, same flags as
 * the other scripts. `phantom` throttles the CPU: the case it looks for is a cold app that answers
 * after the page gave up waiting, which a fast machine never shows.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath, windowPosition } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE ?? 'http://[::1]:4391';
const TAG = process.env.TAG ?? 'run';
const ROUND = process.env.ROUND ?? '1';
const scenarios = (process.env.SCENARIOS ?? 'warm,stale,phantom,live,held').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Records the messages the page sends to its stages, and the stage's answers, with where the preview
// was on screen at that moment. Page side only; the per-document frame counters come next.
const hook = () => {
  if (window === window.top) {
    window.__sends = [];
    window.__answers = [];
    window.__marks = [];
    // When a preview is marked live, and when the mark comes off: the page sets data-live itself.
    // (At document start there may be no documentElement yet; the plates and their marks come later.)
    const watch = () =>
      new MutationObserver((ms) => {
        for (const m of ms) {
          const p = m.target;
          window.__marks.push({ id: p.dataset.app ?? '?', t: Math.round(performance.now()), on: p.hasAttribute('data-live') });
        }
      }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-live'] });
    if (document.documentElement) watch();
    else document.addEventListener('readystatechange', watch, { once: true });
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      return { on: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, inert: !!el.closest('[inert]') };
    };
    customElements.whenDefined('tape-player').then(() => {
      const P = customElements.get('tape-player').prototype;
      const send = P.send;
      P.send = function (m) {
        const plate = this.closest('.plate');
        const w = seen(this);
        window.__sends.push({ id: (plate && plate.dataset.app) || this.tapeId || '?', k: m.k, t: Math.round(performance.now()), on: w.on, inert: w.inert });
        return send.call(this, m);
      };
    });
    addEventListener(
      'stage:live',
      (e) => {
        const plate = e.target && e.target.closest ? e.target.closest('.plate') : null;
        window.__answers.push({ id: (plate && plate.dataset.app) || '?', t: Math.round(performance.now()) });
      },
      true,
    );
  }
  // Per document: frame callbacks (the probe's own loop is the floor), timers, and animations started.
  const T = (window.__t = { raf: 0, to: 0, plays: 0 });
  const R = requestAnimationFrame, O = setTimeout;
  window.requestAnimationFrame = (f) => (T.raf++, R(f));
  window.setTimeout = (f, d, ...a) => (T.to++, O(f, d, ...a));
  const play = Animation.prototype.play;
  Animation.prototype.play = function () {
    T.plays++;
    return play.call(this);
  };
  const tick = () => R(tick);
  R(tick);
};

async function open(throttle) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: !!process.env.HEADLESS,
    defaultViewport: null,
    userDataDir: mkdtempSync(join(tmpdir(), 'q-')),
    args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--lang=en-US', '--no-first-run',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-features=CalculateNativeWinOcclusion'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const [page] = await browser.pages();
  await page.evaluateOnNewDocument(hook);
  if (throttle) await page.emulateCPUThrottling(throttle);
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  const bs = await browser.target().createCDPSession();
  const cpu = async () => {
    const { processInfo } = await bs.send('SystemInfo.getProcessInfo');
    const by = {};
    for (const p of processInfo) by[p.type] = (by[p.type] ?? 0) + p.cpuTime;
    return by;
  };
  const url = new Map();
  let bytes = 0;
  let tapeBytes = 0;
  client.on('Network.responseReceived', (e) => url.set(e.requestId, e.response.url));
  client.on('Network.loadingFinished', (e) => {
    const u = url.get(e.requestId) ?? '';
    bytes += e.encodedDataLength;
    if (/\/tapes\/|\.mp4|\.webm/.test(u)) tapeBytes += e.encodedDataLength;
  });
  const records = () => page.evaluate(() => ({ sends: window.__sends, answers: window.__answers, marks: window.__marks }));
  const counts = () =>
    page.evaluate(() => {
      const ps = [...document.querySelectorAll('tape-player')];
      return {
        players: ps.length,
        warmed: ps.filter((p) => p.preload === 'auto').length,
        cold: ps.filter((p) => p.preload !== 'auto').map((p) => p.closest('.plate')?.dataset.app ?? '?'),
        livePlates: [...document.querySelectorAll('.plate[data-live]')].map((p) => p.dataset.app ?? '?'),
      };
    });
  const goto = async (path = '/') => {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await sleep(1600);
  };
  /** A point that isn't over any preview: where the pointer rests without starting one. */
  const safePoint = () =>
    page.evaluate(() => {
      for (const y of [140, 320, 520, 760, 940])
        for (const x of [80, 240, 480, 1200, 1520]) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest('.plate') && !el.closest('tape-player')) return { x, y };
        }
      return { x: 5, y: 5 };
    });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  // A move over the page and a small wheel over the deck: the input the page starts its machinery
  // from, and the showcase within reach. The wheel goes above any preview.
  const firstInput = async () => {
    await page.mouse.move(240, 140, { steps: 3 });
    await sleep(100);
    await page.mouse.move(800, 200, { steps: 2 });
    await page.mouse.wheel({ deltaY: 200 });
    await sleep(600);
  };
  const select = (id) =>
    page.evaluate((id) => {
      const i = [...document.querySelectorAll('[data-slide]')].findIndex((s) => s.dataset.id === id);
      document.querySelectorAll('[data-go]')[i]?.click();
    }, id);
  const wheel = (dy, n, gap) =>
    (async () => {
      for (let i = 0; i < n; i++) {
        await page.mouse.wheel({ deltaY: dy });
        await sleep(gap);
      }
    })();
  /** The active product's preview: how much of it the viewport shows, and a point inside that part. */
  const where = () =>
    page.evaluate(() => {
      const active = document.querySelector('.slide[data-state="active"]');
      const plate = active?.querySelector('.plate[data-app]');
      const r = plate?.getBoundingClientRect();
      const shown = r ? Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height : 0;
      return {
        active: active?.dataset.id ?? '?',
        plate: plate?.dataset.app ?? '?',
        top: r ? Math.round(r.top) : null,
        shown: Math.round(shown * 100) / 100,
        point: r && {
          x: Math.round(r.left + r.width / 2),
          y: Math.round(Math.max(r.top, 0) + Math.min(r.height, innerHeight - Math.max(r.top, 0)) / 2),
        },
      };
    });
  /** Brings the active preview into the viewport with the deck's own scrolling: the page only counts a
      preview as on screen from 60% of it visible, and the landing shows less than half. The wheel goes
      above the preview, so the pointer never enters it on the way. */
  const center = async () => {
    for (let i = 0; i < 6; i++) {
      const w = await where();
      if (!w.point || w.shown >= 0.85) return w;
      const dy = w.top === null ? 300 : w.top > 140 ? Math.min(600, w.top - 100) : -Math.min(600, 140 - w.top);
      await page.mouse.move(800, 120, { steps: 2 });
      await page.mouse.wheel({ deltaY: dy });
      await sleep(500);
    }
    return where();
  };
  const platePoint = (id) =>
    page.evaluate((id) => {
      const p = document.querySelector(`.slide[data-state="active"][data-id="${id}"] .plate[data-app="${id}"]`) ?? document.querySelector(`.plate[data-app="${id}"]`);
      const r = p?.getBoundingClientRect();
      return r && { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, id);
  /** The pointer onto the active preview; null when it isn't on screen to be pointed at. The pointer
      events go straight to the plate: this measures the page's own path (ghost, ask, take over), not
      the browser's hit testing. */
  const hoverActive = async () => {
    let w = await where();
    if (w.point && w.shown < 0.85) {
      await center();
      w = await where();
    }
    if (!w.point || w.shown < 0.85) return null;
    await page.evaluate(({ x, y }) => {
      const plate = document.querySelector('.slide[data-state="active"] .plate[data-app]');
      if (!plate) return;
      const o = { pointerType: 'mouse', bubbles: true, clientX: x, clientY: y };
      plate.dispatchEvent(new PointerEvent('pointerenter', o));
      plate.dispatchEvent(new PointerEvent('pointermove', o));
    }, w.point);
    return w;
  };
  const away = async () => {
    await page.evaluate(() => {
      for (const plate of document.querySelectorAll('.plate[data-hover]'))
        plate.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: false }));
    });
    const p = await safePoint();
    await page.mouse.move(p.x, p.y, { steps: 3 });
  };
  /** Waits for the stage's word about a product from now on; null when it never came. */
  const waitLive = async (id, ms) => {
    const t0 = await page.evaluate(() => performance.now());
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const a = await page.evaluate((id, t0) => window.__answers.filter((x) => x.id === id && x.t >= t0).pop(), id, t0);
      if (a) return a.t - t0;
      await sleep(100);
    }
    return null;
  };
  /** What each document is doing: its own counters, its running animations, and the sessions it holds. */
  const docs = async () => {
    const rows = [];
    for (const f of page.frames()) {
      const r = await f
        .evaluate(() => ({
          url: location.href.replace(/^https?:\/\/[^/]+/, '').slice(0, 30),
          raf: window.__t?.raf ?? 0,
          to: window.__t?.to ?? 0,
          plays: window.__t?.plays ?? 0,
          anims: document.getAnimations().filter((a) => a.playState === 'running').length,
          nodes: document.getElementsByTagName('*').length,
          sessions: Object.keys(window.__live ?? {}).length,
        }))
        .catch(() => null);
      if (r) rows.push(r);
    }
    return rows;
  };
  return { browser, page, errors, records, counts, goto, firstInput, select, wheel, where, center, hoverActive, away, platePoint, waitLive, docs, cpu, bytes: () => ({ kb: Math.round(bytes / 1024), tapeKb: Math.round(tapeBytes / 1024) }) };
}

const results = {};

// Previews the warm queue gave up on. The first sweep mounts every player's tape one at a time; the
// visitor scrolls to the showcase and picks products while it is still going, and each pick marks the
// page busy for a moment. A queue that spends its head on a busy moment loses that preview for good:
// it never mounts, and its first hover pays the whole cold mount.
async function warm() {
  const s = await open(0);
  await s.goto();
  await s.page.evaluate(() => {
    window.__mount = [];
    window.__t0 = performance.now();
    const idOf = (p) => (p.closest('.plate') && p.closest('.plate').dataset.app) || '?';
    const ps = [...document.querySelectorAll('tape-player')];
    const timer = setInterval(() => {
      for (const p of ps) {
        const id = idOf(p);
        if (p.preload === 'auto' && !window.__mount.some((m) => m.id === id)) window.__mount.push({ id, t: Math.round(performance.now() - window.__t0) });
      }
    }, 80);
    setTimeout(() => clearInterval(timer), 20000);
  });
  await s.firstInput();
  await s.wheel(700, 3, 120);
  for (const i of [3, 5, 1]) {
    await s.page.evaluate((i) => document.querySelectorAll('[data-go]')[i]?.click(), i);
    await sleep(300);
  }
  await sleep(7000);
  const c = await s.counts();
  const mount = await s.page.evaluate(() => window.__mount);
  results.warm = {
    players: c.players,
    warmed: c.warmed,
    cold: c.cold,
    mounts: mount.map((m) => `${m.id}@${m.t}`).join(' '),
    drained: mount.length ? Math.max(...mount.map((m) => m.t)) : null,
    ...s.bytes(),
  };
  await s.browser.close();
}

// Apps that booted after nobody wanted them: from the work landing, products clicked through faster
// than the one-at-a-time chain can go. Each boot is checked when it is queued; the chain's turn comes
// later, when the preview it was queued for is off screen and its drop has already gone out.
async function stale() {
  const s = await open(Number(process.env.THROTTLE_STALE ?? 0));
  await s.goto('/#work');
  await s.firstInput();
  await s.center();
  await sleep(700);
  // A product brought on screen (its boot queued behind the one already running), then scrolled out of
  // the viewport before its turn comes: the page drops it, and the queue still has its boot waiting.
  await s.select('knowgraph');
  await sleep(1200);
  await s.page.mouse.move(800, 120, { steps: 2 });
  await s.page.mouse.wheel({ deltaY: 900 });
  await sleep(12000);
  const { sends } = await s.records();
  const boots = sends.filter((m) => m.k === 'boot');
  results.stale = {
    boots: boots.length,
    stale: boots.filter((m) => !m.on || m.inert).length,
    detail: boots.map((m) => `${m.id}@${m.t}${!m.on ? ' off' : ''}${m.inert ? ' inert' : ''}`),
    ...s.bytes(),
  };
  await s.browser.close();
}

// A preview marked live with no app answering: a cold hover that leaves before the app replies, on a
// machine slow enough that the reply would have landed after the page stopped waiting.
async function phantom() {
  const s = await open(6);
  await s.goto('/#work');
  await s.firstInput();
  await sleep(200);
  // A product just brought on screen, hovered before its dwell boot could start: the app has to boot
  // first, and on a slow machine that takes longer than the page waits.
  await s.select('portfolio');
  await sleep(120);
  const w = await s.hoverActive();
  await sleep(600);
  await s.away();
  await s.select('knowgraph');
  await sleep(12000);
  const { sends, answers, marks } = await s.records();
  const id = w?.plate ?? '?';
  const asked = sends.find((m) => m.id === id && m.k === 'live');
  const answered = answers.filter((a) => a.id === id);
  const firstAnswer = answered.length ? answered[0].t : Infinity;
  // The mark that came before any word from the stage is the mark with no app behind it.
  const early = marks.filter((m) => m.id === id && m.on && m.t < firstAnswer);
  results.phantom = {
    plate: id,
    asked: !!asked,
    answered: answered.length,
    marked: marks.filter((m) => m.id === id && m.on).map((m) => m.t),
    firstAnswer: firstAnswer === Infinity ? 'none' : firstAnswer,
    phantom: early.length ? 1 : 0,
    liveNow: (await s.counts()).livePlates,
    ...s.bytes(),
  };
  await s.browser.close();
}

// The cost side of the goLive change: a hovered preview still has to take over, cold or warm.
async function live() {
  const s = await open(0);
  await s.goto('/#work');
  await s.firstInput();
  await sleep(1200);
  const out = {};
  // Cold: a product just brought on screen and hovered before its dwell boot could start.
  await s.select('portfolio');
  await sleep(400);
  out.whereAfterSelect = await s.where();
  let w = await s.hoverActive();
  out.whereAfterCenter = await s.where();
  let ms = w ? await s.waitLive('portfolio', 12000) : null;
  out.cold = w ? (ms === null ? 'never' : ms) : 'not on screen';
  await s.away();
  await sleep(600);
  // Warm: a product whose app is already live (or following its tape, if it went cold in between).
  await s.select('katarch');
  await sleep(1500);
  w = await s.hoverActive();
  ms = w ? await s.waitLive('katarch', 12000) : null;
  const already = await s.page.evaluate(() => !!document.querySelector('.plate[data-live]'));
  out.warm = w ? (ms === null ? (already ? 'already live' : 'never') : ms) : 'not on screen';
  const { sends } = await s.records();
  out.asks = sends.filter((m) => m.k === 'live').map((m) => `${m.id}@${m.t}`).join(' ');
  out.all = sends.map((m) => `${m.id}:${m.k}@${m.t}`).join(' ');
  out.errors = s.errors;
  results.live = out;
  await s.browser.close();
}

// A held app that isn't held: the visitor's app stays live, its preview scrolls out of the viewport
// (the slide is still the rendered one), and the page holds it. The pace loop keeps watching frames
// nobody sees, and a judgement taken there runs the animations the hold just stopped.
async function held() {
  const s = await open(0);
  await s.goto('/#work');
  await s.firstInput();
  await sleep(800);
  const w = await s.hoverActive();
  const id = w?.plate ?? '?';
  await s.waitLive(id, 12000);
  await s.away();
  await sleep(600);
  // Out of the viewport, same panel and same slide: the deck scrolls, the preview just leaves.
  await s.page.mouse.move(800, 120, { steps: 2 });
  await s.page.mouse.wheel({ deltaY: 520 });
  await sleep(3000);
  const gone = await s.where();
  const a = await s.docs();
  const c0 = await s.cpu();
  const w0 = Date.now();
  await sleep(16000);
  const b = await s.docs();
  const c1 = await s.cpu();
  const secs = (Date.now() - w0) / 1000;
  const rows = b.map((y, i) => {
    const x = a[i] ?? y;
    return {
      url: y.url,
      raf: Math.round((y.raf - x.raf) / secs),
      to: Math.round(((y.to - x.to) / secs) * 10) / 10,
      plays: y.plays - x.plays,
      anims: y.anims,
      sessions: y.sessions,
    };
  });
  const { sends } = await s.records();
  results.held = {
    app: id,
    shownAfterScroll: gone.shown,
    holds: sends.filter((m) => m.k === 'hold' && m.id === id).map((m) => `${m.t}:${m.on}`).join(' '),
    secs: Math.round(secs),
    rows: rows.filter((r) => r.sessions || /\/apps\//.test(r.url)),
    renderer: Math.round((((c1.renderer ?? 0) - (c0.renderer ?? 0)) / secs) * 1000) / 10,
    gpu: Math.round((((c1.GPU ?? 0) - (c0.GPU ?? 0)) / secs) * 1000) / 10,
  };
  await s.browser.close();
}

const run = { warm, stale, phantom, live, held };
for (const name of scenarios) {
  process.stdout.write(`${name} `);
  try {
    await run[name]();
  } catch (e) {
    results[name] = { error: String(e).slice(0, 200) };
  }
  process.stdout.write('done\n');
}

const file = join(out, `queues-${TAG}-${ROUND}-${Date.now()}.json`);
writeFileSync(file, JSON.stringify(results, null, 1));
console.log(`\n${TAG} round ${ROUND}  (${BASE})  -> ${file}`);
if (results.warm) console.log(`warm    warmed ${results.warm.warmed}/${results.warm.players} tape mounts at rest, cold: ${results.warm.cold.join(',') || '-'}  [${results.warm.tapeKb} KB of tape]`);
if (results.stale) console.log(`stale   boots started ${results.stale.boots}, of them stale (plate off screen or inert): ${results.stale.stale}`);
if (results.phantom) console.log(`phantom live marks without the stage's word: ${results.phantom.phantom}  (asked ${results.phantom.asked}, answers ${results.phantom.answered}, plates live now: ${results.phantom.liveNow.join(',') || '-'})`);
if (results.live) console.log(`live    ms to take over a preview: cold ${results.live.cold}, warm ${results.live.warm}`);
if (results.held) console.log(`held    ${results.held.app} after scroll (shown ${results.held.shownAfterScroll}) holds ${results.held.holds || '-'}; renderer ${results.held.renderer}ms/s gpu ${results.held.gpu}ms/s; per second while held: ${results.held.rows.map((r) => `${r.url} raf ${r.raf} to ${r.to} plays ${r.plays} anims ${r.anims} sessions ${r.sessions}`).join(' | ')}`);
