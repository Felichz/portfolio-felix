/**
 * A stage: the document a preview runs in (src/pages/stage.astro, /stage/#<tape id>). It holds the
 * preview's tape (src/scripts/tape.ts) and, when the page asks, its live app (src/scripts/session.ts),
 * and speaks to the page only through messages (src/scripts/stage-protocol.ts). Served from another site
 * than the page (src/scripts/origin.ts), it runs in its own process: building a tape, booting an app,
 * the app itself, none of it costs the page a frame. The app is on the stage's own origin, so the stage
 * seeds its storage and drives it directly, as the page used to.
 */
import { TapeCore } from './tape';
import { Session } from './session';
import type { ToHost, ToStage } from './stage-protocol';

const id = decodeURIComponent(location.hash.slice(1));
const root = document.documentElement;

let host: { win: Window; origin: string } | undefined;
const post = (m: ToHost) => (host ? host.win.postMessage(m, host.origin) : parent.postMessage(m, '*'));

const core = document.createElement('tape-core') as TapeCore;
core.setAttribute('src', `/tapes/${id}.json`);
document.body.append(core);
let title = id;
let inWindow = false;
let session: Session | undefined;
let warmBytes = false;

core.addEventListener('loadedmetadata', () => post({ k: 'meta', duration: core.duration }));
core.addEventListener('playing', () => post({ k: 'playing', t: core.currentTime * 1000 }));
core.addEventListener('pause', () => post({ k: 'pause', t: core.currentTime * 1000 }));
core.addEventListener('ended', () => post({ k: 'ended' }));

const newSession = () => {
  const s = new Session(id, core, {
    box: document.body,
    title,
    theme: () => core.theme,
    inWindow: () => inWindow,
    hooks: {
      pointer: (f) => post({ k: 'pointer', f }),
      wheel: (dx, dy) => post({ k: 'wheel', dx, dy }),
      escape: () => post({ k: 'escape' }),
      themeApp: () => post({ k: 'theme-app' }),
    },
  });
  // The tape went back while playing: the app starts over from its checkpoint.
  s.onReboot = () => {
    s.dispose();
    session = newSession();
  };
  void s.booted.then(() => session === s && post({ k: 'booted' }));
  return s;
};

/** The mode a window asks for takes effect with the resize that comes with the move, on that frame. */
let pendingMode: boolean | undefined;
const applyMode = () => {
  if (pendingMode === undefined) return;
  inWindow = pendingMode;
  pendingMode = undefined;
  root.toggleAttribute('data-window', inWindow);
};
addEventListener('resize', applyMode);

const nextFrames = (n = 2) => new Promise<void>((r) => (n <= 1 ? requestAnimationFrame(() => r()) : requestAnimationFrame(() => void nextFrames(n - 1).then(r))));

addEventListener('message', (e: MessageEvent<ToStage>) => {
  if (e.source !== parent) return;
  host ??= { win: parent, origin: e.origin };
  if (e.origin !== host.origin) return;
  const m = e.data;
  switch (m.k) {
    case 'init':
      title = m.title;
      core.theme = m.theme;
      return;
    case 'load':
      core.preload = 'auto';
      // Warmed means built, not just fetched: the snapshot, its fonts and a filmed clip are ready
      // before the preview is turned to, so activating it only starts the clock.
      void core.ready();
      return;
    case 'play':
      // A live app is the preview now: its tape stays where it stopped.
      if (session?.live || !core.paused) return post({ k: 'playing', t: core.currentTime * 1000 });
      return void core.play();
    case 'pause':
      return core.pause();
    case 'seek':
      if (!session?.live) core.currentTime = m.t / 1000;
      return;
    case 'rate':
      core.playbackRate = m.r;
      return;
    case 'loop':
      core.loop = m.on;
      return;
    case 'theme':
      core.theme = m.theme;
      session?.syncTheme();
      return void nextFrames().then(() => post({ k: 'ack', id: m.id }));
    case 'boot':
      session ??= newSession();
      return;
    case 'live':
      session ??= newSession();
      return void session.goLive().then(() => session?.live && post({ k: 'live' }));
    case 'ghost':
      // The tape answers the pointer while the app behind it boots; once it's live, the pointer is
      // the app's and the ghost lifts.
      if (!session?.live) core.hover(m.x, m.y);
      else core.hover(-1, -1);
      return;
    case 'warm-bytes': {
      // The app's entry and its recorded prefetches, into the cache in the stage's own origin — the
      // one the app's frame will load from. Only before any boot (a fetch in flight while the app
      // loads would deduplicate against the frame's own request and hold it up), and only once the
      // tape — which names the files — is here.
      const tape = core.tape;
      if (!tape || warmBytes || session) return;
      warmBytes = true;
      const base = new URL(tape.app.entry, location.href);
      fetch(base.href, { priority: 'low' }).catch(() => {});
      for (const p of tape.app.prefetch ?? []) fetch(new URL(p, base), { priority: 'low' }).catch(() => {});
      return;
    }
    case 'mode':
      pendingMode = m.window;
      // (If the move brings no resize, it applies anyway.)
      setTimeout(applyMode, 150);
      return;
    case 'hold':
      return session?.hold(m.on);
    case 'drop':
      session?.dispose();
      session = undefined;
      return post({ k: 'dropped' });
    case 'focus':
      return session?.frame?.focus();
  }
});

// Hover, for the page: a page can't see the pointer over a frame from another site.
root.addEventListener('pointerenter', () => post({ k: 'hover', on: true }));
root.addEventListener('pointerleave', () => post({ k: 'hover', on: false }));

// This site, opened in its own stage, hands its theme toggle on (see Bar.astro): the page around the
// stage switches, spreading from that point.
window.__faTheme = (from) => {
  if (from && 'x' in from) post({ k: 'theme-toggle', x: from.x, y: from.y });
};

post({ k: 'hello' });
