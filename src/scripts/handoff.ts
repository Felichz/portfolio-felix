/**
 * Theme switches and recordings. Each recording exists once per edition, same length, same frames,
 * and only the visible one plays. When the theme flips, the other edition's video takes over where
 * the visible one was, so a switch never restarts the recording or the showcase countdown.
 *
 * The toggle (Bar.astro) fires `theme:switch` right before the flip, with `waitUntil` for promises
 * the flip waits on. The incoming video seeks to where the outgoing one will be once it has started
 * (a start time learned from the last switches), and the flip waits only for that frame, not for
 * playback, so the click stays responsive; the circle reveal covers the moment it takes to start.
 * Only one video decodes, apart from that moment.
 */
// Plates hold <tape-player> elements too; define it before any plate script drives one.
import './tape';

export interface ThemeSwitch {
  theme: 'light' | 'dark';
  waitUntil: (p: Promise<unknown>) => void;
}

/** The longest a switch waits for the incoming frame; a video that isn't loaded yet catches up after. */
const CAP = 200;

/** How long a video takes here from seek to playing, learned from the last switches. */
let startCost = 0.2;

/**
 * The visible edition of a plate's recording, and the hidden one. Decided by the theme classes, the
 * same ones that hide the other edition.
 */
export function editions(plate: HTMLElement) {
  const all = [...plate.querySelectorAll<HTMLVideoElement>('.plate-motion video, .plate-motion tape-player')];
  const shown = document.documentElement.dataset.theme === 'dark' ? 'only-dark' : 'only-light';
  // A tape plays in both themes (src/scripts/tape.ts), so it is always the visible one and has no twin.
  const from = all.find((v) => v.tagName === 'TAPE-PLAYER' || v.classList.contains(shown));
  const to = all.find((v) => v !== from);
  return { from, to };
}

/** Moves playback from the visible edition's video to the other's, keeping its place. */
function handOff(from: HTMLVideoElement, to: HTMLVideoElement): Promise<void> {
  const playing = !from.paused && !from.ended;
  to.loop = from.loop;
  to.preload = 'auto';
  return new Promise<void>((resolve) => {
    let timer = 0;
    const settle = () => {
      clearTimeout(timer);
      from.pause();
      resolve();
    };
    const go = () => {
      const end = Number.isFinite(to.duration) ? to.duration - 0.05 : Infinity;
      to.addEventListener('seeked', settle, { once: true });
      to.currentTime = Math.min(end, from.currentTime + (playing ? startCost : 0));
      if (!playing) return;
      const began = performance.now();
      to.addEventListener('playing', () => (startCost = Math.min(0.6, Math.max(0.05, startCost * 0.5 + ((performance.now() - began) / 1000) * 0.5))), { once: true });
      to.play().catch(() => {});
    };
    if (to.readyState >= 1) go();
    else {
      to.addEventListener('loadedmetadata', go, { once: true });
      if (to.networkState !== HTMLMediaElement.NETWORK_LOADING) to.load();
    }
    timer = window.setTimeout(settle, CAP);
  });
}

/**
 * Keeps recordings running across theme switches. `plates` lists the plates to follow; `onSwitch`
 * lets the caller move its own listeners (like `ended`) to the incoming video.
 */
export function followThemeSwitches(plates: () => HTMLElement[], onSwitch?: (plate: HTMLElement, to: HTMLVideoElement) => void) {
  document.addEventListener('theme:switch', (e) =>
    plates().forEach((p) => {
      if (p.dataset.state !== 'playing' && p.dataset.state !== 'loading') return;
      const { from, to } = editions(p);
      if (!from || !to) return;
      onSwitch?.(p, to);
      (e as CustomEvent<ThemeSwitch>).detail.waitUntil(handOff(from, to));
    }),
  );
}
