/**
 * Thaw: Live on a product with a tape opens the real app here, in the state the preview shows.
 *
 * The flight carries the preview, not the app: a copy of the plate (same chrome, the same tape at the
 * same 1440×900 viewport) lifts off and scales up to a window, so every frame of the transition is the
 * frame you clicked on, only bigger. No layout changes, no JavaScript from the app; the page steps back
 * and fades behind it, on transforms alone.
 *
 * Under it, from the first frame of the flight, the real app boots: its vendored build on this origin
 * (public/apps/<id>/), with the storage of the last checkpoint before that frame and a clock the bridge
 * (scripts/apps/bridge.js) lets this script move. The scene's recorded clicks since that checkpoint are
 * replayed in the live app, each with the clock set to the moment it was recorded, which brings the app
 * to the same state as the frozen frame: the same dialog open, the same option chosen, the same timer.
 * When the flight lands and the app has settled, it takes the frame's place.
 *
 * Nothing loads before there's a reason: the window is built in idle time once a plate is on screen
 * (and kept out of rendering), painted and synced on hover, and the app's files are prefetched then.
 */
import { loadTape, type Action, type Checkpoint, type Tape, type TapePlayer } from './tape';

const FLIGHT = 660;
const EASE = 'cubic-bezier(0.22, 0.8, 0.18, 1)';
/** How long the DOM has to stay still before a frame counts as at rest (transitions finished). */
const SETTLE = 450;
/** Space around the window once it's up. */
const MARGIN = 24;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

interface Handoff {
  app: string;
  clock: number;
  real: number;
  readySelector: string;
  ready: () => void;
  /**
   * Installed by the bridge: sets the app's clock, frozen or running. Its timers run on that clock, so
   * moving it forward fires what fell due on the way.
   */
  setClock?: (ms: number, freeze?: boolean, tick?: boolean) => void;
}
declare global {
  interface Window {
    __thaw?: Handoff;
  }
}

const icon = (d: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const OUT = icon('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>');
const CLOSE = icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const frames = (win: Window, n = 2) =>
  new Promise<void>((r) => {
    const step = () => (--n <= 0 ? r() : win.requestAnimationFrame(step));
    win.requestAnimationFrame(step);
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let open = false;

/** The plate showing this app right now: the active slide's, or the case study's lead. */
function sourcePlate(id: string) {
  return [...document.querySelectorAll<HTMLElement>(`.plate[data-app="${id}"]`)].find((p) => {
    const r = p.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !p.closest('[inert]');
  });
}

/** The page layers that step back behind the window: everything in <body> but the overlays. */
const pageLayers = () =>
  [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains('thaw') && el.tagName !== 'SCRIPT');

function prefetch(tape: Tape) {
  for (const href of tape.app.prefetch) {
    if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.append(link);
  }
}

/**
 * The first moment at or after `t` when the recorded DOM has been still for SETTLE ms. One pass over
 * the changes, which are in time order: each one inside the window pushes the window on.
 */
function restingTime(tape: Tape, t: number) {
  let rest = t;
  for (const e of tape.events) {
    if (!'cavks'.includes(e[0])) continue;
    const at = e[1];
    if (at <= t) rest = Math.max(t, at + SETTLE);
    else if (at < rest) rest = at + SETTLE;
    else break;
  }
  return Math.min(rest, tape.duration);
}

// ---------------------------------------------------------------------------------------------------
// The window: a copy of the plate, built ahead
// ---------------------------------------------------------------------------------------------------

interface AppWindow {
  id: string;
  overlay: HTMLElement;
  win: HTMLElement;
  chrome: HTMLElement;
  screen: HTMLElement;
  copy: TapePlayer;
  ready: Promise<void>;
}
let standby: AppWindow | null = null;

function prepare(id: string): AppWindow {
  if (standby?.id === id) return standby;
  standby?.overlay.remove();
  const overlay = document.createElement('div');
  overlay.className = 'thaw standby';
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<div class="thaw-window plate plate--chrome"><div class="thaw-chrome"></div><div class="thaw-screen"></div></div>`;
  const win = overlay.querySelector<HTMLElement>('.thaw-window')!;
  const screen = overlay.querySelector<HTMLElement>('.thaw-screen')!;
  const copy = document.createElement('tape-player') as TapePlayer;
  copy.className = 'thaw-tape';
  copy.setAttribute('src', `/tapes/${id}.json`);
  screen.append(copy);
  document.body.append(overlay);
  standby = { id, overlay, win, chrome: overlay.querySelector<HTMLElement>('.thaw-chrome')!, screen, copy, ready: copy.ready() };
  return standby;
}

/** On hover the window is painted (still invisible) and its copy plays along with the plate. */
function warm(w: AppWindow, on: boolean) {
  w.overlay.classList.toggle('warm', on);
  if (!on) return w.copy.pause();
  const player = sourcePlate(w.id)?.querySelector<TapePlayer>('tape-player');
  void w.ready.then(() => {
    if (standby !== w || !w.overlay.classList.contains('warm') || !player?.tape) return;
    w.copy.currentTime = player.currentTime;
    if (!player.paused) void w.copy.play();
  });
}

/** Dresses the window in this plate's chrome, at the plate's proportions. */
function dress(w: AppWindow, plate: HTMLElement, trigger: HTMLAnchorElement) {
  const r = plate.getBoundingClientRect();
  w.win.style.setProperty('--bar-k', String(1440 / r.width)); // window units per plate pixel
  w.overlay.style.setProperty('--accent', getComputedStyle(plate).getPropertyValue('--accent'));
  const chrome = plate.querySelector('.plate-chrome')?.cloneNode(true) as HTMLElement | undefined;
  w.chrome.replaceChildren();
  if (chrome) {
    const tools = chrome.querySelector('.plate-tools');
    tools?.replaceChildren();
    tools?.insertAdjacentHTML(
      'beforeend',
      `<a class="motion-btn thaw-tool" href="${trigger.href}" target="_blank" rel="noopener">${OUT}<span>New tab</span></a>` +
        `<button class="motion-btn thaw-tool thaw-close" type="button" aria-label="Close the app and return">${CLOSE}<span>Close</span><kbd>Esc</kbd></button>`,
    );
    w.chrome.append(chrome);
  }
  return r;
}

// ---------------------------------------------------------------------------------------------------
// Bringing the live app to the frame
// ---------------------------------------------------------------------------------------------------

/** Finds a recorded click's element in the live app: by its path, checked against its signature. */
function resolve(doc: Document, a: Action) {
  const matches = (el: Element | null | undefined): el is HTMLElement =>
    !!el &&
    el.localName === a.sig.tag &&
    (a.sig.testid ?? null) === el.getAttribute('data-testid') &&
    (a.sig.label ?? null) === el.getAttribute('aria-label') &&
    (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) === a.sig.text;
  let el: Element | undefined = doc.body;
  for (const i of a.path) el = el?.children[i];
  if (matches(el)) return el;
  // A portal that only existed while recording (a tooltip) can shift the path: find it by signature.
  return [...doc.querySelectorAll(a.sig.tag)].find(matches) as HTMLElement | undefined;
}

/** Resolves once the document has gone a few frames without a change (async work after a click). */
function quiet(win: Window, doc: Document, max = 700) {
  return new Promise<void>((done) => {
    let still = 0;
    const seen = new (win as Window & typeof globalThis).MutationObserver(() => (still = 0));
    seen.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
    const end = performance.now() + max;
    const step = () => {
      if (++still >= 3 || performance.now() > end) {
        seen.disconnect();
        return done();
      }
      win.requestAnimationFrame(step);
    };
    win.requestAnimationFrame(step);
  });
}

/** A pointer click the way a hand makes one, dispatched in the app's own realm. */
function click(win: Window & typeof globalThis, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, view: win, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
  el.dispatchEvent(new win.PointerEvent('pointerdown', { ...at, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
  el.dispatchEvent(new win.MouseEvent('mousedown', { ...at, buttons: 1 }));
  el.dispatchEvent(new win.PointerEvent('pointerup', { ...at, pointerType: 'mouse', isPrimary: true }));
  el.dispatchEvent(new win.MouseEvent('mouseup', at));
  el.dispatchEvent(new win.MouseEvent('click', at));
}

/**
 * Replays the scene's clicks since the checkpoint, each with the app's clock frozen at the moment it was
 * recorded and the app given time to finish what the click started (async work included). Then the
 * clock moves on to the frame, firing what fell due on the way (a toast that had time to leave leaves),
 * and settles on `shown`: the last time the frame's text changed, which is the time it shows (a
 * running timer drew its last second then). Returns false if a click had nowhere to land.
 */
async function replay(frame: HTMLIFrameElement, handoff: Handoff, tape: Tape, actions: Action[], at: number, shown: number) {
  const win = frame.contentWindow as Window & typeof globalThis;
  const doc = frame.contentDocument!;
  const settle = async () => {
    await quiet(win, doc);
    await Promise.race([Promise.all(doc.getAnimations().map((x) => x.finished.catch(() => {}))), sleep(900)]);
  };
  for (const a of actions) {
    handoff.setClock?.(tape.clock0 + a.t, true);
    let el: HTMLElement | undefined;
    for (let tries = 0; !(el = resolve(doc, a)) && tries < 40; tries++) await frames(win, 1);
    if (!el) return false;
    click(win, el);
    await quiet(win, doc);
  }
  handoff.setClock?.(tape.clock0 + at, true);
  await settle();
  handoff.setClock?.(tape.clock0 + shown, true, true);
  await settle();
  return true;
}

// ---------------------------------------------------------------------------------------------------
// Opening and closing
// ---------------------------------------------------------------------------------------------------

async function thaw(id: string, trigger: HTMLAnchorElement) {
  const plate = sourcePlate(id);
  if (open || !plate) return void window.open(trigger.href, '_blank', 'noopener');
  open = true;
  const tape = await loadTape(`/tapes/${id}.json`);
  const player = plate.querySelector<TapePlayer>('tape-player');
  // The frame on screen; a plate that never played shows its last frame.
  let from = player?.tape && (player.currentTime > 0 || !player.paused) ? player.currentTime * 1000 : tape.duration;
  player?.pause();
  // A window warmed by the hover has been playing along: if it's within a few frames of the plate, take
  // its time as is. Seeking a tape backward rebuilds its DOM, which would delay the first frame.
  const synced = standby?.id === id && standby.copy.tape && !standby.copy.paused ? standby.copy.currentTime * 1000 : NaN;
  if (Math.abs(synced - from) < 300) from = synced;

  // Where the app has to be: the frame, or the moment its transitions settle, a few hundred ms on.
  const at = restingTime(tape, from);
  const cp: Checkpoint = [...tape.checkpoints].reverse().find((c) => c.t <= at) ?? tape.checkpoints[0]!;
  const actions = (tape.actions ?? []).filter((a) => a.t > cp.t && a.t <= at);
  const clockAt = (t: number) => tape.clock0 + t;
  // The time the frame shows: when its text last changed (a clock on screen last drew then).
  let shown = Math.max(cp.t, actions.length ? actions[actions.length - 1]!.t : cp.t);
  for (const e of tape.events) if (e[0] === 't' && e[1] <= at && e[1] > shown) shown = e[1];

  // ---- Seed the app's storage (what was there goes back on close; this origin shares it).
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  const keys = [...new Set([...tape.app.storage, ...(tape.app.themeKey ? [tape.app.themeKey] : [])])];
  const before = new Map(keys.map((k) => [k, localStorage.getItem(k)]));
  for (const key of tape.app.storage) {
    if (key in cp.storage) localStorage.setItem(key, cp.storage[key]!);
    else localStorage.removeItem(key);
  }
  if (tape.app.themeKey) localStorage.setItem(tape.app.themeKey, theme);

  // ---- The window, usually built and painted already, on the frame you clicked.
  const w = prepare(id);
  standby = null;
  await w.ready;
  // It may be playing along with the plate since the hover: stop it on the frame you clicked.
  w.copy.pause();
  if (Math.abs(w.copy.currentTime * 1000 - from) > 1) w.copy.currentTime = from / 1000;
  const r = dress(w, plate, trigger);
  const { overlay, win, copy } = w;
  overlay.classList.remove('standby', 'warm');
  overlay.inert = false;
  overlay.removeAttribute('aria-hidden');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${trigger.dataset.name ?? id}, running live`);

  // ---- The flight: the plate's copy grows into a window; the page moves past it, locked to it.
  const H = 900 + 30 * (1440 / r.width);
  const s0 = r.width / 1440;
  const k = Math.min((innerWidth - 2 * MARGIN) / 1440, (innerHeight - 2 * MARGIN) / H);
  const x1 = (innerWidth - 1440 * k) / 2;
  const y1 = (innerHeight - H * k) / 2;
  const lift = `translate(${r.left}px, ${r.top}px) scale(${s0})`;
  const land = `translate(${x1}px, ${y1}px) scale(${k})`;
  // The page steps back as the app comes forward: it shrinks a little toward the plate and fades. Only
  // ever scaled down, so its layers keep the raster they have; scaling them up (flying the camera through
  // the page) made the GPU raster the whole page again at the new scale and held the first ~200 ms.
  const camera = 'scale(0.94)';
  const layers = pageLayers();
  const opts: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT, easing: EASE, fill: 'both' };

  plate.style.visibility = 'hidden';
  const origin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  layers.forEach((el) => (el.style.transformOrigin = origin));
  document.documentElement.classList.add('thawing');
  document.dispatchEvent(new CustomEvent('thaw:open', { detail: { id } }));
  const flights = [
    win.animate([{ transform: lift }, { transform: land }], opts),
    ...layers.map((el) => el.animate([{ transform: 'none', opacity: 1 }, { transform: camera, opacity: 0 }], opts)),
  ];
  // The copy finishes the transition it was in, if any, then lets go of the recorded pointer.
  const rested = (at > from ? copy.playTo(at) : Promise.resolve()).then(() => copy.releasePointer());

  // ---- The live app boots under it, starting once the flight is under way: the animations run on the
  // compositor from their first frame, so the app's parsing and booting can't hold them back.
  await frames(window, 2);
  let appReady!: () => void;
  const painted = new Promise<void>((res) => (appReady = res));
  const handoff: Handoff = { app: id, clock: clockAt(cp.t), real: Date.now(), readySelector: tape.app.readySelector, ready: () => appReady() };
  window.__thaw = handoff;
  const frame = document.createElement('iframe');
  frame.className = 'thaw-app';
  frame.title = trigger.dataset.name ?? id;
  frame.src = tape.app.entry.replace(/\/$/, '') + cp.route;
  w.screen.append(frame);
  // Apps without the bridge (this site, opened in itself) are watched from here: same origin.
  const watch = window.setInterval(() => {
    const doc = frame.contentDocument;
    if (!doc || doc.readyState === 'loading' || !doc.querySelector(tape.app.readySelector)) return;
    clearInterval(watch);
    void doc.fonts.ready.then(() => frames(frame.contentWindow!).then(() => appReady()));
  }, 40);
  const hydrated = painted.then(() => replay(frame, handoff, tape, actions, at, shown));


  await Promise.all(flights.map((f) => f.finished));
  layers.forEach((el) => (el.style.visibility = 'hidden'));
  overlay.classList.add('landed');

  // ---- The swap: once landed, settled, and the app has caught up with the frame.
  const slow = window.setTimeout(() => overlay.classList.add('waiting'), 500);
  const [, ok] = await Promise.all([rested, hydrated]);
  clearTimeout(slow);
  overlay.classList.remove('waiting');
  if (!ok) console.warn(`thaw: a recorded click didn't land in ${id}; showing the app from its checkpoint`);
  // The frame you clicked becomes now: the app's clock starts running from it.
  handoff.setClock?.(clockAt(shown), false);
  await frames(frame.contentWindow!);
  await frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce.matches ? 1 : 140, easing: 'ease-out', fill: 'forwards' }).finished;
  frame.style.opacity = '1';
  frame.classList.add('live');
  copy.remove();
  frame.focus();
  frame.contentWindow?.focus();

  // ---- Leaving
  let closing = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // The app's own dialogs take Escape first.
    if (frame.contentDocument?.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    e.preventDefault();
    void close();
  };
  frame.contentWindow?.addEventListener('keydown', onKey);
  overlay.addEventListener('keydown', onKey);
  // The deck listens on window: keep wheel and keys in the window from moving the page under it.
  for (const type of ['wheel', 'keydown', 'pointerdown'] as const) overlay.addEventListener(type, (e) => e.stopPropagation());
  overlay.querySelector('.thaw-close')?.addEventListener('click', () => void close());
  history.pushState({ ...(history.state ?? {}), thaw: id }, '', location.href);
  const onPop = () => void close(true);
  addEventListener('popstate', onPop, { once: true });

  const close = async (viaHistory = false) => {
    if (closing) return;
    closing = true;
    removeEventListener('popstate', onPop);
    if (!viaHistory && history.state?.thaw === id) history.back();
    overlay.classList.remove('landed');
    layers.forEach((el) => (el.style.visibility = ''));
    const back: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT * 0.85, easing: EASE, fill: 'both' };
    const returns = [
      win.animate([{ transform: land }, { transform: lift }], back),
      ...layers.map((el) => el.animate([{ transform: camera, opacity: 0 }, { transform: 'none', opacity: 1 }], back)),
    ];
    flights.forEach((f) => f.cancel());
    await Promise.all(returns.map((f) => f.finished));
    // The plate picks up from the frame the app was opened on.
    if (player?.tape) player.currentTime = at / 1000;
    plate.style.visibility = '';
    overlay.remove();
    returns.forEach((f) => f.cancel());
    layers.forEach((el) => (el.style.transformOrigin = ''));
    document.documentElement.classList.remove('thawing', 'thaw-ready');
    delete window.__thaw;
    clearInterval(watch);
    for (const [key, v] of before) {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    }
    open = false;
    document.dispatchEvent(new CustomEvent('thaw:close', { detail: { id } }));
    trigger.focus({ preventScroll: true });
  };
}

/** Any link with data-thaw="<id>" opens that app in place; modified clicks still open the real site. */
export function initThaw() {
  // Inside a thawed frame (this site opened in itself), links behave like links: no frames in frames.
  if (window !== window.top) return;
  const desktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 900;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-thaw]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !desktop()) return;
    e.preventDefault();
    void thaw(a.dataset.thaw!, a);
  });

  // Intent: fetch the app's files, paint the prepared window and sync its copy, and promote the page
  // layers the camera will move, so their first raster happens now rather than in the flight.
  const root = document.documentElement;
  document.addEventListener(
    'pointerover',
    (e) => {
      const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[data-thaw]');
      if (!a || open || !desktop()) return;
      root.classList.add('thaw-ready');
      void loadTape(`/tapes/${a.dataset.thaw}.json`).then((tape) => {
        prefetch(tape);
        if (!open) warm(prepare(a.dataset.thaw!), true);
      });
    },
    { passive: true },
  );
  document.addEventListener(
    'pointerout',
    (e) => {
      if (!(e.target as Element).closest?.('a[data-thaw]') || open) return;
      root.classList.remove('thaw-ready');
      if (standby) warm(standby, false);
    },
    { passive: true },
  );

  // Earlier still: once a plate that can be opened is on screen, its window is built in idle time and
  // kept out of rendering (content-visibility), so it costs nothing per frame until there's intent.
  if (!desktop()) return;
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.app!;
        if (e.intersectionRatio < 0.6 || open || standby?.id === id) continue;
        idle(() => {
          if (!open && sourcePlate(id) === e.target) void loadTape(`/tapes/${id}.json`).then(() => !open && prepare(id));
        });
      }
    },
    { threshold: [0, 0.6] },
  );
  document.querySelectorAll<HTMLElement>('.plate[data-app]').forEach((p) => seen.observe(p));
}
