/**
 * <tape-player src="/tapes/<id>.json">: plays a tape, a recording of an app's own DOM (see
 * scripts/tapes/recorder.js), instead of a video of it.
 *
 * The recorded document is rebuilt inside a sandboxed iframe with the app's real stylesheet and none of
 * its JavaScript, then every recorded change is applied at its time. The browser paints real text,
 * real vector icons and the app's own CSS transitions, at any size and pixel density, from a file that
 * is a few dozen kilobytes instead of megabytes of video.
 *
 * - Themes: the app switches theme with one attribute on <html>, so one tape plays in either edition.
 *   It follows the site's theme instantly (inverted, like the screenshots: dark app on the light site).
 * - Interaction state a replay can't produce (hover, focus, pressed) was recorded as events and turned
 *   into attributes the recorded stylesheet was rewritten to match.
 * - The cursor is drawn here, over the frame, from the recorded pointer path.
 * - It speaks enough of HTMLMediaElement (play, pause, currentTime, duration, ended, loop, onended,
 *   'loadedmetadata', 'playing', 'ended') for the showcase and the case study plates to drive it like
 *   the <video> it replaces.
 */

type TapeNode = [number, string] | [number, string, Record<string, string>, TapeNode[]?];
type TapeEvent = [string, number, ...unknown[]];

export interface Checkpoint {
  name: string;
  t: number;
  clock: number;
  route: string;
  storage: Record<string, string>;
  /** The app's IndexedDB databases at that moment, for apps that keep their state there. */
  idb?: IdbDump[];
}

/** An IndexedDB database as plain data: its stores' shapes and records. */
export interface IdbDump {
  name: string;
  version: number;
  stores: {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
    indexes: { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[];
    records: [unknown, unknown][];
  }[];
}

/**
 * Something the scene did, which the live app replays to catch up with the tape: a click, a key (on
 * the focused element), or text typed into a field. Elements are addressed by their element-child path
 * from <body>, with a signature to check it.
 */
export interface Action {
  t: number;
  kind?: 'click' | 'key' | 'input';
  path: number[];
  sig: { tag: string; testid?: string; role?: string; label?: string; text: string };
  key?: string;
  value?: string;
}

/** A response the scene got from the app's backend, served again to the live app (scripts/apps/bridge.js). */
export interface Exchange {
  m: string;
  u: string;
  s: number;
  h: string;
  b: string;
}

export interface Tape {
  v: number;
  id: string;
  viewport: [number, number];
  themeAttr: string;
  app: {
    entry: string;
    readySelector: string;
    storage: string[];
    themeKey?: string;
    restore?: string[];
    prefetch: string[];
    /**
     * Its backend's answers, recorded with the scene, for an app that has one: a separate file
     * (Exchange[]), fetched only when the live app boots, not with the preview.
     */
    network?: string;
    /** A real-time room the scene was in (PlaySync): what came in over the socket, and when. */
    socket?: { url: string; in: [number, string][] };
  };
  snapshot: TapeNode;
  events: TapeEvent[];
  checkpoints: Checkpoint[];
  /** The scene's clicks, which the thaw replays in the live app. */
  actions: Action[];
  /** The app's clock at tape time 0. */
  clock0: number;
  css: string;
  duration: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const tapes = new Map<string, Promise<Tape>>();
export const loadTape = (src: string) => {
  if (!tapes.has(src)) tapes.set(src, fetch(src).then((r) => r.json() as Promise<Tape>));
  return tapes.get(src)!;
};

/** The app edition shown on this site: the opposite of the site's own theme. */
const appTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
const players = new Set<TapePlayer>();
new MutationObserver(() => players.forEach((p) => p.syncTheme())).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

const CURSOR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 2.5v17.2l4.6-4.4 3 6.6 3-1.3-3-6.5 6.4-.2Z" fill="#111114" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export class TapePlayer extends HTMLElement {
  tape?: Tape;
  /** Lays the recorded DOM out at this size instead of the recorded one; it reflows like the app would. */
  viewport?: [number, number];
  loop = false;
  preloadMode = 'none';
  onended: ((e: Event) => void) | null = null;

  #frame?: HTMLIFrameElement;
  #doc?: Document;
  #cursor?: HTMLElement;
  #nodes = new Map<number, Node>();
  #i = 0;
  #vt = 0;
  #rate = 1;
  #raf = 0;
  #last = 0;
  #paused = true;
  #ended = false;
  #hover: Element[] = [];
  #focus: Element[] = [];
  #pressed = false;
  #pointer: { t: number[]; x: number[]; y: number[]; j: number } = { t: [], x: [], y: [], j: 0 };
  #mounted?: Promise<void>;
  #resize?: ResizeObserver;
  #stop?: { t: number; done: () => void };
  /** The app's Web Animations, run again on the tape's clock: started at t, by recording id. */
  #anims = new Map<number, { t: number; a: Animation }>();

  connectedCallback() {
    players.add(this);
    if (this.preloadMode === 'auto') void this.#load();
  }
  disconnectedCallback() {
    players.delete(this);
    this.pause();
    this.#resize?.disconnect();
  }

  // ---- HTMLMediaElement, the parts the site uses
  get src() {
    return this.getAttribute('src') ?? '';
  }
  get readyState() {
    return this.tape ? 4 : 0;
  }
  get duration() {
    return this.tape ? this.tape.duration / 1000 : NaN;
  }
  get currentTime() {
    return this.#vt / 1000;
  }
  set currentTime(s: number) {
    if (this.tape && this.#doc) this.seek(s * 1000);
    else this.#vt = s * 1000;
  }
  get paused() {
    return this.#paused;
  }
  get ended() {
    return this.#ended;
  }
  get preload() {
    return this.preloadMode;
  }
  set preload(v: string) {
    this.preloadMode = v;
    if (v === 'auto') void this.#load();
  }
  /** Playback speed; the thaw speeds a tape up to reach a checkpoint while the camera moves. */
  get playbackRate() {
    return this.#rate;
  }
  set playbackRate(r: number) {
    this.#rate = r;
  }

  async play() {
    this.#paused = false;
    await this.#mount();
    if (this.#paused) return;
    if (this.#ended || this.#vt >= this.tape!.duration) this.seek(0);
    this.#ended = false;
    await this.#doc!.fonts.ready;
    if (this.#paused) return;
    this.dispatchEvent(new Event('playing'));
    cancelAnimationFrame(this.#raf);
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#tick);
  }

  /** Resolves once the first frame is built and its fonts are loaded. */
  async ready() {
    await this.#mount();
    await this.#doc!.fonts.ready;
  }

  /** Plays up to a time and stops exactly there, even at a high playback rate. */
  playTo(ms: number) {
    return new Promise<void>((done) => {
      if (this.#vt >= ms) return done();
      this.#stop = { t: ms, done };
      void this.play();
    });
  }

  pause() {
    if (this.#paused) return;
    this.#paused = true;
    cancelAnimationFrame(this.#raf);
    this.dispatchEvent(new Event('pause'));
  }

  /** Jumps to a time: forward by applying the events in between, backward by rebuilding first. */
  seek(ms: number) {
    const tape = this.tape!;
    const to = Math.max(0, Math.min(ms, tape.duration));
    if (to < this.#vt || !this.#nodes.size) this.#reset();
    this.#advance(to);
    this.#vt = to;
    this.#ended = to >= tape.duration;
    this.#drawCursor();
  }

  /** The frame's document, for the thaw to copy from. */
  get frame() {
    return this.#frame;
  }


  syncTheme() {
    if (this.#doc && this.tape) this.#doc.documentElement.setAttribute(this.tape.themeAttr, appTheme());
  }

  // ---- Loading and building
  #load() {
    if (!this.src) return Promise.reject(new Error('tape-player: no src'));
    return loadTape(this.src).then((tape) => {
      if (!this.tape) {
        this.tape = tape;
        this.#indexPointer();
        this.dispatchEvent(new Event('loadedmetadata'));
      }
      return tape;
    });
  }

  #mount() {
    this.#mounted ??= (async () => {
      const tape = await this.#load();
      const [w, h] = this.viewport ?? tape.viewport;
      const frame = document.createElement('iframe');
      // No scripts can run in here; this document is only ever changed from outside.
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.className = 'tape-frame';
      frame.style.cssText = `width:${w}px;height:${h}px`;
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
      const cursor = document.createElement('div');
      cursor.className = 'tape-cursor';
      cursor.innerHTML = CURSOR;
      this.replaceChildren(frame, cursor);
      await new Promise((r) => frame.addEventListener('load', r, { once: true }));
      this.#frame = frame;
      this.#doc = frame.contentDocument!;
      this.#cursor = cursor;
      // The app's stylesheet as a constructed sheet, so no replayed DOM change can remove it.
      const sheet = new (frame.contentWindow as Window & typeof globalThis).CSSStyleSheet();
      sheet.replaceSync(tape.css + TAPE_CSS);
      this.#doc.adoptedStyleSheets = [sheet];
      this.#resize = new ResizeObserver(() => this.#fit());
      this.#resize.observe(this);
      this.#fit();
      this.seek(this.#vt);
    })();
    return this.#mounted;
  }

  #fit() {
    if (!this.#frame || !this.tape) return;
    const [w, h] = this.viewport ?? this.tape.viewport;
    const k = Math.max(this.clientWidth / w, this.clientHeight / h);
    this.style.setProperty('--tape-k', String(k));
  }

  #reset() {
    const doc = this.#doc!;
    const tape = this.tape!;
    this.#nodes.clear();
    this.#anims.forEach(({ a }) => a.cancel());
    this.#anims.clear();
    this.#i = 0;
    this.#vt = 0;
    this.#hover = [];
    this.#focus = [];
    this.#pointer.j = 0;
    const [id, , attrs, kids = []] = tape.snapshot as [number, string, Record<string, string>, TapeNode[]?];
    const html = doc.documentElement;
    for (const a of [...html.attributes]) html.removeAttribute(a.name);
    for (const [k, v] of Object.entries(attrs)) this.#setAttr(html, k, v);
    this.#nodes.set(id, html);
    html.replaceChildren(...kids.map((k) => this.#build(k)));
    this.syncTheme();
  }

  #build(n: TapeNode): Node {
    const doc = this.#doc!;
    if (n.length === 2) {
      const text = doc.createTextNode(n[1]);
      this.#nodes.set(n[0], text);
      return text;
    }
    const [id, tag, attrs, kids] = n;
    const el = tag.startsWith('s:') ? doc.createElementNS(SVG_NS, tag.slice(2)) : doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) this.#setAttr(el, k, v);
    if (kids) for (const k of kids) el.appendChild(this.#build(k));
    this.#nodes.set(id, el);
    return el;
  }

  #setAttr(el: Element, name: string, value: string | null) {
    if (name === '__value') return void ((el as HTMLInputElement).value = value ?? '');
    if (name === '__checked') return void ((el as HTMLInputElement).checked = value === '1');
    try {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    } catch {
      /* a name the recorder saw but this parser rejects: skip it */
    }
  }

  // ---- Playback
  #tick = (now: number) => {
    const tape = this.tape!;
    const limit = this.#stop ? Math.min(this.#stop.t, tape.duration) : tape.duration;
    this.#vt = Math.min(limit, this.#vt + Math.min(100, now - this.#last) * this.#rate);
    this.#last = now;
    this.#advance(this.#vt);
    this.#drawCursor();
    if (this.#stop && this.#vt >= this.#stop.t) {
      const { done } = this.#stop;
      this.#stop = undefined;
      this.#paused = true;
      done();
      return;
    }
    if (this.#vt >= tape.duration) {
      if (this.loop) {
        this.seek(0);
      } else {
        this.#ended = true;
        this.#paused = true;
        const e = new Event('ended');
        this.dispatchEvent(e);
        this.onended?.(e);
        return;
      }
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #advance(to: number) {
    const events = this.tape!.events;
    while (this.#i < events.length && events[this.#i]![1] <= to) this.#apply(events[this.#i++]!);
    // Animations follow the tape's time, so pausing, seeking and speeding up hold for them too.
    for (const { t, a } of this.#anims.values()) a.currentTime = Math.max(0, to - t);
  }

  #apply(e: TapeEvent) {
    const node = (id: unknown) => this.#nodes.get(id as number);
    switch (e[0]) {
      case 'c': {
        const parent = node(e[2]);
        if (!parent) return;
        const want = (e[3] as (number | TapeNode)[]).map((k) => (typeof k === 'number' ? node(k) : this.#build(k))).filter(Boolean) as Node[];
        for (let i = 0; i < want.length; i++) if (parent.childNodes[i] !== want[i]) parent.insertBefore(want[i]!, parent.childNodes[i] ?? null);
        while (parent.childNodes.length > want.length) parent.lastChild!.remove();
        return;
      }
      case 'a': {
        const el = node(e[2]) as Element | undefined;
        if (!el || (el === this.#doc!.documentElement && e[3] === this.tape!.themeAttr)) return;
        return this.#setAttr(el, e[3] as string, e[4] as string | null);
      }
      case 't': {
        const text = node(e[2]) as Text | undefined;
        if (text) text.data = e[3] as string;
        return;
      }
      case 'v': {
        const el = node(e[2]) as HTMLInputElement | undefined;
        if (el) el.value = e[3] as string;
        return;
      }
      case 'k': {
        const el = node(e[2]) as HTMLInputElement | undefined;
        if (el) el.checked = !!e[3];
        return;
      }
      case 's': {
        const el = node(e[2]) as Element | undefined;
        if (el) {
          el.scrollTop = e[3] as number;
          el.scrollLeft = e[4] as number;
        }
        return;
      }
      case 'w': {
        const el = node(e[2]) as Element | undefined;
        if (!el) return;
        try {
          const a = el.animate(e[3] as Keyframe[], e[4] as KeyframeEffectOptions);
          a.pause();
          this.#anims.set(e[5] as number, { t: e[1], a });
        } catch {}
        return;
      }
      case 'W':
        this.#anims.get(e[2] as number)?.a.cancel();
        this.#anims.delete(e[2] as number);
        return;
      case 'h':
        this.#hover = this.#chain(this.#hover, node(e[2]) as Element | undefined, 'data-tape-hover');
        if (this.#pressed) this.#hover.forEach((el) => el.setAttribute('data-tape-active', ''));
        return;
      case 'd':
        this.#pressed = !!e[2];
        this.#doc!.querySelectorAll('[data-tape-active]').forEach((el) => el.removeAttribute('data-tape-active'));
        if (this.#pressed) this.#hover.forEach((el) => el.setAttribute('data-tape-active', ''));
        this.#cursor?.classList.toggle('down', this.#pressed);
        return;
      case 'f': {
        const el = node(e[2]) as Element | undefined;
        this.#doc!.querySelectorAll('[data-tape-focus],[data-tape-focus-visible]').forEach((x) => {
          x.removeAttribute('data-tape-focus');
          x.removeAttribute('data-tape-focus-visible');
        });
        this.#focus = this.#chain(this.#focus, el, 'data-tape-focus-within');
        if (el) {
          el.setAttribute('data-tape-focus', '');
          if (e[3]) el.setAttribute('data-tape-focus-visible', '');
        }
        return;
      }
    }
  }

  /** Marks an element and its ancestors with an attribute, clearing the previous chain. */
  #chain(prev: Element[], el: Element | undefined, attr: string) {
    for (const x of prev) x.removeAttribute(attr);
    const next: Element[] = [];
    for (let x: Element | null = el ?? null; x; x = x.parentElement) {
      x.setAttribute(attr, '');
      next.push(x);
    }
    return next;
  }

  // ---- Cursor, interpolated between recorded pointer samples
  #indexPointer() {
    const p = this.#pointer;
    for (const e of this.tape!.events) {
      if (e[0] !== 'p') continue;
      p.t.push(e[1]);
      p.x.push(e[2] as number);
      p.y.push(e[3] as number);
    }
  }

  #drawCursor() {
    const cursor = this.#cursor;
    if (!cursor) return;
    const p = this.#pointer;
    const t = this.#vt;
    if (!p.t.length || t < p.t[0]!) return void (cursor.style.opacity = '0');
    if (p.j > 0 && p.t[p.j]! > t) p.j = 0;
    while (p.j + 1 < p.t.length && p.t[p.j + 1]! <= t) p.j++;
    const j = p.j;
    let x = p.x[j]!;
    let y = p.y[j]!;
    const t1 = p.t[j + 1];
    if (t1 !== undefined && t1 - p.t[j]! < 80) {
      const k = (t - p.t[j]!) / (t1 - p.t[j]!);
      x += (p.x[j + 1]! - x) * k;
      y += (p.y[j + 1]! - y) * k;
    }
    cursor.style.opacity = '1';
    // The arrow's tip sits 4.6px and 2.3px into its box.
    cursor.style.transform = `translate(calc(${x - 4.6}px * var(--tape-k)), calc(${y - 2.3}px * var(--tape-k))) scale(var(--tape-k))`;
  }
}

/**
 * Added to every tape's stylesheet: no text caret, nothing reacts to the real pointer. Scrollbars stay:
 * the live app has them (taking width on Windows, overlaid on macOS), and the thaw swaps the two.
 */
const TAPE_CSS = `
* { caret-color: transparent !important; cursor: default !important; }
html { pointer-events: none; }
`;

if (!customElements.get('tape-player')) customElements.define('tape-player', TapePlayer);
