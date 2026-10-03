/**
 * Live previews, the page's side. A product's preview is a <tape-player> (src/scripts/player.ts): its
 * tape plays in a stage (src/scripts/stage.ts), a frame from another site when there is one, in its own
 * process. Once the visitor is using the page, the stage boots the real app under the tape, hidden, and
 * keeps it in step with the tape (src/scripts/session.ts). So at any moment the live app is in the
 * state the tape shows.
 *
 * - Hover: the live app takes the tape's place on the same frame. From there it's the app: hover
 *   states, cursors and clicks are real. Its bar has only the window lights, which keep to the
 *   pointer's side.
 * - The green light: the preview's contents (the stage, moved with moveBefore so the app keeps its
 *   state) go into a window over the page, where the app runs at its own size. The case study, the live
 *   site and the source wait under it. Red or yellow, Escape, a click outside or Back return it to the
 *   preview, still live.
 *
 * What runs, and when (each app is expensive, and there are several):
 * - Nothing boots before the visitor's first input, so page-load audits never pay for it.
 * - A preview's app boots once it has been on screen for a moment (not while the showcase is passing
 *   through), one boot at a time, or at once when the pointer comes to it.
 * - An app that was only following its tape is dropped when its preview leaves the screen. One the
 *   visitor used is held instead (its clock stopped, its animations paused) and comes back as they
 *   left it; the two used most recently are kept. Everything is held while the tab is hidden.
 *
 * Desktop pointers only; on touch screens previews stay tapes and links stay links.
 */
import type { TapePlayer } from './player';

const FLIGHT = 560; // the window's morph, ms
/** Its curve: a gentle start and a long settle, shared by the window and the page behind it. */
const CURVE = 'cubic-bezier(0.45, 0, 0.15, 1)';
/** How long a preview is on screen before its app boots. */
const DWELL = 600;
/** Apps the visitor used that are kept (held) when their previews leave the screen. */
const KEEP = 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = () => matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 900;
const canMove = 'moveBefore' in Element.prototype;

declare global {
  interface Window {
    /** The site's theme switch (Bar.astro): a circle from a point, or opening out from a rectangle. */
    __faTheme?: (from?: { x: number; y: number } | { rect: DOMRect }) => void;
    /** Maps a point on the screen to this page's viewport (Bar.astro), once the pointer has moved here. */
    __faScreen?: (screenX: number, screenY: number) => { x: number; y: number } | undefined;
  }
  interface Element {
    moveBefore(node: Node, child: Node | null): void;
  }
}

const once = (target: EventTarget, type: string) => new Promise<void>((r) => target.addEventListener(type, () => r(), { once: true }));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------
// One preview's app, as the page sees it
// ---------------------------------------------------------------------------------------------------

type State = 'none' | 'booting' | 'following' | 'live';

/**
 * The page's handle on a preview's app: what state it's in, and the messages that move it along. The
 * work itself happens in the stage.
 */
class Live {
  state: State = 'none';
  held = false;
  inWindow = false;
  /** When the visitor last had it live, for keeping the most recent ones. */
  used = 0;
  #booted?: Promise<void>;
  #going?: Promise<void>;

  constructor(public plate: HTMLElement) {}

  get player() {
    return this.plate.querySelector<TapePlayer>('tape-player')!;
  }
  get motion() {
    return this.plate.querySelector<HTMLElement>('.plate-motion') ?? undefined;
  }

  /** Boots the app under the tape; resolves once it has painted and caught up to its checkpoint. */
  boot() {
    if (this.state === 'none') {
      this.state = 'booting';
      const player = this.player;
      this.#booted = once(player, 'stage:booted').then(() => {
        if (this.state === 'booting') this.state = 'following';
      });
      player.send({ k: 'boot' });
    }
    return this.#booted!;
  }

  /** The app takes the tape's place, booting first if it hasn't. However often it's asked, once. */
  goLive() {
    return (this.#going ??= (async () => {
      const player = this.player;
      const shown = once(player, 'stage:live');
      void this.boot();
      player.send({ k: 'live' });
      await shown;
      this.state = 'live';
      this.used = performance.now();
      this.player.ghost(-1, -1);
      this.plate.dataset.live = '';
      this.motion?.removeAttribute('aria-hidden');
      if (player.frame) {
        player.frame.tabIndex = 0;
        player.frame.removeAttribute('aria-hidden');
        player.frame.title = `${nameOf(this.plate)}, live`;
      }
      trim();
    })());
  }

  hold(on: boolean) {
    if (this.state === 'none' || this.held === on) return;
    this.held = on;
    this.player.send({ k: 'hold', on });
  }

  /** Lets the app go; the tape picks up where it was. */
  drop() {
    if (this.state === 'none') return;
    const wasLive = this.state === 'live';
    this.state = 'none';
    this.held = false;
    this.#booted = this.#going = undefined;
    const player = this.player;
    player.send({ k: 'drop' });
    delete this.plate.dataset.live;
    this.motion?.setAttribute('aria-hidden', 'true');
    if (player.frame) {
      player.frame.tabIndex = -1;
      player.frame.setAttribute('aria-hidden', 'true');
    }
    if (wasLive && this.plate.dataset.state === 'playing') void player.play();
  }
}

const lives = new Map<HTMLElement, Live>();
const liveFor = (plate: HTMLElement) => {
  let l = lives.get(plate);
  if (!l) lives.set(plate, (l = new Live(plate)));
  return l;
};
/** Keeps the apps the visitor used most recently; any other one that's held (off screen) goes. */
const trim = () =>
  [...lives.values()]
    .filter((l) => l.state === 'live' && !l.inWindow)
    .sort((a, b) => b.used - a.used)
    .slice(KEEP)
    .forEach((l) => l.held && l.drop());

/** Boots one app at a time (each waits for the one before, for a while at most). */
let booting: Promise<unknown> = Promise.resolve();
const queueBoot = (l: Live) => {
  booting = booting.then(() => Promise.race([l.boot(), new Promise((r) => setTimeout(r, 8000))]));
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
  const app = liveFor(plate);
  const player = app.player;
  // A cold app would catch up with its tape inside the morph. It goes live first, bounded — the tape
  // holds the picture meanwhile — so the window opens already answering, however cold it was.
  if (app.state !== 'live') await Promise.race([app.goLive(), sleep(500)]);
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
  const sc = full ? 0.94 : 0.96;
  const back = `scale(${sc})`;
  const dim = full ? 0 : 0.35;
  const ox = r.left + r.width / 2;
  const oy = r.top + r.height / 2;
  layers.forEach((el) => (el.style.transformOrigin = `${ox}px ${oy}px`));
  // A page that scrolls keeps its scrollbar's room while it can't scroll, so it doesn't shift.
  root.classList.toggle('thawing-gutter', root.scrollHeight > root.clientHeight);
  const stepping = (forward: boolean, duration: number) =>
    layers.map((el) => {
      const a = el.animate(
        forward ? [{ transform: 'none', opacity: 1 }, { transform: back, opacity: dim }] : [{ transform: back, opacity: dim }, { transform: 'none', opacity: 1 }],
        { duration: reduce.matches ? 1 : duration, easing: CURVE, fill: 'both' },
      );
      a.pause(); // (held on its first frame until the morph starts)
      return a;
    });

  /**
   * One side or the other: the preview's contents (tape, live app) move between the plate and the
   * window with moveBefore, so the app keeps its state and is laid out once, at its new size.
   */
  const swap = (open: boolean) => {
    if (open) screen.moveBefore(motion, null);
    else home.moveBefore(motion, homeNext);
    plate.style.visibility = open ? 'hidden' : '';
    overlay.style.visibility = open ? '' : 'hidden';
    root.classList.toggle('thawing', open);
    layers.forEach((el) => (el.inert = open));
    // A measuring switch (scripts/perf): hide the page entirely while the window is open, to price
    // what the inert, paused page behind the window costs the machine. Decides whether previews
    // deserve a colder backdrop than the paused, inert page they already have.
    if (new URLSearchParams(location.search).has('freeze')) layers.forEach((el) => (el.style.visibility = open ? 'hidden' : ''));
  };
  /**
   * The morph is a view transition of the window alone, while the page, live under it, steps back
   * (or forward) with its own animation on the same curve. The browser scales a picture of the app at
   * the size it had while the app, laid out at its new size, takes over within a few frames: never
   * cropped by the window, never snapping into place, all of it compositor work. On the way back the
   * window lands where the plate will be once the page is forward again, not where it is when the
   * transition starts (still stepped back), so nothing moves when it ends.
   */
  const morph = async (open: boolean, duration: number, page: Animation[], land?: DOMRect) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => ViewTransition };
    if (!doc.startViewTransition || reduce.matches) {
      swap(open);
      page.forEach((a) => a.play());
      return;
    }
    root.style.setProperty('--live-d', `${duration}ms`);
    root.style.setProperty('--live-ease', CURVE);
    root.classList.add('live-vt', open ? 'live-vt-in' : 'live-vt-out');
    (open ? plate : win).classList.add('live-vt-shape');
    const vt = doc.startViewTransition(() => {
      swap(open);
      plate.classList.toggle('live-vt-shape', !open);
      win.classList.toggle('live-vt-shape', open);
    });
    await vt.ready.catch(() => {});
    page.forEach((a) => a.play());
    if (land) {
      const group = document
        .getAnimations()
        .find((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-group(live-window)' && /group-anim/.test((a as CSSAnimation).animationName ?? ''));
      const effect = group?.effect as KeyframeEffect | undefined;
      if (effect) {
        const frames = effect.getKeyframes();
        Object.assign(frames[frames.length - 1]!, { transform: `matrix(1, 0, 0, 1, ${land.left}, ${land.top})`, width: `${land.width}px`, height: `${land.height}px` });
        effect.setKeyframes(frames);
      }
    }
    await vt.finished.catch(() => {});
    root.classList.remove('live-vt', 'live-vt-in', 'live-vt-out');
    plate.classList.remove('live-vt-shape');
    win.classList.remove('live-vt-shape');
  };

  // ---- In
  document.dispatchEvent(new CustomEvent('thaw:open'));
  // While this preview has the machine, it has all of it: every other tape lets its document go (a
  // later play rebuilds it from cache) and every other app — held, unseen — goes, to boot warm at
  // its tape's end when its preview is used again. Nothing renders behind the window's back.
  for (const p of document.querySelectorAll('tape-player')) if (p !== player) (p as TapePlayer).send({ k: 'unload' });
  for (const l of lives.values()) if (l !== app && l.state !== 'none' && !l.inWindow) l.drop();
  // Not live yet (a click before the hover finished): it becomes live in the window.
  void app.goLive().then(() => {
    player.frame?.focus();
    player.send({ k: 'focus' });
  });
  // In the window the app is laid out at the window's size, and the wheel is its own (the stage applies
  // this with the resize the move brings, on that frame).
  player.send({ k: 'mode', window: true });
  app.inWindow = true;
  // The overlay settles into its first layout on a frame of its own, so the one the morph captures
  // doesn't also pay for a subtree the page has never laid out.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const steps = stepping(true, FLIGHT);
  await morph(true, FLIGHT, steps);
  overlay.classList.add('landed');

  // ---- Leaving
  let closing = false;
  const close = async (viaHistory = false) => {
    if (closing) return;
    closing = true;
    removeEventListener('popstate', onPop);
    removeEventListener('keydown', onKey, true);
    player.removeEventListener('stage:escape', onEscape);
    if (!viaHistory && history.state?.liveZoom) history.back();
    overlay.classList.remove('landed');
    // The lights land on the side they're on now, in the plate too.
    if (plateLights) placeLights(plateLights, lights.dataset.side === 'right' ? 'right' : 'left');
    // Where the plate will be with the page forward again: undo the step back around its origin.
    const p = plate.getBoundingClientRect();
    const land = new DOMRect(ox + (p.left - ox) / sc, oy + (p.top - oy) / sc, p.width / sc, p.height / sc);
    const returns = stepping(false, FLIGHT * 0.85);
    steps.forEach((a) => a.cancel());
    player.send({ k: 'mode', window: false });
    app.inWindow = false;
    await morph(false, FLIGHT * 0.85, returns, land);
    await Promise.all(returns.map((a) => a.finished));
    returns.forEach((a) => a.cancel());
    layers.forEach((el) => (el.style.transformOrigin = ''));
    overlay.remove();
    root.classList.remove('thawing-gutter');
    document.dispatchEvent(new CustomEvent('thaw:close'));
    zooming = false;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    void close();
  };
  // Escape in the app comes from the stage, which lets the app's own dialogs and menus take it first.
  const onEscape = () => void close();
  addEventListener('keydown', onKey, true);
  player.addEventListener('stage:escape', onEscape);
  overlay.addEventListener('click', (e) => e.target === overlay && void close());
  overlay.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => void close()));
  // The lights keep to the pointer's side: over the page around the window, and over the app in it.
  overlay.addEventListener('pointermove', (e) => moveLights(lights, (e.clientX - mx) / availW));
  overlay.addEventListener('stage:pointer', (e) => moveLights(lights, (e as CustomEvent<{ f: number }>).detail.f));
  // The deck listens on window: keep wheel and keys over the overlay from moving the page under it.
  for (const type of ['wheel', 'keydown'] as const) overlay.addEventListener(type, (e) => e.stopPropagation());
  history.pushState({ ...(history.state ?? {}), liveZoom: true }, '', location.href);
  const onPop = () => void close(true);
  addEventListener('popstate', onPop, { once: true });

  // The app in the window renders in its own process, but it renders onto the machine's one GPU — the
  // first frames it starves are the page's. The stage can't see that (its own frames stay healthy),
  // so the page watches its own: once a second, the worst frame gap of the second; two bad seconds
  // in a row raise the app's pace ceiling by one, a clean one lets it back down. The morph and its
  // settle get their two seconds first.
  let paceWatch = 0;
  let paceAt = 0;
  let bucket = performance.now();
  let warm = 2;
  let worst = 0;
  let bad = 0;
  let cap = 1;
  const paceTick = (t: number) => {
    if (paceAt) worst = Math.max(worst, t - paceAt);
    paceAt = t;
    if (t - bucket >= 1000) {
      bucket = t;
      if (warm > 0) warm--;
      else {
        const k = worst / Math.max(4, 1000 / 240);
        if (k > 1.6) bad++;
        else {
          bad = 0;
          if (cap > 1 && k < 1.15) {
            cap--;
            player.send({ k: 'pace', n: cap });
          }
        }
        if (bad >= 2 && cap < 4) {
          bad = 0;
          cap++;
          player.send({ k: 'pace', n: cap });
        }
      }
      worst = 0;
    }
    if (zooming) paceWatch = requestAnimationFrame(paceTick);
  };
  paceWatch = requestAnimationFrame(paceTick);

// ---------------------------------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------------------------------

export function initLive() {
  // Inside a stage (this site, opened in itself), previews stay tapes: no apps in apps.
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
  for (const plate of plates) {
    plate.querySelector('.plate-dots')?.insertAdjacentHTML('afterend', lightsHTML('preview', nameOf(plate)));
    // In the showcase the preview sits in a link kept from assistive tech (the slide has its own links
    // to the case study and the live site): its lights stay out of the tab order there too.
    if (plate.closest('[aria-hidden="true"]')) plate.querySelectorAll<HTMLElement>('.light').forEach((b) => (b.tabIndex = -1));
  }

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
      else if (!t.closest('[data-light]')) void liveFor(plate).goLive();
    },
    true,
  );

  // Hover: the live app takes the tape's place, booting first if it hadn't; the showcase holds while
  // the preview is hovered. Over the app the pointer is in the stage, which a page can't see when the
  // stage is from another site: the stage reports it (stage:hover), kept as data-hover.
  const lightsOf = (plate: HTMLElement) => plate.querySelector<HTMLElement>('.lights-pair');
  const hovered = (plate: HTMLElement) => plate.matches(':hover') || plate.hasAttribute('data-hover');
  const holdShow = (on: boolean) => document.dispatchEvent(new CustomEvent('live:hold', { detail: on }));
  const released = (plate: HTMLElement) => setTimeout(() => !hovered(plate) && holdShow(false), 120);
  for (const plate of plates) {
    plate.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !ok()) return;
      holdShow(true);
      const l = liveFor(plate);
      if (l.state !== 'live') {
        const r = plate.getBoundingClientRect();
        l.player.ghost((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }
      void l.goLive();
    });
    // A preview that scrolled under a resting pointer gets no pointerenter: any move over it counts.
    // Under the pointer, the tape answers as a ghost (its own recorded hover styles what's under the
    // cursor) until the real app takes over — so the preview reacts from the first instant.
    plate.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !ok()) return;
      const l = liveFor(plate);
      if (l.state !== 'live') {
        const r = plate.getBoundingClientRect();
        l.player.ghost((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        void l.goLive();
      }
    });
    // (Moving into the app isn't leaving: the stage's report comes a moment later.)
    plate.addEventListener('pointerleave', () => {
      lives.get(plate)?.player.ghost(-1, -1);
      released(plate);
    });
    plate.addEventListener('stage:hover', (e) => {
      const on = (e as CustomEvent<{ on: boolean }>).detail.on;
      plate.toggleAttribute('data-hover', on);
      if (!on) released(plate);
    });
    plate.addEventListener('stage:pointer', (e) => moveLights(lightsOf(plate), (e as CustomEvent<{ f: number }>).detail.f));
  }
  // What the app does that's the page's business, wherever its stage is (a plate, or the window).
  document.addEventListener('stage:wheel', (e) => {
    // In a preview the wheel still moves the page (and the showcase, which listens for it).
    const { dx, dy } = (e as CustomEvent<{ dx: number; dy: number }>).detail;
    const plate = (e.target as Element).closest<HTMLElement>('.plate');
    const pass = new WheelEvent('wheel', { deltaX: dx, deltaY: dy, bubbles: true, cancelable: true });
    if (!plate || plate.dispatchEvent(pass)) scrollBy(dx, dy);
  });
  document.addEventListener('stage:theme-app', (e) => {
    // A theme the app switched itself is the site's too: the site takes the other edition, opening out
    // from the app's window to the edges.
    const at = (e.target as Element).closest('.thaw-window, .plate') ?? (e.target as Element);
    window.__faTheme?.({ rect: at.getBoundingClientRect() });
  });
  document.addEventListener('stage:theme-toggle', (e) => {
    // This site, opened in its own stage, had its toggle used: the switch spreads from that point.
    const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
    const frame = (e.target as TapePlayer).frame;
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    const k = r.width / (frame.offsetWidth || r.width);
    window.__faTheme?.({ x: r.left + x * k, y: r.top + y * k });
  });

  // -------------------------------------------------------------------------------------------------
  // Warming previews ahead of their turn: a stage mounts its tape (fetch, first frame, fonts, a filmed
  // clip) before anyone turns to it. Mounting is a burst of raster — three at once once froze the page
  // for 800 ms, which the black box caught — so they go one at a time, and only while the page is
  // quiet: no window open, nothing being flung, no product just turned over, the tab visible.
  // -------------------------------------------------------------------------------------------------
  const warmQueue: TapePlayer[] = [];
  const warmed = new WeakSet<TapePlayer>();
  let warmBusy = false;
  let lastChange = 0;
  const quiet = () =>
    !zooming && !document.hidden && !document.documentElement.classList.contains('deck-fast') && !document.querySelector('.thaw') && performance.now() - lastChange > 900;
  const warmStep = () => {
    const p = warmQueue.shift();
    if (!p || !p.isConnected) return void (warmBusy = false);
    if (!quiet()) return void setTimeout(warmStep, 400);
    idle(() => {
      if (p.isConnected && quiet()) {
        warmed.add(p);
        p.preload = 'auto';
      }
      setTimeout(warmStep, 400);
    });
  };
  const warm = (players: (TapePlayer | null | undefined)[]) => {
    for (const p of players) if (p && !warmed.has(p) && !warmQueue.includes(p)) warmQueue.push(p);
    if (!warmBusy) {
      warmBusy = true;
      warmStep();
    }
  };
  document.addEventListener('live:warm', (e) => {
    lastChange = performance.now();
    warm((e as CustomEvent<(TapePlayer | null | undefined)[]>).detail);
  });
  // When the window closes, what it unmounted (or what went cold while it was open) warms again.
  document.addEventListener('thaw:close', () => {
    lastChange = performance.now();
    warm([...document.querySelectorAll('tape-player')] as TapePlayer[]);
  });

  // Boot only after the visitor's first input, and only for a preview on screen (in view, and not in
  // an inactive showcase slide: they overlap the active one, hidden and inert) for a moment.
  let started = false;
  const visible = new Set<HTMLElement>();
  const inView = new Set<HTMLElement>();
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
  const dwell = new Map<HTMLElement, number>();
  const consider = (plate: HTMLElement) => {
    clearTimeout(dwell.get(plate));
    if (!started || !ok()) return;
    dwell.set(
      plate,
      window.setTimeout(() => idle(() => visible.has(plate) && !zooming && liveFor(plate).state === 'none' && queueBoot(liveFor(plate))), DWELL),
    );
  };
  const start = () => {
    if (started || !desktop()) return;
    started = true;
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(type, start, true);
    visible.forEach(consider);
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, start, { capture: true, passive: true });
  const leaving = new Map<HTMLElement, number>();
  const update = (plate: HTMLElement) => {
    const on = inView.has(plate) && !plate.closest('[inert]');
    if (on === visible.has(plate)) return;
    const l = lives.get(plate);
    if (on) {
      visible.add(plate);
      clearTimeout(leaving.get(plate));
      if (l?.state === 'live') !document.hidden && l.hold(false);
      else consider(plate);
    } else {
      visible.delete(plate);
      clearTimeout(dwell.get(plate));
      // Off screen for a moment (not while its window is open): an app that was only following its tape
      // goes; one the visitor used is held, and kept if it's among the most recent.
      leaving.set(
        plate,
        window.setTimeout(() => {
          if (zooming || visible.has(plate) || !l) return;
          if (l.state === 'live') {
            l.hold(true);
            trim();
          } else l.drop();
        }, 1200),
      );
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
  // A hidden tab holds every app; coming back lets the ones on screen go on.
  document.addEventListener('visibilitychange', () => lives.forEach((l) => l.hold(document.hidden || (!visible.has(l.plate) && !l.inWindow))));

  // The lights of the previews on screen keep to the pointer's side of them, wherever it is on the page
  // (over an app, the stage reports it: stage:pointer). Read once a frame.
  let px = -1;
  let queued = 0;
  addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      // The pointer is on this page again: any stage it was in has been left, whether or not the stage
      // saw it go (leaving straight out of an app's frame, it may not).
      for (const p of document.querySelectorAll<HTMLElement>('.plate[data-hover]'))
        if (!p.contains(e.target as Node)) {
          p.removeAttribute('data-hover');
          released(p);
        }
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
}
