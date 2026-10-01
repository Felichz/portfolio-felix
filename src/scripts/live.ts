/**
 * Live previews. A product's preview starts as a tape (src/scripts/tape.ts): its own DOM, replayed.
 * Once the visitor is using the page and the preview is on screen, the real app boots under it, hidden,
 * and keeps up with the tape: the scene's recorded clicks are replayed in it as the tape reaches them,
 * with its clock and timers following the recording (scripts/apps/bridge.js). So at any moment the
 * live app is in the state the tape shows.
 *
 * - Hover: the preview lifts a little and the live app takes the tape's place on the same frame. Its
 *   hover states, tooltips and cursors are real from there on.
 * - Click: the preview's contents (the live app itself, moved with moveBefore so it keeps its state)
 *   go into a window over the page, with the portfolio's toolbar: the case study, the live site, the
 *   source, and Close. In the showcase the window keeps a margin of page around it; on a case study it
 *   fills the screen. Close, Escape, a click outside or Back return it to the preview, still live.
 *
 * Nothing boots before the visitor's first input, so page-load audits (Lighthouse) never pay for it,
 * and only one app runs at a time: it's dropped when its preview leaves the screen. Desktop pointers
 * only; on touch screens previews stay tapes and links stay links.
 */
import { loadTape, type Action, type Tape, type TapePlayer } from './tape';

const FLIGHT = 620;
const EASE = 'cubic-bezier(0.22, 0.8, 0.18, 1)';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 900;
const canMove = 'moveBefore' in Element.prototype;

interface Handoff {
  app: string;
  clock: number;
  readySelector: string;
  ready: () => void;
  /** Installed by the bridge: sets the app's clock, frozen or running; its timers follow it. */
  setClock?: (ms: number, freeze?: boolean, tick?: boolean) => void;
}
declare global {
  interface Window {
    __live?: Record<string, Handoff>;
  }
  interface Element {
    moveBefore(node: Node, child: Node | null): void;
  }
}

const frames = (win: Window, n = 2) =>
  new Promise<void>((r) => {
    const step = () => (--n <= 0 ? r() : win.requestAnimationFrame(step));
    win.requestAnimationFrame(step);
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------
// Driving the live app
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

/**
 * One app, booted under one preview. It follows the preview's tape: each recorded click is replayed
 * when the tape reaches it, with the app's clock frozen at that recorded moment, then left running in
 * step with the tape. `goLive` makes it the visible, interactive preview.
 */
class Session {
  tape!: Tape;
  frame!: HTMLIFrameElement;
  handoff!: Handoff;
  live = false;
  booted: Promise<void>;
  #done = 0;
  #busy: Promise<void> = Promise.resolve();
  #last = 0;
  #loop = 0;
  #disposed = false;
  #restore = new Map<string, string | null>();
  #capture?: (e: Event) => void;
  #fit?: ResizeObserver;

  constructor(
    public id: string,
    public plate: HTMLElement,
  ) {
    this.booted = this.#boot();
  }

  get player() {
    return this.plate.querySelector<TapePlayer>('tape-player') ?? undefined;
  }
  get motion() {
    return this.plate.querySelector<HTMLElement>('.plate-motion') ?? undefined;
  }
  get #now() {
    const p = this.player;
    return p?.tape && (p.currentTime > 0 || !p.paused) ? p.currentTime * 1000 : this.tape.duration;
  }
  #clockAt(t: number) {
    return this.tape.clock0 + t;
  }

  async #boot() {
    this.tape = await loadTape(`/tapes/${this.id}.json`);
    const tape = this.tape;
    const t = this.#now;
    const cp = [...tape.checkpoints].reverse().find((c) => c.t <= t) ?? tape.checkpoints[0]!;
    this.#done = (tape.actions ?? []).filter((a) => a.t <= cp.t).length;
    this.#last = t;

    // Storage as recorded at the checkpoint, in the edition the plate shows. Keys this site uses for
    // itself (its theme, when it's the app) go back as soon as the app has read them.
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    for (const key of tape.app.restore ?? []) this.#restore.set(key, localStorage.getItem(key));
    for (const key of tape.app.storage) {
      if (key in cp.storage) localStorage.setItem(key, cp.storage[key]!);
      else localStorage.removeItem(key);
    }
    if (tape.app.themeKey) localStorage.setItem(tape.app.themeKey, theme);

    let ready!: () => void;
    const painted = new Promise<void>((r) => (ready = r));
    this.handoff = { app: this.id, clock: this.#clockAt(cp.t), readySelector: tape.app.readySelector, ready: () => ready() };
    (window.__live ??= {})[this.id] = this.handoff;

    const frame = document.createElement('iframe');
    frame.className = 'live-app';
    frame.title = `${nameOf(this.plate)}, live`;
    frame.tabIndex = -1;
    frame.src = tape.app.entry.replace(/\/$/, '') + cp.route;
    this.frame = frame;
    this.motion?.append(frame);
    // The app runs at the recorded 1440x900 and is scaled to its container, like the tape.
    this.#fit = new ResizeObserver(() => {
      const m = frame.parentElement;
      if (m) m.style.setProperty('--live-k', String(Math.max(m.clientWidth / 1440, m.clientHeight / 900)));
    });
    this.#fit.observe(this.motion!);
    // Apps without the bridge (this site, opened in itself) are watched from here: same origin.
    const watch = window.setInterval(() => {
      const doc = frame.contentDocument;
      if (this.#disposed) return clearInterval(watch);
      if (!doc || doc.readyState === 'loading' || !doc.querySelector(tape.app.readySelector)) return;
      clearInterval(watch);
      void doc.fonts.ready.then(() => frames(frame.contentWindow!).then(ready));
    }, 50);
    await painted;
    for (const [k, v] of this.#restore) v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    this.#capture = (e: Event) => {
      // Previewed, the app takes hover but not clicks: a click opens it.
      if (this.live && this.plate.contains(this.frame) && !document.querySelector('.thaw')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.type === 'pointerdown') void zoom(this.plate);
      }
    };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu'])
      frame.contentWindow!.addEventListener(type, this.#capture, true);
    this.#follow();
  }

  /** Keeps up with the tape: replays the clicks it passes; restarts if the tape went back. */
  #follow = () => {
    if (this.#disposed || this.live) return;
    const t = this.#now;
    if (t < this.#last - 300) return void this.#reboot();
    this.#last = t;
    const next = (this.tape.actions ?? [])[this.#done];
    if (next && next.t <= t) {
      this.#done++;
      this.#busy = this.#busy.then(() => this.#replay(next));
    }
    this.#loop = requestAnimationFrame(this.#follow);
  };

  async #replay(a: Action) {
    const win = this.frame.contentWindow as Window & typeof globalThis;
    const doc = this.frame.contentDocument;
    if (!win || !doc) return;
    this.handoff.setClock?.(this.#clockAt(a.t), true);
    let el: HTMLElement | undefined;
    for (let tries = 0; !(el = resolve(doc, a)) && tries < 40; tries++) await frames(win, 1);
    if (el) click(win, el);
    await quiet(win, doc);
    this.handoff.setClock?.(this.#clockAt(this.#now), false);
  }

  #reboot() {
    const { id, plate } = this;
    this.dispose();
    sessions.set(plate, new Session(id, plate));
  }

  /**
   * Makes the live app the preview, on the frame the tape is on: the tape stops, the app catches up
   * (clicks still in flight, timers that fell due), settles its clock on the time the frame shows (the
   * last time its text changed), and takes the tape's place. From here it's interactive.
   */
  async goLive() {
    if (this.live) return;
    await this.booted;
    await this.#busy;
    if (this.live || this.#disposed) return;
    cancelAnimationFrame(this.#loop);
    const player = this.player;
    const at = this.#now;
    player?.pause();
    // Clicks the tape had reached but the app hadn't yet.
    for (const a of (this.tape.actions ?? []).slice(this.#done)) if (a.t <= at) {
      this.#done++;
      await this.#replay(a);
    }
    let shown = 0;
    for (const a of this.tape.actions ?? []) if (a.t <= at) shown = Math.max(shown, a.t);
    for (const e of this.tape.events) if (e[0] === 't' && e[1] <= at && e[1] > shown) shown = e[1];
    const win = this.frame.contentWindow!;
    const doc = this.frame.contentDocument!;
    const settle = async () => {
      await quiet(win, doc, 500);
      await Promise.race([Promise.all(doc.getAnimations().map((x) => x.finished.catch(() => {}))), sleep(600)]);
    };
    this.handoff.setClock?.(this.#clockAt(at), true);
    await settle();
    this.handoff.setClock?.(this.#clockAt(shown), true, true);
    await frames(win);
    this.handoff.setClock?.(this.#clockAt(shown), false);
    this.live = true;
    this.plate.dataset.live = '';
    this.motion?.removeAttribute('aria-hidden');
    this.frame.tabIndex = 0;
    this.frame.classList.add('shown');
  }

  dispose() {
    this.#disposed = true;
    cancelAnimationFrame(this.#loop);
    this.#fit?.disconnect();
    this.frame?.remove();
    if (window.__live) delete window.__live[this.id];
    delete this.plate.dataset.live;
    this.motion?.setAttribute('aria-hidden', 'true');
    const player = this.player;
    // The tape picks up from where the app was.
    if (this.live && player?.tape && this.plate.dataset.state === 'playing') void player.play();
    if (sessions.get(this.plate) === this) sessions.delete(this.plate);
  }
}

const sessions = new Map<HTMLElement, Session>();
const sessionFor = (plate: HTMLElement) => {
  let s = sessions.get(plate);
  if (!s) {
    // One app at a time.
    for (const other of [...sessions.values()]) other.dispose();
    s = new Session(plate.dataset.app!, plate);
    sessions.set(plate, s);
  }
  return s;
};

// ---------------------------------------------------------------------------------------------------
// Zoom: the live preview, in a window
// ---------------------------------------------------------------------------------------------------

const icon = (d: string) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  out: icon('<path d="M7 17 17 7"/><path d="M7 7h10v10"/>'),
  close: icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  doc: icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'),
  code: icon('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
};

/** The product's name, from the showcase slide or the case study around the plate. */
const nameOf = (plate: HTMLElement) =>
  (plate.closest('[data-slide], section')?.querySelector('.slide-name, #cs-name')?.textContent ?? plate.dataset.app ?? '').replace(/\s+/g, ' ').trim();

/** The page layers that step back behind the window: everything in <body> but the overlay. */
const pageLayers = () =>
  [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains('thaw') && el.tagName !== 'SCRIPT');

let zooming = false;

async function zoom(plate: HTMLElement) {
  if (zooming || !plate.isConnected) return;
  const scope = plate.closest('[data-slide], section') ?? document;
  const link = (kind: string) => scope.querySelector<HTMLAnchorElement>(`a[data-link="${kind}"]`);
  const caseStudy = plate.closest('[data-slide]') ? link('case') : null;
  const live = link('live');
  const source = link('source');
  // Without a move that keeps an iframe's state, a window would mean starting the app over: take
  // the visitor to the case study or the live site instead.
  if (!canMove || !desktop()) {
    const to = caseStudy ?? live;
    if (to) to.target === '_blank' ? window.open(to.href, '_blank', 'noopener') : (location.href = to.href);
    return;
  }
  zooming = true;
  const session = sessionFor(plate);
  const motion = plate.querySelector<HTMLElement>('.plate-motion')!;
  const home = motion.parentElement!;
  const homeNext = motion.nextSibling;
  const name = nameOf(plate);
  const full = !caseStudy; // on a case study the window takes the screen

  // ---- The window: the plate rebuilt at the app's 1440×900, with the portfolio's toolbar.
  const r = plate.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'thaw';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${name}, live`);
  overlay.style.setProperty('--accent', getComputedStyle(plate).getPropertyValue('--accent'));
  overlay.innerHTML = `<div class="thaw-window plate plate--chrome" data-state="playing"><div class="thaw-chrome"></div><div class="thaw-screen"></div></div>
    <p class="thaw-hint" aria-hidden="true"><kbd>Esc</kbd> or click outside to return to the portfolio</p>`;
  const win = overlay.querySelector<HTMLElement>('.thaw-window')!;
  const screen = overlay.querySelector<HTMLElement>('.thaw-screen')!;
  win.style.setProperty('--bar-k', String(1440 / r.width));
  const chrome = plate.querySelector('.plate-chrome')?.cloneNode(true) as HTMLElement | undefined;
  if (chrome) {
    const tools = chrome.querySelector('.plate-tools')!;
    tools.replaceChildren();
    const tool = (a: HTMLAnchorElement | null, label: string, i: string) =>
      a ? `<a class="motion-btn thaw-tool" href="${a.href}"${a.target === '_blank' ? ' target="_blank" rel="noopener"' : ''}>${i}<span>${label}</span></a>` : '';
    tools.insertAdjacentHTML(
      'beforeend',
      tool(caseStudy, 'Case study', ICONS.doc) +
        tool(live, 'Live site', ICONS.out) +
        tool(source, 'Source', ICONS.code) +
        `<button class="motion-btn thaw-tool thaw-close" type="button" aria-label="Close ${name} and return to the portfolio">${ICONS.close}<span>Close</span><kbd>Esc</kbd></button>`,
    );
    overlay.querySelector('.thaw-chrome')!.append(chrome);
  }
  document.body.append(overlay);

  // ---- Geometry: from the plate to a centered window, one uniform scale.
  const H = 900 + 30 * (1440 / r.width);
  const s0 = r.width / 1440;
  const margin = full ? 16 : Math.max(40, Math.min(innerWidth, innerHeight) * 0.08);
  const k = Math.min((innerWidth - 2 * margin) / 1440, (innerHeight - 2 * margin - (full ? 0 : 28)) / H);
  const x1 = (innerWidth - 1440 * k) / 2;
  const y1 = (innerHeight - H * k) / 2 - (full ? 0 : 14);
  const lift = `translate(${r.left}px, ${r.top}px) scale(${s0})`;
  const land = `translate(${x1}px, ${y1}px) scale(${k})`;
  const layers = pageLayers();
  const origin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  layers.forEach((el) => (el.style.transformOrigin = origin));
  // The page steps back: only ever scaled down, so its layers keep the raster they have.
  const back = full ? 'scale(0.94)' : 'scale(0.96)';
  const dim = full ? 0 : 0.35;
  const opts: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT, easing: EASE, fill: 'both' };

  // ---- The move: the preview's contents (tape, live app) go into the window as they are.
  screen.moveBefore(motion, null);
  plate.style.visibility = 'hidden';
  document.documentElement.classList.add('thawing');
  document.dispatchEvent(new CustomEvent('thaw:open'));
  const flights = [
    win.animate([{ transform: lift }, { transform: land }], opts),
    ...layers.map((el) => el.animate([{ transform: 'none', opacity: 1 }, { transform: back, opacity: dim }], opts)),
  ];
  // Not live yet (a click before the hover finished): it becomes live in the window.
  void session.goLive().then(() => session.frame.focus());
  await Promise.all(flights.map((f) => f.finished));
  layers.forEach((el) => (el.inert = true));
  overlay.classList.add('landed');

  // ---- Leaving
  let closing = false;
  const close = async (viaHistory = false) => {
    if (closing) return;
    closing = true;
    removeEventListener('popstate', onPop);
    removeEventListener('keydown', onKey, true);
    session.frame.contentWindow?.removeEventListener('keydown', onKey, true);
    if (!viaHistory && history.state?.liveZoom) history.back();
    overlay.classList.remove('landed');
    layers.forEach((el) => (el.inert = false));
    const ret: KeyframeAnimationOptions = { duration: reduce.matches ? 1 : FLIGHT * 0.85, easing: EASE, fill: 'both' };
    const returns = [
      win.animate([{ transform: land }, { transform: lift }], ret),
      ...layers.map((el) => el.animate([{ transform: back, opacity: dim }, { transform: 'none', opacity: 1 }], ret)),
    ];
    flights.forEach((f) => f.cancel());
    await Promise.all(returns.map((f) => f.finished));
    home.moveBefore(motion, homeNext);
    plate.style.visibility = '';
    overlay.remove();
    returns.forEach((f) => f.cancel());
    layers.forEach((el) => (el.style.transformOrigin = ''));
    document.documentElement.classList.remove('thawing');
    document.dispatchEvent(new CustomEvent('thaw:close'));
    zooming = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // The app's own dialogs and menus take Escape first.
    if (session.frame.contentDocument?.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    e.preventDefault();
    void close();
  };
  addEventListener('keydown', onKey, true);
  session.frame.contentWindow?.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => e.target === overlay && void close());
  overlay.querySelector('.thaw-close')?.addEventListener('click', () => void close());
  // The deck listens on window: keep wheel and keys over the overlay from moving the page under it.
  for (const type of ['wheel', 'keydown'] as const) overlay.addEventListener(type, (e) => e.stopPropagation());
  history.pushState({ ...(history.state ?? {}), liveZoom: true }, '', location.href);
  const onPop = () => void close(true);
  addEventListener('popstate', onPop, { once: true });
}

// ---------------------------------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------------------------------

export function initLive() {
  // Inside an app's frame (this site, opened in itself), previews stay tapes: no apps in apps.
  if (window !== window.top) return;
  const plates = [...document.querySelectorAll<HTMLElement>('.plate[data-app]')];
  if (!plates.length) return;

  // A click on a preview opens it (the plate is wrapped in a link to the case study in the showcase,
  // and in the lightbox button on a case study).
  document.addEventListener(
    'click',
    (e) => {
      const plate = (e.target as Element).closest<HTMLElement>('.plate[data-app]');
      if (!plate || !desktop() || !canMove || (e as MouseEvent).button !== 0) return;
      if ((e.target as Element).closest('.plate-tools')) return; // its own buttons (Play recording)
      e.preventDefault();
      e.stopPropagation();
      void zoom(plate);
    },
    true,
  );

  // Hover: the preview lifts and the live app takes its place; the showcase holds while it's hovered.
  for (const plate of plates) {
    plate.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop()) return;
      document.dispatchEvent(new CustomEvent('live:hold', { detail: true }));
      const s = sessions.get(plate);
      if (s) void s.goLive();
    });
    plate.addEventListener('pointerleave', () => document.dispatchEvent(new CustomEvent('live:hold', { detail: false })));
  }

  // Boot only after the visitor's first input, and only for the preview on screen: in view, and not in
  // an inactive showcase slide (they overlap the active one, hidden and inert).
  let started = false;
  const visible = new Set<HTMLElement>();
  const inView = new Set<HTMLElement>();
  const start = () => {
    if (started || !desktop()) return;
    started = true;
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(type, start, true);
    for (const p of visible) idle(() => visible.has(p) && !zooming && sessionFor(p));
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, start, { capture: true, passive: true });
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
  const leaving = new Map<HTMLElement, number>();
  const update = (plate: HTMLElement) => {
    const on = inView.has(plate) && !plate.closest('[inert]');
    if (on === visible.has(plate)) return;
    if (on) {
      visible.add(plate);
      clearTimeout(leaving.get(plate));
      if (started && !zooming) idle(() => visible.has(plate) && sessionFor(plate));
    } else {
      visible.delete(plate);
      // Off screen for a moment: let the app go (not while its window is open).
      leaving.set(plate, window.setTimeout(() => !zooming && !visible.has(plate) && sessions.get(plate)?.dispose(), 1200));
    }
  };
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const plate = e.target as HTMLElement;
        if (e.intersectionRatio >= 0.6) inView.add(plate);
        else inView.delete(plate);
        update(plate);
      }
    },
    { threshold: [0, 0.6] },
  );
  plates.forEach((p) => seen.observe(p));
  new MutationObserver(() => plates.forEach(update)).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert'] });
}
