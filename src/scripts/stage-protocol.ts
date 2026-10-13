/**
 * What a page and a stage say to each other (postMessage). A stage (src/pages/stage.astro) holds one
 * preview: its tape and, once asked, its live app. The page drives it like a video and tells it when to
 * boot the app, go live, open in a window or rest; the stage reports its playback and what happens in
 * the app that the page needs to know.
 */

/** Page to stage. */
export type ToStage =
  /** The app edition to show, and the live app's accessible name. */
  | { k: 'init'; theme: string; title: string }
  | { k: 'load' }
  | { k: 'play' }
  | { k: 'pause' }
  | { k: 'seek'; t: number }
  | { k: 'rate'; r: number }
  | { k: 'loop'; on: boolean }
  /** A new edition; answered with `ack` once it's painted. */
  | { k: 'theme'; theme: string; id: number }
  | { k: 'boot' }
  | { k: 'live' }
  /** In a window the app is laid out at the stage's size and keeps the wheel; applied on the next resize. */
  | { k: 'mode'; window: boolean }
  /** The page's pointer over the preview, as fractions across it; x < 0 lifts. The tape's ghost hover. */
  | { k: 'ghost'; x: number; y: number }
  /** Warm the live app's own bytes (its entry and its recorded prefetches) into the cache. */
  | { k: 'warm-bytes' }
  /** Let the tape go entirely (another preview has the stage); a later play rebuilds it. */
  | { k: 'unload' }
  /** Nobody can see it: the app's clock stops and its animations pause. */
  | { k: 'hold'; on: boolean }
  | { k: 'drop' }
  | { k: 'focus' };

/** Stage to page. */
export type ToHost =
  | { k: 'hello' }
  | { k: 'meta'; duration: number }
  | { k: 'playing'; t: number }
  | { k: 'pause'; t: number }
  | { k: 'ended' }
  | { k: 'ack'; id: number }
  | { k: 'booted' }
  | { k: 'live' }
  | { k: 'dropped' }
  /** The pointer's position across the app, 0 to 1. */
  | { k: 'pointer'; f: number }
  | { k: 'wheel'; dx: number; dy: number }
  | { k: 'escape' }
  /** The app switched its own theme. */
  | { k: 'theme-app' }
  /** This site, running in the stage, had its theme toggle used: from a point in the stage's viewport. */
  | { k: 'theme-toggle'; x: number; y: number }
  | { k: 'hover'; on: boolean };
