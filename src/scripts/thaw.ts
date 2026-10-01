/**
 * Thaw: clicking "Live" on a product with a tape opens the real app here, from the frame the preview
 * was on, instead of sending the visitor to another site.
 *
 * 1. The camera flies into the product's window: a copy of the plate lifts off over it and grows to
 *    fill the screen while the page scales past it, as if moving through the glass. Both are transform
 *    animations, so they run on the compositor while the main thread is busy starting the app.
 * 2. The copy is a tape too. It continues to the next checkpoint, a rest point recorded with the
 *    app's storage and clock, fast enough to arrive by the time the flight lands.
 * 3. Meanwhile the vendored build of the app (public/apps/<id>/, same origin) boots in a frame under
 *    it, with that storage seeded and its clock set to the recorded moment (scripts/apps/bridge.js).
 * 4. When the app reports its first paint, it fades in over the tape. Same DOM, same state, same CSS:
 *    there is nothing to see but the cursor becoming yours.
 * Escape, the close button or Back reverse the flight. Nothing loads before the first sign of intent:
 * hovering or focusing the link prefetches the app's files.
 */
import { loadTape, type Checkpoint, type Tape, type TapePlayer } from './tape';

const FLIGHT = 680;
const EASE = 'cubic-bezier(0.22, 0.8, 0.18, 1)';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

interface Handoff {
  app: string;
  clock: number;
  real: number;
  readySelector: string;
  ready: () => void;
}
declare global {
  interface Window {
    __thaw?: Handoff;
  }
}

let open: { close: (viaHistory?: boolean) => void } | null = null;

const icon = (d: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const LOCK = icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');
const OUT = icon('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>');
const CLOSE = icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

/** The plate showing this app right now: the active slide's, or the case study's lead. */
function sourcePlate(id: string) {
  const plates = [...document.querySelectorAll<HTMLElement>(`.plate[data-app="${id}"]`)];
  return plates.find((p) => {
    const r = p.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !p.closest('[inert]');
  });
}

/** The page layers the camera moves past: everything in <body> but the overlay. */
const pageLayers = (overlay: HTMLElement) =>
  [...document.body.children].filter((el): el is HTMLElement => el !== overlay && el instanceof HTMLElement && el.tagName !== 'SCRIPT');

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
 * The window an app opens in, built ahead on intent and kept invisible and inert: its tape copy has
 * parsed the app's CSS, built the recorded DOM and laid it out at the window's size before the click,
 * so the flight can start on the very next frame.
 */
interface Window_ {
  id: string;
  size: string;
  overlay: HTMLElement;
  win: HTMLElement;
  screen: HTMLElement;
  status: HTMLElement;
  copy: TapePlayer;
  ready: Promise<void>;
}
let standby: Window_ | null = null;
const BAR = 40;

function prepare(id: string): Window_ {
  const size = `${innerWidth}x${innerHeight}`;
  if (standby?.id === id && standby.size === size) return standby;
  standby?.overlay.remove();
  const overlay = document.createElement('div');
  overlay.className = 'thaw standby';
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="thaw-window">
      <div class="thaw-bar">
        <span class="plate-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="plate-url">${LOCK}<span class="thaw-host"></span><span class="thaw-status" aria-live="polite"></span></span>
        <span class="thaw-tools">
          <a class="thaw-tool thaw-out" target="_blank" rel="noopener">${OUT}<span>New tab</span></a>
          <button class="thaw-tool thaw-close" type="button" aria-label="Close the app and return">${CLOSE}<span>Close</span><kbd>Esc</kbd></button>
        </span>
      </div>
      <div class="thaw-screen"></div>
    </div>`;
  const screen = overlay.querySelector<HTMLElement>('.thaw-screen')!;
  const copy = document.createElement('tape-player') as TapePlayer;
  copy.className = 'thaw-tape';
  copy.setAttribute('src', `/tapes/${id}.json`);
  // The copy plays at the window's real size: the recorded DOM reflows to it, as the live app will.
  copy.viewport = [innerWidth, innerHeight - BAR];
  screen.append(copy);
  document.body.append(overlay);
  standby = {
    id,
    size,
    overlay,
    screen,
    copy,
    win: overlay.querySelector<HTMLElement>('.thaw-window')!,
    status: overlay.querySelector<HTMLElement>('.thaw-status')!,
    ready: copy.ready(),
  };
  return standby;
}

/**
 * On hover the prepared window starts being painted (still invisible) and its copy plays along with the
 * plate, so a click finds it painted and on the same frame. Before that it costs nothing per frame.
 */
function warm(w: Window_, on: boolean) {
  w.overlay.classList.toggle('warm', on);
  if (!on) return w.copy.pause();
  const player = sourcePlate(w.id)?.querySelector<TapePlayer>('tape-player');
  void w.ready.then(() => {
    if (standby !== w || !w.overlay.classList.contains('warm') || !player?.tape) return;
    w.copy.currentTime = player.currentTime;
    if (!player.paused) void w.copy.play();
  });
}

async function thaw(id: string, trigger: HTMLAnchorElement) {
  if (open) return;
  const plate = sourcePlate(id);
  const tape = await loadTape(`/tapes/${id}.json`);
  const player = plate?.querySelector<TapePlayer>('tape-player');
  const from = player?.tape ? player.currentTime * 1000 : 0;
  player?.pause();

  // The next rest point. Past the last one only the cursor moves, so that state is already at rest.
  const cps = tape.checkpoints;
  const cp: Checkpoint = cps.find((c) => c.t >= from - 50) ?? cps[cps.length - 1]!;
  const ahead = Math.max(0, cp.t - from);
  // After landing, the copy plays on to the checkpoint, faster when it's far.
  const rate = Math.min(4, Math.max(1, ahead / 700));
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

  // ---- Seed: the app's storage as recorded at the checkpoint, in the edition the plate shows. What was
  // there before goes back on close: the app shares this origin's storage (this site's own theme, too).
  const keys = [...new Set([...tape.app.storage, ...(tape.app.themeKey ? [tape.app.themeKey] : [])])];
  const before = new Map(keys.map((k) => [k, localStorage.getItem(k)]));
  for (const key of tape.app.storage) {
    if (key in cp.storage) localStorage.setItem(key, cp.storage[key]!);
    else localStorage.removeItem(key);
  }
  if (tape.app.themeKey) localStorage.setItem(tape.app.themeKey, theme);

  // ---- The window, usually already built on intent: label it for this app and bring its copy to now.
  const { overlay, win, screen, status, copy, ready } = prepare(id);
  standby = null;
  await ready;
  copy.currentTime = from / 1000;
  overlay.querySelector('.thaw-host')!.textContent = new URL(trigger.href).host;
  overlay.querySelector<HTMLAnchorElement>('.thaw-out')!.href = trigger.href;
  overlay.classList.remove('standby');
  overlay.inert = false;
  overlay.removeAttribute('aria-hidden');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${trigger.dataset.name ?? id}, running live`);
  if (plate) overlay.style.setProperty('--accent', getComputedStyle(plate).getPropertyValue('--accent'));

  // ---- The flight
  const layers = pageLayers(overlay);
  const r = (plate ?? trigger).getBoundingClientRect();
  const s = r.width / innerWidth;
  const x = r.left;
  const y = r.top + (r.height - s * innerHeight) / 2;
  const camera = `translate(${(innerWidth / 2 - (r.left + r.width / 2) / s).toFixed(1)}px, ${(innerHeight / 2 - (r.top + r.height / 2) / s).toFixed(1)}px) scale(${(1 / s).toFixed(4)})`;
  const lift = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
  const radius = `${(14 / s).toFixed(1)}px`;
  const opts: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT, easing: EASE, fill: 'both' };

  if (plate) plate.style.visibility = 'hidden';
  layers.forEach((el) => (el.style.transformOrigin = '0 0'));
  document.documentElement.classList.add('thawing');
  document.dispatchEvent(new CustomEvent('thaw:open', { detail: { id } }));

  // The copy holds still in flight: a static picture flies on the compositor alone.
  copy.pause();

  const flights = [
    win.animate([{ transform: lift, borderRadius: radius }, { transform: 'none', borderRadius: '0px' }], opts),
    ...layers.map((el) => el.animate([{ transform: 'none', opacity: 1 }, { transform: camera, opacity: 0 }], opts)),
  ];
  await Promise.all(flights.map((f) => f.finished));
  layers.forEach((el) => (el.style.visibility = 'hidden'));

  // ---- The live app, under the tape, invisible until it has painted. It starts once the flight has
  // landed: booting it during the flight cost the page frames, and on screen the tape already looks
  // exactly like it.
  let appReady!: () => void;
  const painted = new Promise<void>((r) => (appReady = r));
  window.__thaw = {
    app: id,
    clock: cp.clock + Math.max(0, from - cp.t),
    real: Date.now() + ahead / rate,
    readySelector: tape.app.readySelector,
    ready: () => appReady(),
  };
  // Landed: the copy finishes what it was doing while the app boots under it.
  copy.playbackRate = rate;
  const reached = ahead > 0 ? copy.playTo(cp.t) : Promise.resolve();
  const frame = document.createElement('iframe');
  frame.className = 'thaw-app';
  frame.title = trigger.dataset.name ?? id;
  frame.src = tape.app.entry.replace(/\/$/, '') + cp.route;
  screen.append(frame);
  // Apps without the bridge (this site, opened in itself) are watched from here: same origin.
  const watch = window.setInterval(() => {
    const doc = frame.contentDocument;
    if (!doc || doc.readyState === 'loading' || !doc.querySelector(tape.app.readySelector)) return;
    clearInterval(watch);
    void doc.fonts.ready.then(() => frame.contentWindow?.requestAnimationFrame(() => frame.contentWindow?.requestAnimationFrame(() => appReady())));
  }, 50);

  // ---- The swap
  const slow = window.setTimeout(() => (status.textContent = 'Starting the app…'), 400);
  await Promise.all([painted, reached]);
  clearTimeout(slow);
  status.textContent = '';
  copy.pause();
  await frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce.matches ? 1 : 180, easing: 'ease-out', fill: 'forwards' }).finished;
  frame.style.opacity = '1';
  copy.remove();
  frame.focus();
  frame.contentWindow?.focus();

  // ---- Leaving
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // The app's own dialogs take Escape first.
    if (frame.contentDocument?.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    e.preventDefault();
    close();
  };
  frame.contentWindow?.addEventListener('keydown', onKey);
  overlay.addEventListener('keydown', onKey);
  // The deck listens on window: keep wheel and keys inside the window from moving the page under it.
  for (const type of ['wheel', 'keydown', 'pointerdown'] as const) overlay.addEventListener(type, (e) => e.stopPropagation());
  overlay.querySelector('.thaw-close')!.addEventListener('click', () => close());

  history.pushState({ ...(history.state ?? {}), thaw: id }, '', location.href);
  const onPop = () => close(true);
  addEventListener('popstate', onPop, { once: true });

  let closing = false;
  const close = async (viaHistory = false) => {
    if (closing) return;
    closing = true;
    removeEventListener('popstate', onPop);
    if (!viaHistory && history.state?.thaw === id) history.back();
    const back = plate ? sourcePlate(id) ?? plate : null;
    const rb = (back ?? trigger).getBoundingClientRect();
    if (plate) plate.style.visibility = '';
    const sb = (rb.width || r.width) / innerWidth;
    const land = `translate(${rb.left.toFixed(1)}px, ${(rb.top + (rb.height - sb * innerHeight) / 2).toFixed(1)}px) scale(${sb.toFixed(4)})`;
    if (plate) plate.style.visibility = 'hidden';
    layers.forEach((el) => (el.style.visibility = ''));
    const ret: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT * 0.85, easing: EASE, fill: 'both' };
    const returns = [
      win.animate([{ transform: 'none', borderRadius: '0px', opacity: 1 }, { transform: land, borderRadius: radius, opacity: 1 }], ret),
      ...layers.map((el) => el.animate([{ transform: camera, opacity: 0 }, { transform: 'none', opacity: 1 }], ret)),
    ];
    flights.forEach((f) => f.cancel());
    await Promise.all(returns.map((f) => f.finished));
    // The plate picks up where the app was thawed from.
    if (player?.tape) player.currentTime = cp.t / 1000;
    if (plate) plate.style.visibility = '';
    overlay.remove();
    returns.forEach((f) => f.cancel());
    layers.forEach((el) => (el.style.transformOrigin = ''));
    document.documentElement.classList.remove('thawing', 'thaw-ready');
    delete window.__thaw;
    clearInterval(watch);
    for (const [k, v] of before) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
    open = null;
    document.dispatchEvent(new CustomEvent('thaw:close', { detail: { id } }));
    trigger.focus({ preventScroll: true });
  };
  open = { close };
}

/** Any link with data-thaw="<id>" opens that app in place; modified clicks still open the real site. */
export function initThaw() {
  // Inside a thawed frame (this site opened in itself), links behave like links: no frames in frames.
  if (window !== window.top) return;
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-thaw]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || innerWidth < 900) return; // phones: the real site
    e.preventDefault();
    void thaw(a.dataset.thaw!, a);
  });
  // Intent: fetch the tape and the app's files, and promote the page layers the camera will move, so
  // their first raster happens now rather than in the flight's first frame.
  const root = document.documentElement;
  const intent = (e: Event) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[data-thaw]');
    if (!a) return;
    root.classList.add('thaw-ready');
    void loadTape(`/tapes/${a.dataset.thaw}.json`).then((tape) => {
      prefetch(tape);
      if (!open) warm(prepare(a.dataset.thaw!), true);
    });
  };
  const cool = (e: Event) => {
    if (!(e.target as Element).closest?.('a[data-thaw]') || open) return;
    root.classList.remove('thaw-ready');
    if (standby) warm(standby, false);
  };
  document.addEventListener('pointerover', intent, { passive: true });
  document.addEventListener('focusin', intent);
  document.addEventListener('pointerout', cool, { passive: true });
  document.addEventListener('focusout', cool);

  // Earlier still: once a plate that can be opened is on screen, its window is built in idle time, so
  // even a quick click finds it ready. One at a time, for the plate in view.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.app!;
        if (e.intersectionRatio < 0.6 || open || standby?.id === id || innerWidth < 900) continue;
        idle(() => {
          if (!open && sourcePlate(id) === e.target) void loadTape(`/tapes/${id}.json`).then(() => !open && prepare(id));
        });
      }
    },
    { threshold: [0, 0.6] },
  );
  document.querySelectorAll<HTMLElement>('.plate[data-app]').forEach((p) => seen.observe(p));
}
