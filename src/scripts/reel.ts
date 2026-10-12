/**
 * <reel-core src="/tapes/<id>.json">: a tape's film (scripts/tapes/reel.mjs) in place of the tape
 * itself, in a stage (src/scripts/stage.ts). Each edition (light, dark) is a video on the tape's own
 * timeline, so a checkpoint's t is the video's time and the live app boots and follows exactly as it
 * does under a tape (src/scripts/session.ts reads only the media interface and the tape's data).
 *
 * What it saves: a tape rebuilds the app's DOM and replays every recorded change on the main thread of
 * the stage's process, which is the page's own process without a stage origin. A video is decoded off
 * the main thread and composited as one layer.
 *
 * What it gives up: the ghost (a tape styles what's under the page's pointer while the app boots; a film
 * can't), sharpness past the filmed size, and a few hundred kilobytes per edition.
 *
 * It speaks the parts of TapeCore the stage and the session use: play, pause, currentTime, duration,
 * paused, ended, loop, onended, playbackRate, preload, ready(), unload(), theme, tape, and the events
 * 'loadedmetadata', 'playing', 'pause', 'ended'.
 */
import { loadTape, type Tape } from './tape';

type Edition = 'light' | 'dark';

export class ReelCore extends HTMLElement {
  tape?: Tape;
  onended: ((e: Event) => void) | null = null;
  #theme: Edition = 'dark';
  #videos = {} as Record<Edition, HTMLVideoElement>;
  #loop = false;
  #rate = 1;
  #preload = 'none';
  /** Where it was when its videos were let go (unload). */
  #kept = 0;
  #unloaded = false;
  /** While one edition hands over to the other: their own pause and play are not the reel's. */
  #swapping = false;
  /** Resolves once the edition asked for last shows its frame. */
  themed: Promise<void> = Promise.resolve();

  connectedCallback() {
    if (this.#videos.light) return;
    for (const e of ['light', 'dark'] as Edition[]) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'none';
      v.disablePictureInPicture = true;
      v.tabIndex = -1;
      v.setAttribute('aria-hidden', 'true');
      v.className = 'reel-video';
      const forward = (type: string) =>
        v.addEventListener(type, () => {
          if (v !== this.#shown || this.#swapping) return;
          const ev = new Event(type);
          this.dispatchEvent(ev);
          if (type === 'ended') this.onended?.(ev);
        });
      ['loadedmetadata', 'playing', 'pause', 'ended'].forEach(forward);
      this.#videos[e] = v;
      this.append(v);
    }
    this.#show();
  }
  disconnectedCallback() {
    this.pause();
  }

  get src() {
    return this.getAttribute('src') ?? '';
  }
  #url(e: Edition) {
    return this.src.replace(/\.json$/, `.${e}.mp4`);
  }
  get #shown() {
    return this.#videos[this.#theme];
  }
  /** Gives a video its file the first time it's needed (and again after unload). */
  #arm(v: HTMLVideoElement, e: Edition) {
    if (v.getAttribute('src')) return;
    if (v === this.#shown) this.#unloaded = false;
    v.src = this.#url(e);
    v.loop = this.#loop;
    v.playbackRate = this.#rate;
    if (this.#kept) v.currentTime = this.#kept;
  }

  // ---- HTMLMediaElement, the parts the stage uses
  get readyState() {
    return this.#shown.readyState;
  }
  get duration() {
    return this.#shown.duration;
  }
  get currentTime() {
    return this.#unloaded ? this.#kept : this.#shown.currentTime;
  }
  set currentTime(s: number) {
    this.#kept = s;
    if (this.#shown.getAttribute('src')) this.#shown.currentTime = s;
  }
  get paused() {
    return this.#shown.paused;
  }
  get ended() {
    return this.#shown.ended;
  }
  get loop() {
    return this.#loop;
  }
  set loop(on: boolean) {
    this.#loop = on;
    for (const v of Object.values(this.#videos)) v.loop = on;
  }
  get playbackRate() {
    return this.#rate;
  }
  set playbackRate(r: number) {
    this.#rate = r;
    for (const v of Object.values(this.#videos)) v.playbackRate = r;
  }
  get preload() {
    return this.#preload;
  }
  set preload(p: string) {
    this.#preload = p;
    if (p !== 'auto') return;
    this.#arm(this.#shown, this.#theme);
    this.#shown.preload = 'auto';
    void this.#loadTape();
  }

  /** The tape's data, for the live app that follows the film. */
  #loadTape() {
    return loadTape(this.src).then((t) => (this.tape = t));
  }

  async play() {
    this.#arm(this.#shown, this.#theme);
    void this.#loadTape();
    await this.#shown.play().catch(() => {});
  }

  pause() {
    if (!this.#shown.paused) this.#shown.pause();
  }

  /** Resolves once the first frame is decoded. */
  async ready() {
    this.preload = 'auto';
    const v = this.#shown;
    if (v.readyState < 2) await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }));
  }

  /** Lets the videos go, keeping only where it was: a later play loads the file again (cached). */
  unload() {
    this.#kept = this.currentTime;
    this.pause();
    this.#unloaded = true;
    for (const v of Object.values(this.#videos)) {
      v.removeAttribute('src');
      v.load();
    }
  }

  /** The ghost needs a document to style; a film has none. */
  hover(_fx: number, _fy: number) {}
  syncTheme() {}
  get frame() {
    return undefined;
  }

  // ---- Editions
  get theme() {
    return this.#theme;
  }
  set theme(t: string) {
    const to = (t === 'light' ? 'light' : 'dark') as Edition;
    if (to === this.#theme || !this.#videos.light) {
      this.#theme = to;
      return;
    }
    const from = this.#shown;
    const next = this.#videos[to];
    this.#theme = to;
    if (!from.getAttribute('src')) {
      this.#show();
      return;
    }
    // The other edition takes over where this one is, and shows once its frame is there.
    const playing = !from.paused && !from.ended;
    this.#arm(next, to);
    next.preload = 'auto';
    this.#swapping = true;
    next.currentTime = from.currentTime;
    this.themed = new Promise<void>((done) => {
      const swap = () => {
        this.#show();
        from.pause();
        this.#swapping = false;
        done();
      };
      if (!playing) return next.addEventListener('seeked', swap, { once: true });
      next.addEventListener('playing', swap, { once: true });
      next.play().catch(swap);
    });
  }

  #show() {
    for (const [e, v] of Object.entries(this.#videos)) v.classList.toggle('shown', e === this.#theme);
  }
}

if (!customElements.get('reel-core')) customElements.define('reel-core', ReelCore);
