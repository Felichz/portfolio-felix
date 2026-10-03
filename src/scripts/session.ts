/**
 * One live app, in a stage (src/scripts/stage.ts), under the stage's tape. It boots from the tape's
 * checkpoint (its route, storage, IndexedDB and clock) and follows the tape: each recorded click, key and
 * typed text is replayed in it when the tape reaches it, with the app's clock frozen at that recorded
 * moment (scripts/apps/bridge.js owns the app's Date and timers). So at any moment the app is in the
 * state the tape shows, and `goLive` can swap one for the other on the same frame.
 *
 * The stage and the app are on the same origin, so this reaches into the app's document directly; the
 * page around the stage hears about it through `hooks`.
 */
import { loadTape, type Action, type Exchange, type IdbDump, type Tape, type TapeCore } from './tape';

interface Handoff {
  app: string;
  clock: number;
  readySelector: string;
  ready: () => void;
  /** The tape time the app boots at (its checkpoint's), for stand-ins that replay what came later. */
  at?: number;
  /** For a single-page app: the URL it should see, set by the bridge before its code runs. */
  route?: string;
  /** The backend's recorded answers, which the bridge serves to the app's fetches. */
  network?: Exchange[];
  /** A recorded real-time room, which the bridge plays to the app's WebSocket. */
  socket?: Tape['app']['socket'];
  /** Installed by the bridge: sets the app's clock, frozen or running; its timers follow it. */
  setClock?: (ms: number, freeze?: boolean, tick?: boolean) => void;
  /** Installed by the bridge: holds the app's clock where it is (nothing timed fires), or lets it run on. */
  hold?: (on: boolean) => void;
  /** Installed by the bridge: the app's frames fire on every `n`-th vsync (1 = full cadence). */
  setPace?: (n: number) => void;
}
declare global {
  interface Window {
    __live?: Record<string, Handoff>;
  }
}

/** What the stage passes on to the page around it. */
export interface Hooks {
  /** The pointer's position across the app, 0 to 1 (the window lights keep to its side). */
  pointer(f: number): void;
  /** A wheel turned over the app in a preview: it's the page's. */
  wheel(dx: number, dy: number): void;
  /** Escape, when the app has no dialog or menu of its own open to take it. */
  escape(): void;
  /** The app switched its own theme. */
  themeApp(): void;
}

const frames = (win: Window, n = 2) =>
  new Promise<void>((r) => {
    const step = () => (--n <= 0 ? r() : win.requestAnimationFrame(step));
    win.requestAnimationFrame(step);
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A performance mark per stage of a live app (boot, ready, live), for traces and scripts/perf. */
const mark = (id: string, stage: string) => performance.mark(`live:${id}:${stage}`);

// Text, without the counts in it ("Chat 9" is the Chat tab with nine unread messages).
const textOf = (s: string) => s.replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);

/** Finds a recorded action's element in the live app: by its path, checked against its signature. */
function resolve(doc: Document, a: Action) {
  const matches = (el: Element | null | undefined): el is HTMLElement =>
    !!el &&
    el.localName === a.sig.tag &&
    (a.sig.testid ?? null) === el.getAttribute('data-testid') &&
    (a.sig.label ?? null) === el.getAttribute('aria-label') &&
    (a.kind === 'input' || textOf((el.textContent ?? '').slice(0, 60)) === textOf(a.sig.text));
  let el: Element | undefined = doc.body;
  for (const i of a.path) el = el?.children[i];
  if (!a.path.length && a.sig.tag === 'body') return doc.body;
  if (matches(el)) return el;
  // A portal that only existed while recording (a tooltip) can shift the path: find it by signature.
  return [...doc.querySelectorAll(a.sig.tag)].find(matches) as HTMLElement | undefined;
}

/** A key pressed on an element (keydown, then keyup), in the app's own realm. */
function press(win: Window & typeof globalThis, el: HTMLElement, key: string) {
  const at = { key, bubbles: true, cancelable: true, composed: true, view: win };
  el.dispatchEvent(new win.KeyboardEvent('keydown', at));
  el.dispatchEvent(new win.KeyboardEvent('keyup', at));
}

/** Text in a field, set the way typing sets it (through the native setter, so frameworks see it). */
function type(win: Window & typeof globalThis, el: HTMLElement, value: string) {
  if (el.isContentEditable) el.textContent = value;
  else {
    const proto = el instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  }
  el.focus();
  el.dispatchEvent(new win.InputEvent('input', { bubbles: true, composed: true, data: value, inputType: 'insertText' }));
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

/** Puts IndexedDB databases back as a checkpoint recorded them (same origin: the app reads them). */
async function restoreIdb(dumps: IdbDump[]) {
  const done = (r: IDBRequest | IDBTransaction) =>
    new Promise<void>((ok, no) => {
      if (r instanceof IDBTransaction) (r.oncomplete = () => ok()), (r.onerror = () => no(r.error));
      else (r.onsuccess = () => ok()), (r.onerror = () => no(r.error));
    });
  for (const dump of dumps) {
    await done(indexedDB.deleteDatabase(dump.name)).catch(() => {});
    const open = indexedDB.open(dump.name, dump.version);
    open.onupgradeneeded = () => {
      for (const s of dump.stores) {
        const store = open.result.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement });
        for (const i of s.indexes) store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry });
      }
    };
    await done(open);
    const db = open.result;
    if (dump.stores.length) {
      const tx = db.transaction(
        dump.stores.map((s) => s.name),
        'readwrite',
      );
      for (const s of dump.stores) for (const [k, v] of s.records) s.keyPath === null ? tx.objectStore(s.name).put(v, k as IDBValidKey) : tx.objectStore(s.name).put(v);
      await done(tx);
    }
    db.close();
  }
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

export interface SessionOptions {
  /** Where the app's frame goes. */
  box: HTMLElement;
  title: string;
  /** The app edition shown (its theme attribute's value). */
  theme: () => string;
  /** In a preview the wheel is the page's; in a window, the app's. */
  inWindow: () => boolean;
  hooks: Hooks;
}

export class Session {
  tape!: Tape;
  frame!: HTMLIFrameElement;
  handoff!: Handoff;
  live = false;
  booted: Promise<void>;
  #done = 0;
  #busy: Promise<void> = Promise.resolve();
  #last = 0;
  #timer = 0;
  #disposed = false;
  #restore = new Map<string, string | null>();
  #fit?: ResizeObserver;
  #going?: Promise<void>;
  #held: Animation[] | null = null;
  /** The app's long-running animations, waiting while it's unseen (see #rest). */
  #resting = new Set<Animation>();
  #restTimer = 0;

  constructor(
    public id: string,
    public player: TapeCore,
    public opts: SessionOptions,
  ) {
    this.booted = this.#boot();
  }

  /** Where the tape is, in ms: its end once it has ended, or before it has ever played (a still). */
  get #now() {
    const p = this.player;
    return p.tape && (p.currentTime > 0 || !p.paused) ? p.currentTime * 1000 : this.tape.duration;
  }
  #clockAt(t: number) {
    return this.tape.clock0 + t;
  }

  async #boot() {
    mark(this.id, 'boot');
    this.tape = await loadTape(`/tapes/${this.id}.json`);
    const tape = this.tape;
    const t = this.#now;
    const cp = [...tape.checkpoints].reverse().find((c) => c.t <= t) ?? tape.checkpoints[0]!;
    this.#done = (tape.actions ?? []).filter((a) => a.t <= cp.t).length;
    this.#last = t;

    // Storage as recorded at the checkpoint, in the edition shown. Keys a page uses for itself (this
    // site's theme, when the app is this site on the same origin) go back once the app has read them.
    const theme = this.opts.theme();
    for (const key of tape.app.restore ?? []) this.#restore.set(key, localStorage.getItem(key));
    for (const key of tape.app.storage) {
      if (key in cp.storage) localStorage.setItem(key, cp.storage[key]!);
      else localStorage.removeItem(key);
    }
    if (tape.app.themeKey) localStorage.setItem(tape.app.themeKey, theme);
    // (The app's bytes are warmed by the page's `warm-bytes`, when its slide turns active — never
    // here: a fetch in flight at boot deduplicates against the frame's own load of the same file,
    // and the app waits on a low-priority request to finish before it can start.)
    const [, network] = await Promise.all([
      cp.idb ? restoreIdb(cp.idb).catch(() => {}) : undefined,
      tape.app.network ? fetch(tape.app.network).then((r) => r.json() as Promise<Exchange[]>).catch(() => undefined) : undefined,
    ]);
    if (this.#disposed) return;

    let ready!: () => void;
    const painted = new Promise<void>((r) => (ready = r));
    this.handoff = {
      app: this.id,
      clock: this.#clockAt(cp.t),
      readySelector: tape.app.readySelector,
      ready: () => ready(),
      network,
      socket: tape.app.socket,
      at: cp.t,
      route: tape.app.spa ? tape.app.entry.replace(/\/$/, '') + cp.route : undefined,
    };
    (window.__live ??= {})[this.id] = this.handoff;

    const frame = document.createElement('iframe');
    frame.className = 'live-app';
    frame.title = this.opts.title;
    frame.tabIndex = -1;
    // Media inside the app (PlaySync's YouTube player) may play and go full screen.
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    // A single-page app loads its index.html (a real file on any server) and the bridge gives it the
    // route; an app of several pages loads the page itself.
    frame.src = tape.app.spa ? tape.app.entry : tape.app.entry.replace(/\/$/, '') + cp.route;
    this.frame = frame;
    this.opts.box.append(frame);
    // The app runs at the recorded 1440x900 and is scaled to the stage, like the tape.
    this.#fit = new ResizeObserver(() => {
      const box = this.opts.box;
      box.style.setProperty('--live-k', String(Math.max(box.clientWidth / 1440, box.clientHeight / 900)));
    });
    this.#fit.observe(this.opts.box);
    // Apps without the bridge (this site, opened in itself) are watched from here.
    const watch = window.setInterval(() => {
      const doc = frame.contentDocument;
      if (this.#disposed) return clearInterval(watch);
      if (!doc || doc.readyState === 'loading' || !doc.querySelector(tape.app.readySelector)) return;
      clearInterval(watch);
      void doc.fonts.ready.then(() => frames(frame.contentWindow!).then(ready));
    }, 50);
    await painted;
    mark(this.id, 'ready');
    for (const [k, v] of this.#restore) v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    if (this.#disposed) return;
    this.#attach();
    // An app of several pages gets the same hooks on each page it goes to.
    frame.addEventListener('load', () => this.#attach());
    // Unseen, it rests; checked again now and then, for animations its own timers started since.
    this.#rest();
    this.#restTimer = window.setInterval(() => this.#rest(), 1000);
    // Following is driven by the tape: when it plays (from wherever it was put), pauses, and when an
    // action is due.
    this.player.addEventListener('playing', this.follow);
    this.player.addEventListener('pause', this.follow);
    this.follow();
  }

  #attached = new WeakSet<Document>();
  /** Hooks into the app's current page: the theme both ways, the pointer, the wheel, Escape. */
  #attach() {
    const frame = this.frame;
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc || this.#attached.has(doc)) return;
    this.#attached.add(doc);
    const tape = this.tape;
    const { hooks } = this.opts;
    this.syncTheme();
    // A theme the app switches itself (in its own settings) is passed on: the page takes the other
    // edition. (This site, running inside itself, hands its toggle on instead: see stage.ts.)
    const appRoot = doc.documentElement;
    new MutationObserver(() => {
      const theirs = appRoot.getAttribute(tape.themeAttr);
      if (theirs && theirs !== this.opts.theme()) hooks.themeApp();
    }).observe(appRoot, { attributes: true, attributeFilter: [tape.themeAttr] });
    // Where the pointer is over the app, once a frame.
    let px = 0;
    let queued = 0;
    win.addEventListener(
      'pointermove',
      (e) => {
        px = e.clientX / win.innerWidth;
        queued ||= win.requestAnimationFrame(() => {
          queued = 0;
          hooks.pointer(px);
        });
      },
      { passive: true },
    );
    // In a preview the app takes the pointer and clicks, but not the wheel: that still moves the page.
    // In its window, the app scrolls itself.
    win.addEventListener(
      'wheel',
      (e) => {
        if (this.opts.inWindow()) return;
        e.preventDefault();
        const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? win.innerHeight : 1;
        hooks.wheel(e.deltaX * k, e.deltaY * k);
      },
      { passive: false },
    );
    // The app's own dialogs and menus take Escape first.
    win.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        if (doc.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
        hooks.escape();
      },
      true,
    );
  }

  /**
   * Follows the stage's theme: on the same frame as the tape. The app's own key is saved, so it reloads
   * in that edition; a key the page shares with the app (this site in itself) is left to the page.
   */
  syncTheme() {
    const doc = this.frame?.contentDocument;
    if (!doc || !this.tape) return;
    const theme = this.opts.theme();
    doc.documentElement.setAttribute(this.tape.themeAttr, theme);
    const key = this.tape.app.themeKey;
    if (key && !this.tape.app.restore?.includes(key))
      try {
        localStorage.setItem(key, theme);
      } catch {}
  }

  /**
   * Keeps up with the tape: replays the actions it passes, each when the tape reaches it (a timer to
   * the next one, not a check on every frame). Called again whenever the tape plays, pauses or seeks.
   */
  follow = () => {
    clearTimeout(this.#timer);
    if (this.#disposed || this.live || !this.tape || !this.handoff) return;
    const p = this.player;
    const t = this.#now;
    // The tape went back while playing (it looped, or was replayed): start over from its checkpoint.
    if (!p.paused && t < this.#last - 300) return void this.#reboot();
    this.#last = Math.max(this.#last, t);
    const actions = this.tape.actions ?? [];
    while (actions[this.#done] && actions[this.#done]!.t <= t) {
      const a = actions[this.#done++]!;
      this.#busy = this.#busy.then(() => this.#replay(a));
    }
    const next = actions[this.#done];
    if (next && !p.paused) this.#timer = window.setTimeout(this.follow, Math.max(0, (next.t - t) / (p.playbackRate || 1)));
  };

  async #replay(a: Action) {
    const win = this.frame.contentWindow as Window & typeof globalThis;
    const doc = this.frame.contentDocument;
    if (!win || !doc || this.#disposed) return;
    this.handoff.setClock?.(this.#clockAt(a.t), true);
    let el: HTMLElement | undefined;
    for (let tries = 0; !(el = resolve(doc, a)) && tries < 40; tries++) await frames(win, 1);
    if (el && a.kind === 'key') press(win, el, a.key!);
    else if (el && a.kind === 'input') type(win, el, a.value ?? '');
    else if (el) click(win, el);
    // A click can start async work: wait for the DOM to settle (bounded: a playing video never does).
    // Typing is synchronous, and there's a lot of it: one frame is enough.
    if (a.kind === 'input') await frames(win, 1);
    else await quiet(win, doc, 450);
    this.#rest();
    // The clock stays where the tape is, frozen, until the next action moves it on (firing whatever
    // fell due on the way) or the app goes live. Unseen, an app has no reason to tick: its timers would
    // only redraw it, every second, for nobody.
    this.handoff.setClock?.(this.#clockAt(this.#now), true);
  }

  #reboot() {
    this.onReboot?.();
  }
  /** Set by the stage: starts a new session in this one's place. */
  onReboot?: () => void;

  /**
   * Makes the live app the preview, on the frame the tape is on: the tape stops, the app catches up
   * (actions still in flight, timers that fell due), settles its clock on the time the frame shows (the
   * last time its text changed), and takes the tape's place. From here it's interactive. However many
   * times it's asked for, it happens once.
   */
  goLive() {
    return (this.#going ??= this.#goLive());
  }

  async #goLive() {
    await this.booted;
    mark(this.id, 'asked');
    await this.#busy;
    if (this.live || this.#disposed) return;
    clearTimeout(this.#timer);
    const player = this.player;
    const at = this.#now;
    player.pause();
    // (Pausing hands the tape's due actions to the queue: they finish first.)
    await this.#busy;
    // Actions the tape had reached but the app hadn't yet.
    for (const a of (this.tape.actions ?? []).slice(this.#done))
      if (a.t <= at) {
        this.#done++;
        await this.#replay(a);
      }
    let shown = 0;
    for (const a of this.tape.actions ?? []) if (a.t <= at) shown = Math.max(shown, a.t);
    for (const e of this.tape.events) if (e[0] === 't' && e[1] <= at && e[1] > shown) shown = e[1];
    const win = this.frame.contentWindow!;
    const doc = this.frame.contentDocument!;
    mark(this.id, 'caught-up');
    this.handoff.setClock?.(this.#clockAt(at), true);
    // Let it settle: async work after the last action, and animations it started (both bounded).
    await quiet(win, doc, 500);
    mark(this.id, 'quiet');
    // Animations the last action started get a moment to end, only ones that do end (an infinite one,
    // like a pulsing dot, would run out the wait every time), and only a moment: the pointer is waiting.
    const ending = doc.getAnimations().filter((x) => x.playState === 'running' && Number(x.effect?.getComputedTiming().endTime) < Infinity);
    await Promise.race([Promise.all(ending.map((x) => x.finished.catch(() => {}))), sleep(200)]);
    mark(this.id, 'settled');
    this.handoff.setClock?.(this.#clockAt(shown), true, true);
    await frames(win);
    this.handoff.setClock?.(this.#clockAt(shown), false);
    if (this.#disposed) return;
    this.#wake();
    this.live = true;
    this.frame.tabIndex = 0;
    this.frame.classList.add('shown');
    mark(this.id, 'live');
    this.#setPace(this.opts.inWindow() ? 1 : 2);
    this.#tunePace();
  }

  /**
   * While the app only follows its tape, under it and unseen, its long-running animations (a pulsing
   * dot, a progress bar that fills over the hour) pause: they would otherwise restyle, and some relayout,
   * the app on every frame for nobody. Only ones with more than two seconds left: nothing the replay
   * waits for. They run again, from where they were, as it goes live.
   */
  #rest() {
    const doc = this.frame?.contentDocument;
    if (!doc || this.live) return;
    for (const a of doc.getAnimations())
      if (a.playState === 'running' && Number(a.effect?.getComputedTiming().endTime) - Number(a.currentTime ?? 0) > 2000) {
        a.pause();
        this.#resting.add(a);
      }
  }
  #wake() {
    clearInterval(this.#restTimer);
    this.#resting.forEach((a) => a.playState === 'paused' && a.play());
    this.#resting.clear();
  }

  /**
   * Holds the app while no one can see it (its preview off screen, the page hidden): its clock stops,
   * so nothing timed fires, and its running animations pause. Letting go picks up where it was.
   */
  hold(on: boolean) {
    if (!this.handoff || on === !!this.#held) return;
    const doc = this.frame?.contentDocument;
    this.handoff.hold?.(on);
    if (on) {
      this.#held = doc ? doc.getAnimations().filter((a) => a.playState === 'running') : [];
      this.#held.forEach((a) => a.pause());
    } else {
      this.#held?.forEach((a) => a.play());
      this.#held = null;
    }
  }

  // ---- The cadence. The bridge fires the app's frames on every `pace`-th vsync: half cadence in a
  // preview to start (a scaled-down picture can't show the difference), full in a window. A small loop
  // then watches this document's own frame intervals — the stage shares the app's process, so its
  // frames feel what the app's rendering costs — and settles the app at the highest steady pace the
  // machine holds. Steadiness is the point, not the number: a metronome at 60 reads as smoother than
  // a lottery between 42 and 63.
  #pace = 1;
  #vsync = 8.33;
  #paceTimer = 0;
  #decorative: Animation[] = [];

  #vsyncUnset = true;
  #tunePace = () => {
    if (this.#disposed || !this.live) return;
    if (document.hidden || !this.frame.isConnected) return void (this.#paceTimer = window.setTimeout(this.#tunePace, 1500));
    const ts: number[] = [];
    const tick = (t: number) => {
      ts.push(t);
      if (ts.length < 40) requestAnimationFrame(tick);
      else {
        // The stage's own vsync, measured once from this first batch: the pace arithmetic runs in
        // units of it, on this machine and this screen.
        if (this.#vsyncUnset) {
          const iv = ts
            .slice(1)
            .map((x, i) => x - ts[i]!)
            .sort((a, b) => a - b);
          this.#vsync = Math.max(4, iv[Math.floor(iv.length / 2)]!);
          this.#vsyncUnset = false;
        }
        this.#judge(ts);
      }
    };
    requestAnimationFrame(tick);
  };
  #judge(ts: number[]) {
    if (this.#disposed || !this.live) return;
    const iv = ts
      .slice(1)
      .map((t, i) => t - ts[i]!)
      .sort((a, b) => a - b);
    const p95 = iv[Math.floor(iv.length * 0.95)]!;
    const target = this.#vsync * this.#pace;
    if (p95 > target * 1.7 && this.#pace < 4) this.#setPace(this.#pace + 1);
    else if (p95 < target * 1.15 && this.#pace > 1) this.#setPace(this.#pace - 1);
    this.#paceTimer = window.setTimeout(this.#tunePace, 1500);
  }
  #setPace(n: number) {
    if (n === this.#pace) return;
    this.#pace = n;
    this.handoff.setPace?.(n);
    n > 1 ? this.#restDecorative() : this.#wakeDecorative();
  }
  /** Pauses the app's endless animations — a pulse, a spinner: decorative by definition — so the pace
     the loop settles on is one the app can actually hold. They run again at full cadence. */
  #restDecorative() {
    const doc = this.frame?.contentDocument;
    if (!doc) return;
    for (const a of doc.getAnimations())
      if (a.playState === 'running' && Number(a.effect?.getComputedTiming().endTime) === Infinity) {
        a.pause();
        this.#decorative.push(a);
      }
  }
  #wakeDecorative() {
    this.#decorative.forEach((a) => a.playState === 'paused' && a.play());
    this.#decorative = [];
  }

  dispose() {
    this.#disposed = true;
    clearTimeout(this.#timer);
    clearInterval(this.#restTimer);
    clearTimeout(this.#paceTimer);
    this.player.removeEventListener('playing', this.follow);
    this.player.removeEventListener('pause', this.follow);
    this.#fit?.disconnect();
    this.frame?.remove();
    if (window.__live) delete window.__live[this.id];
  }
}
