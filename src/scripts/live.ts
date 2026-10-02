/**
 * Live previews. A product's preview starts as a tape (src/scripts/tape.ts): its own DOM, replayed.
 * Once the visitor is using the page and the preview is on screen, the real app boots under it, hidden,
 * and keeps up with the tape: the scene's recorded clicks are replayed in it as the tape reaches them,
 * with its clock and timers following the recording (scripts/apps/bridge.js). So at any moment the
 * live app is in the state the tape shows.
 *
 * - Hover: the live app takes the tape's place on the same frame. From
 *   there it's the app: hover states, cursors and clicks are real. Its bar has only the window lights,
 *   which keep to the pointer's side.
 * - The green light: the preview's contents (the live app itself, moved with moveBefore so it keeps
 *   its state) go into a window over the page, where the app runs at its own size. The case study, the
 *   live site and the source wait under it. Red or yellow, Escape, a click outside or Back return it
 *   to the preview, still live.
 *
 * Nothing boots before the visitor's first input, so page-load audits (Lighthouse) never pay for it,
 * and only one app runs at a time: it's dropped when its preview leaves the screen. Desktop pointers
 * only; on touch screens previews stay tapes and links stay links.
 */
import { loadTape, type Action, type Tape, type TapePlayer } from './tape';

const FLIGHT = 620; // the window's morph, ms (its curve is in global.css, .live-vt)
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
    /** The site's theme switch (Bar.astro): a circle from a point, or opening out from a rectangle. */
    __faTheme?: (from?: { x: number; y: number } | { rect: DOMRect }) => void;
    /** Maps a point on the screen to this page's viewport (Bar.astro), once the pointer has moved here. */
    __faScreen?: (screenX: number, screenY: number) => { x: number; y: number } | undefined;
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
    this.syncTheme();
    // A theme the app switches itself (in its own settings) is the site's too: the site takes the
    // other edition, opening out from the app's window to the edges. (This site, running inside
    // itself, hands its toggle to the page around it instead: see Bar.astro.)
    const appRoot = frame.contentDocument!.documentElement;
    new MutationObserver(() => {
      const theirs = appRoot.getAttribute(tape.themeAttr);
      if (theirs && theirs === document.documentElement.dataset.theme)
        window.__faTheme?.({ rect: (frame.closest('.thaw-window, .plate') ?? frame).getBoundingClientRect() });
    }).observe(appRoot, { attributes: true, attributeFilter: [tape.themeAttr] });
    const win = frame.contentWindow!;
    // Where the pointer is over the app, for the window lights (they keep to the pointer's side).
    win.addEventListener('pointermove', (e) => frame.dispatchEvent(new CustomEvent('live:pointer', { bubbles: true, detail: e.clientX / win.innerWidth })), {
      passive: true,
    });
    // In a preview the app takes the pointer and clicks, but not the wheel: that still scrolls the page
    // (and moves the showcase, which listens for it). In its window, the app scrolls itself.
    win.addEventListener(
      'wheel',
      (e) => {
        if (!this.plate.contains(frame)) return;
        e.preventDefault();
        const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
        const pass = new WheelEvent('wheel', { deltaX: e.deltaX * k, deltaY: e.deltaY * k, bubbles: true, cancelable: true });
        if (this.plate.dispatchEvent(pass)) scrollBy(e.deltaX * k, e.deltaY * k);
      },
      { passive: false },
    );
    this.#follow();
  }

  /**
   * Follows the site's theme switch, inverted like the tape: on the same frame, so the switch's circle
   * spreads over the app too. The app's own key is saved, so it reloads in that edition; a key this
   * site shares with the app (this site in itself) is left to the site.
   */
  syncTheme() {
    const doc = this.frame?.contentDocument;
    if (!doc || !this.tape) return;
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.documentElement.setAttribute(this.tape.themeAttr, theme);
    const key = this.tape.app.themeKey;
    if (key && !this.tape.app.restore?.includes(key))
      try {
        localStorage.setItem(key, theme);
      } catch {}
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
// Window lights: the only controls on a live preview's bar, as on a Mac. In the preview the green one
// opens the app in a window; in the window, red and yellow light up and take it back. There's a set
// in each corner of the bar and only the one on the pointer's side shows, so they're always at hand,
// and that they answer the pointer at all says they're real.
// ---------------------------------------------------------------------------------------------------

const glyph = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
const GLYPHS = {
  close: glyph('<path d="m7 7 10 10M17 7 7 17"/>'),
  min: glyph('<path d="M6 12h12"/>'),
  // Two corners pointing out (zoom) or in (back), as on a Mac.
  zoom: glyph('<path d="M6 6h9l-9 9zM18 18H9l9-9z" fill="currentColor" stroke="none"/>'),
  unzoom: glyph('<path d="M11.5 11.5H3.5l8-8zM12.5 12.5h8l-8 8z" fill="currentColor" stroke="none"/>'),
};

function lightsHTML(mode: 'preview' | 'window', name: string) {
  const open = mode === 'window';
  const b = (kind: 'close' | 'min' | 'zoom', label: string, on: boolean, g = GLYPHS[kind]) =>
    `<button class="light light--${kind}" type="button" data-light="${kind}" aria-label="${label}"${on ? '' : ' disabled'}>${g}</button>`;
  const set = (side: 'left' | 'right') =>
    `<span class="lights lights--${side}"${side === 'right' ? ' inert' : ''}>${b('close', `Close ${name}`, open)}${b('min', `Minimize ${name}`, open)}${
      open ? b('zoom', `Restore ${name}`, true, GLYPHS.unzoom) : b('zoom', `Open ${name} in a window`, true)
    }</span>`;
  return `<span class="lights-pair" data-side="left">${set('left')}${set('right')}</span>`;
}

/** Shows the set in one corner at once. */
function placeLights(pair: HTMLElement, side: 'left' | 'right') {
  pair.dataset.side = side;
  pair.querySelectorAll<HTMLElement>('.lights').forEach((set) => {
    set.getAnimations().forEach((a) => a.cancel());
    set.inert = !set.classList.contains(`lights--${side}`);
  });
}

/**
 * Shows the set on the side the pointer is on (`f`: its position across the window, 0 to 1, with a
 * dead band in the middle). Each set comes in from its own edge, moving inward, and leaves back out
 * toward it: the left one arrives moving right and leaves moving left, the right one the other way.
 */
function moveLights(pair: HTMLElement | null | undefined, f: number) {
  if (!pair?.isConnected) return;
  const now = pair.dataset.side === 'right' ? 'right' : 'left';
  const side = f > 0.56 ? 'right' : f < 0.44 ? 'left' : now;
  if (side === now) return;
  placeLights(pair, side);
  if (reduce.matches) return;
  const shift = (set: 'left' | 'right') => (set === 'left' ? -10 : 10); // toward that set's own edge
  const into = pair.querySelector<HTMLElement>(`.lights--${side}`)!;
  const out = pair.querySelector<HTMLElement>(`.lights--${now}`)!;
  into.animate(
    [
      { opacity: 0, transform: `translateX(${shift(side)}px)` },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', delay: 60, fill: 'backwards' },
  );
  out.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: `translateX(${shift(now)}px)` },
    ],
    { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
  );
}

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

  // ---- Geometry. The window takes the room the screen has, and the app runs in it at its own size
  // (1:1, scaled down only below 1100px wide), laid out for that size like any browser window.
  const BAR = 34;
  const [mx, top, bottom] = full ? [12, 12, 62] : [24, 18, 66];
  const availW = innerWidth - 2 * mx;
  const availH = innerHeight - top - bottom - BAR;
  const k = Math.min(1, availW / 1100);

  // ---- The window, at its landed size; hidden until the morph swaps it in.
  const overlay = document.createElement('div');
  overlay.className = 'thaw';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${name}, live`);
  overlay.style.setProperty('--accent', getComputedStyle(plate).getPropertyValue('--accent'));
  // The way on (case study, live site, source) and the way back sit outside the window, in the site's
  // own edition; the window's bar has only its lights.
  const action = (a: HTMLAnchorElement | null, label: string, i: string) =>
    a ? `<a class="btn btn--sm" href="${a.href}"${a.target === '_blank' ? ' target="_blank" rel="noopener"' : ''}>${i}${label}</a>` : '';
  overlay.innerHTML = `<div class="thaw-window plate plate--chrome" data-state="playing">
      <div class="thaw-bar">${lightsHTML('window', name)}</div>
      <div class="thaw-screen"></div>
    </div>
    <div class="thaw-actions">
      ${action(caseStudy, 'Case study', ICONS.doc)}${action(live, 'Live site', ICONS.out)}${action(source, 'Source', ICONS.code)}
      <p class="thaw-hint"><kbd>Esc</kbd> or click outside to return</p>
    </div>`;
  const win = overlay.querySelector<HTMLElement>('.thaw-window')!;
  const screen = overlay.querySelector<HTMLElement>('.thaw-screen')!;
  win.style.cssText = `transform:translate(${mx}px, ${top}px);width:${availW}px;height:${BAR + availH}px`;
  overlay.querySelector<HTMLElement>('.thaw-bar')!.style.height = `${BAR}px`;
  screen.style.cssText = `top:${BAR}px;width:${availW / k}px;height:${availH / k}px;transform:scale(${k})`;
  overlay.querySelector<HTMLElement>('.thaw-actions')!.style.top = `${top + BAR + availH + 14}px`;
  overlay.style.visibility = 'hidden';
  document.body.append(overlay);
  // The lights start on the side they were on in the preview.
  const plateLights = plate.querySelector<HTMLElement>('.lights-pair');
  const lights = win.querySelector<HTMLElement>('.lights-pair')!;
  placeLights(lights, plateLights?.dataset.side === 'right' ? 'right' : 'left');

  const r = plate.getBoundingClientRect();
  const root = document.documentElement;
  const layers = pageLayers();
  // The page steps back around the plate: only ever scaled down, so it keeps the raster it has.
  const back = full ? 'scale(0.94)' : 'scale(0.96)';
  const dim = full ? 0 : 0.35;
  root.style.setProperty('--live-o', `${r.left + r.width / 2}px ${r.top + r.height / 2}px`);
  root.style.setProperty('--live-back', back);
  root.style.setProperty('--live-dim', String(dim));
  // A page that scrolls keeps its scrollbar's room while it can't scroll, so it doesn't shift.
  root.classList.toggle('thawing-gutter', root.scrollHeight > root.clientHeight);

  /**
   * One side or the other: the preview's contents (tape, live app) move between the plate and the
   * window with moveBefore, so the app keeps its state and is laid out once, at its new size; the
   * page is set back (or forward) and can't be used (or can) while the window is open.
   */
  const swap = (open: boolean) => {
    if (open) screen.moveBefore(motion, null);
    else home.moveBefore(motion, homeNext);
    plate.style.visibility = open ? 'hidden' : '';
    overlay.style.visibility = open ? '' : 'hidden';
    root.classList.toggle('thawing', open);
    for (const el of layers) {
      el.inert = open;
      el.style.transformOrigin = open ? `${r.left + r.width / 2}px ${r.top + r.height / 2}px` : '';
      el.style.transform = open ? back : '';
      el.style.opacity = open ? String(dim) : '';
    }
  };
  /**
   * The morph is one view transition: the window grows from the plate (or shrinks into it) while the
   * page steps back (or forward) around it. The browser scales a picture of the app at the size it had
   * while the app, laid out at its new size, takes over within a few frames: never cropped by the
   * window, never snapping into place at the end, and all of it compositor work.
   */
  const morph = async (open: boolean, duration: number) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition };
    if (!doc.startViewTransition || reduce.matches) return swap(open);
    root.style.setProperty('--live-d', `${duration}ms`);
    root.classList.add('live-vt', open ? 'live-vt-in' : 'live-vt-out');
    (open ? plate : win).classList.add('live-vt-shape');
    const vt = doc.startViewTransition(() => {
      swap(open);
      plate.classList.toggle('live-vt-shape', !open);
      win.classList.toggle('live-vt-shape', open);
    });
    await vt.finished.catch(() => {});
    root.classList.remove('live-vt', 'live-vt-in', 'live-vt-out');
    plate.classList.remove('live-vt-shape');
    win.classList.remove('live-vt-shape');
  };

  // ---- In
  document.dispatchEvent(new CustomEvent('thaw:open'));
  // Not live yet (a click before the hover finished): it becomes live in the window.
  void session.goLive().then(() => session.frame.focus());
  await morph(true, FLIGHT);
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
    // The lights land on the side they're on now, in the plate too.
    if (plateLights) placeLights(plateLights, lights.dataset.side === 'right' ? 'right' : 'left');
    await morph(false, FLIGHT * 0.85);
    overlay.remove();
    root.classList.remove('thawing-gutter');
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
  overlay.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => void close()));
  // The lights keep to the pointer's side: over the page around the window, and over the app in it.
  overlay.addEventListener('pointermove', (e) => moveLights(lights, (e.clientX - mx) / availW));
  overlay.addEventListener('live:pointer', (e) => moveLights(lights, (e as CustomEvent<number>).detail));
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

  const ok = () => desktop() && canMove;
  const mark = () => document.documentElement.classList.toggle('live-ok', ok());
  mark();
  addEventListener('resize', mark, { passive: true });

  // A preview is the app: its bar has only the lights, and the green one opens it in a window. Until
  // the visitor has used a light on this visit, the green one calls for a look.
  const used = () => {
    document.documentElement.classList.add('lights-used');
    try {
      sessionStorage.setItem('live-lights-used', '1');
    } catch {}
  };
  try {
    if (sessionStorage.getItem('live-lights-used')) used();
  } catch {}
  document.addEventListener('click', (e) => (e.target as Element).closest?.('[data-light]') && used(), true);
  for (const plate of plates) plate.querySelector('.plate-dots')?.insertAdjacentHTML('afterend', lightsHTML('preview', nameOf(plate)));

  // Clicks on a preview are the app's (the plate sits in a link to the case study in the showcase, and
  // in the lightbox button on a case study: neither takes them). Only the green light opens the window.
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element;
      const plate = t.closest<HTMLElement>('.plate[data-app]');
      if (!plate || !ok() || plate.closest('.thaw')) return;
      e.preventDefault();
      e.stopPropagation();
      if (t.closest('[data-light="zoom"]')) void zoom(plate);
      else if (!t.closest('[data-light]')) void sessionFor(plate).goLive();
    },
    true,
  );

  // Hover: the preview lifts and the live app takes its place; the showcase holds while it's hovered.
  const lightsOf = (plate: HTMLElement) => plate.querySelector<HTMLElement>('.lights-pair');
  for (const plate of plates) {
    plate.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop()) return;
      document.dispatchEvent(new CustomEvent('live:hold', { detail: true }));
      const s = sessions.get(plate);
      if (s) void s.goLive();
    });
    plate.addEventListener('live:pointer', (e) => moveLights(lightsOf(plate), (e as CustomEvent<number>).detail));
    plate.addEventListener('pointerleave', () => {
      // (Moving into the app's frame isn't leaving.)
      requestAnimationFrame(() => !plate.matches(':hover') && document.dispatchEvent(new CustomEvent('live:hold', { detail: false })));
    });
  }
  // A preview booted under the pointer becomes live at once.
  const boot = (plate: HTMLElement) => {
    const s = sessionFor(plate);
    void s.booted.then(() => {
      if (plate.matches(':hover')) void s.goLive();
    });
  };

  // Boot only after the visitor's first input, and only for the preview on screen: in view, and not in
  // an inactive showcase slide (they overlap the active one, hidden and inert).
  let started = false;
  const visible = new Set<HTMLElement>();
  const inView = new Set<HTMLElement>();
  const start = () => {
    if (started || !desktop()) return;
    started = true;
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(type, start, true);
    for (const p of visible) idle(() => visible.has(p) && !zooming && boot(p));
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
      if (started && !zooming) idle(() => visible.has(plate) && boot(plate));
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
  // The lights of the previews on screen keep to the pointer's side of them, wherever it is on the page
  // (over an app, the app reports it: live:pointer). Read once a frame.
  let px = -1;
  let queued = 0;
  addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      queued ||= requestAnimationFrame(() => {
        queued = 0;
        if (!ok() || zooming) return;
        for (const p of visible) {
          const r = p.getBoundingClientRect();
          moveLights(lightsOf(p), (px - r.left) / r.width);
        }
      });
    },
    { passive: true },
  );
  // The theme switch reaches the live apps (it reaches the tapes in tape.ts).
  new MutationObserver(() => sessions.forEach((s) => s.syncTheme())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(() => plates.forEach(update)).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert'] });
}
