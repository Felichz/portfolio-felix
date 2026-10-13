/**
 * <tape-player src="/tapes/<id>.json">: a product's preview on the page. The tape plays in a stage
 * (src/scripts/stage.ts), a frame from another site when there is one (src/scripts/origin.ts), so it
 * runs in its own process; this element is the page's side of it.
 *
 * - It speaks enough of HTMLMediaElement (play, pause, currentTime, duration, ended, loop, onended,
 *   preload, 'loadedmetadata', 'playing', 'pause', 'ended') for the showcase and the case study plates to
 *   drive it like the <video> it replaced. Its time is kept here from what the stage last reported, so
 *   reading it never waits on the stage.
 * - The stage is created only when the preview is first played or preloaded.
 * - Themes: the app edition is the opposite of the site's, and a theme switch waits (briefly) for every
 *   stage to have painted the new one, so the switch's snapshot shows it.
 * - Everything else the stage reports (the live app booted, went live, the pointer over it, ...) is
 *   dispatched here as a bubbling `stage:<kind>` event for src/scripts/live.ts.
 */
import { STAGE_ORIGIN } from './origin';
import type { ToHost, ToStage } from './stage-protocol';

const appTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
const players = new Set<TapePlayer>();

addEventListener('message', (e: MessageEvent<ToHost>) => {
  for (const p of players) if (p.frame && p.frame.contentWindow === e.source && e.origin === p.origin) return p.receive(e.data);
});

/** A stage that hasn't answered by then is loaded again from this page's own origin. */
const PATIENCE = 3000;

// A theme switch reaches each stage as the reveal's circle reaches IT — not all of them at the
// start. A stage paints in its own process and its snapshot reaches the page's view transition
// asynchronously: switched early, its new edition showed for a moment over the frozen page, then
// the old one again, and the circle brought the new one only later (the flash-and-back). Switched
// under the moving edge, neither race has room: the edge is right there, and it masks everything.
let themeId = 0;
const sendTheme = (p: TapePlayer) => {
  p.send({ k: 'theme', theme: appTheme(), id: ++themeId });
};
/** When the circle's edge (clip-path, 150vmax over `duration` with --ease-io) covers a point
    `d` px from its origin: the easing, cubic-bezier(0.65, 0, 0.35, 1), inverted by nested bisection. */
const EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];
const bezierY = (t: number) => {
  const [x1, y1, x2, y2] = EASE;
  const u = 1 - t;
  return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
};
const bezierX = (t: number) => {
  const [x1, , x2] = EASE;
  const u = 1 - t;
  return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
};
const arrival = (d: number, radius: number, duration: number) => {
  const p = Math.min(1, d / radius);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    // The animation's eased progress at wall-time mid: y(bezier(x⁻¹(mid))).
    let l2 = 0;
    let h2 = 1;
    for (let j = 0; j < 20; j++) {
      const m = (l2 + h2) / 2;
      bezierX(m) < mid ? (l2 = m) : (h2 = m);
    }
    bezierY((l2 + h2) / 2) < p ? (lo = mid) : (hi = mid);
  }
  return duration * ((lo + hi) / 2);
};
document.addEventListener('theme:reveal', (e) => {
  const { x, y, duration } = (e as CustomEvent<{ x: number; y: number; duration: number }>).detail ?? {};
  if (x === undefined) return players.forEach((p) => sendTheme(p));
  const radius = 1.5 * Math.max(innerWidth, innerHeight);
  for (const p of players) {
    if (!p.frame) continue;
    const r = p.closest?.('.plate')?.getBoundingClientRect();
    const d = r ? Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) : radius;
    setTimeout(() => sendTheme(p), Math.min(arrival(d, radius, duration), duration - 20));
  }
});
// (A theme set any other way, without the switch: the stages follow at once.)
new MutationObserver(() => {
  if (!document.documentElement.hasAttribute('data-theme-switching')) players.forEach((p) => sendTheme(p));
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

export class TapePlayer extends HTMLElement {
  onended: ((e: Event) => void) | null = null;
  #loop = false;
  #preload = 'none';
  #frame?: HTMLIFrameElement;
  /** Where its stage is from: another site when there is one (src/scripts/origin.ts). */
  origin = STAGE_ORIGIN;
  #hello = false;
  #queue: ToStage[] = [];
  #duration = NaN;
  #paused = true;
  #ended = false;
  #rate = 1;
  /** The tape's time, ms, as of `#at` (performance.now()); running only once the stage says it plays. */
  #vt = 0;
  #at = 0;
  #running = false;
  #waiting: [() => void, (e: unknown) => void][] = [];

  connectedCallback() {
    players.add(this);
    if (this.#preload === 'auto') this.#load();
  }
  /** Moved with moveBefore (into a live app's window and back): nothing to redo. */
  connectedMoveCallback() {}
  disconnectedCallback() {
    players.delete(this);
    this.pause();
  }

  get src() {
    return this.getAttribute('src') ?? '';
  }
  /** The tape's id, from its file name. */
  get tapeId() {
    return this.src.match(/([^/]+)\.json$/)?.[1] ?? '';
  }
  /** The stage's frame, once there is one. */
  get frame() {
    return this.#frame;
  }

  // ---- HTMLMediaElement, the parts the site uses
  get readyState() {
    return Number.isFinite(this.#duration) ? 4 : 0;
  }
  get duration() {
    return this.#duration / 1000;
  }
  get currentTime() {
    const t = this.#running ? this.#vt + (performance.now() - this.#at) * this.#rate : this.#vt;
    return Math.min(t, Number.isFinite(this.#duration) ? this.#duration : t) / 1000;
  }
  set currentTime(s: number) {
    this.#vt = s * 1000;
    this.#at = performance.now();
    this.#ended = false;
    this.#post({ k: 'seek', t: this.#vt });
  }
  get paused() {
    return this.#paused;
  }
  get ended() {
    return this.#ended;
  }
  get loop() {
    return this.#loop;
  }
  set loop(on: boolean) {
    this.#loop = on;
    if (this.#frame) this.#post({ k: 'loop', on });
  }
  get preload() {
    return this.#preload;
  }
  set preload(v: string) {
    this.#preload = v;
    if (v === 'auto') this.#load();
  }
  get playbackRate() {
    return this.#rate;
  }
  set playbackRate(r: number) {
    this.#vt = this.currentTime * 1000;
    this.#at = performance.now();
    this.#rate = r;
    this.#post({ k: 'rate', r });
  }

  play() {
    this.#paused = false;
    this.#post({ k: 'play' });
    return new Promise<void>((ok, no) => this.#waiting.push([ok, no]));
  }

  pause() {
    if (this.#paused) return;
    this.#vt = this.currentTime * 1000;
    this.#at = performance.now();
    this.#paused = true;
    this.#running = false;
    this.#post({ k: 'pause' });
    this.dispatchEvent(new Event('pause'));
  }

  /** A message for the stage (it waits until the stage is there). */
  send(m: ToStage) {
    if (!this.#frame && m.k === 'theme') return;
    this.#post(m);
  }

  /** The page's pointer over this preview, as fractions across it; x < 0 lifts. */
  ghost(x: number, y: number) {
    this.#post({ k: 'ghost', x, y });
  }

  /** Asks the stage to warm the app's bytes ahead of its boot. */
  warm() {
    this.send({ k: 'warm-bytes' });
  }

  #load() {
    this.#post({ k: 'load' });
  }

  #post(m: ToStage) {
    this.#ensure();
    if (this.#hello) this.#frame!.contentWindow?.postMessage(m, this.origin);
    else this.#queue.push(m);
  }

  #ensure() {
    if (this.#frame) return;
    const frame = document.createElement('iframe');
    frame.className = 'stage-frame';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.title = '';
    // The live app inside may play media (PlaySync's YouTube player) and go full screen.
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    frame.src = `${this.origin}/stage/#${encodeURIComponent(this.tapeId)}`;
    performance.mark(`live:mount:${this.tapeId}:start`);
    this.#frame = frame;
    this.append(frame);
    // Another site that doesn't answer (a local server listening on one name only, say) isn't worth a
    // blank preview: the stage comes from this origin instead, in this page's process.
    if (this.origin !== location.origin)
      setTimeout(() => {
        if (this.#hello || !this.#frame) return;
        this.origin = location.origin;
        this.#frame.src = `${this.origin}/stage/#${encodeURIComponent(this.tapeId)}`;
      }, PATIENCE);
  }

  /** What the stage said (routed here by the message listener above). */
  receive(m: ToHost) {
    switch (m.k) {
      case 'hello': {
        this.#hello = true;
        performance.mark(`live:mount:${this.tapeId}:end`);
        const queue = this.#queue;
        this.#queue = [];
        const name = this.closest('[data-slide], section')?.querySelector('.slide-name, #cs-name')?.textContent?.replace(/\s+/g, ' ').trim() ?? this.tapeId;
        this.#frame!.contentWindow?.postMessage({ k: 'init', theme: appTheme(), title: `${name}, live` } satisfies ToStage, this.origin);
        if (this.#loop) queue.unshift({ k: 'loop', on: true });
        for (const q of queue) this.#frame!.contentWindow?.postMessage(q, this.origin);
        return;
      }
      case 'meta':
        this.#duration = m.duration * 1000;
        this.dispatchEvent(new Event('loadedmetadata'));
        return;
      case 'playing': {
        this.#vt = m.t;
        this.#at = performance.now();
        this.#running = true;
        this.#ended = false;
        if (this.#paused) {
          // Paused again before the stage started: hold it there.
          this.#running = false;
          this.#post({ k: 'pause' });
          return;
        }
        const waiting = this.#waiting;
        this.#waiting = [];
        waiting.forEach(([ok]) => ok());
        this.dispatchEvent(new Event('playing'));
        return;
      }
      case 'pause':
        this.#vt = m.t;
        this.#at = performance.now();
        this.#running = false;
        if (!this.#paused) {
          this.#paused = true;
          this.dispatchEvent(new Event('pause'));
        }
        return;
      case 'ended': {
        this.#vt = this.#duration;
        this.#running = false;
        this.#paused = true;
        this.#ended = true;
        const e = new Event('ended');
        this.dispatchEvent(e);
        this.onended?.(e);
        return;
      }
      case 'ack':
        return;
      default:
        this.dispatchEvent(new CustomEvent(`stage:${m.k}`, { detail: m, bubbles: true }));
    }
  }
}

if (!customElements.get('tape-player')) customElements.define('tape-player', TapePlayer);
