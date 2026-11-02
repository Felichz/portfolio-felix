// What the work ledger must keep true, checked with `node scripts/perf/ledger.mjs --check`. Each rule
// reads one scene and says the most it may cost. A count is taken from each run and the least is kept
// (a late load only ever adds), so a rule fails on work every run did.
//
// Two kinds. Rules on scenes at rest or under a steady hand are tight: their counts repeat run after
// run, so going over means the code changed. Rules on scenes that load something (to-work,
// next-product, open-window, theme) are ceilings with room, there to catch a cost that doubles.
// When a change lowers a count for good, lower its rule in the same commit.
//
// A rule's `count(run)` gets one run of the scene: its totals (`run.rafs`, `run.forced`, ...) and two
// helpers, `asked(kind, where)` for frames or timers asked for from a source location, and
// `forced(kind, where)` for style or layout forced there (`where` is a RegExp over `src/...:line name`).

export const INVARIANTS = [
  // At rest, a live preview on screen: the cursor light settling and nothing else.
  { scene: 'idle-live', says: 'a live preview at rest lays out nothing', count: (r) => r.layouts, max: 0 },
  { scene: 'idle-live', says: 'a live preview at rest paints nothing', count: (r) => r.paints, max: 0 },
  { scene: 'idle-live', says: 'at rest, only the cursor light asks for frames', count: (r) => r.rafs - r.asked('rAF', /field\.ts/), max: 0 },
  { scene: 'idle-live', says: 'the cursor light settles in under 40 frames', count: (r) => r.asked('rAF', /field\.ts/), max: 40 },
  { scene: 'idle-live', says: 'at rest, a few timers', count: (r) => r.timers, max: 12 },
  { scene: 'idle-live', says: 'at rest, no layout forced', count: (r) => r.forced('layout'), max: 0 },

  // At rest on the showcase, before any preview went live.
  { scene: 'idle-work', says: 'the showcase at rest asks for 10 frames at most', count: (r) => r.rafs, max: 10 },
  { scene: 'idle-work', says: 'the showcase at rest forces no layout', count: (r) => r.forced('layout'), max: 0 },
  { scene: 'idle-work', says: 'the showcase at rest, a few timers', count: (r) => r.timers, max: 16 },

  // The pace loop (src/scripts/session.ts) samples frames only for apps with endless animations, and
  // KnowGraph has none: no frames asked for it in any scene that keeps to KnowGraph.
  ...['hover-live', 'use', 'open-window', 'close-window', 'scroll', 'idle-live'].map((scene) => ({
    scene,
    says: 'the pace loop asks no frames for an app without endless animations',
    count: (r) => r.asked('rAF', /session\.ts/),
    max: 0,
  })),

  // Going live and using the app: the app's own work, nothing forced from the page.
  { scene: 'hover-live', says: 'going live forces no layout', count: (r) => r.forced('layout'), max: 0 },
  { scene: 'use', says: 'using a live preview forces no layout', count: (r) => r.forced('layout'), max: 0 },
  { scene: 'use', says: 'using a live preview, the page asks for no frames of its own', count: (r) => r.rafs - r.asked('rAF', /^app:/), max: 0 },

  // The window.
  { scene: 'close-window', says: 'closing the window asks for 5 frames at most', count: (r) => r.rafs, max: 5 },
  { scene: 'close-window', says: 'closing the window forces 10 styles or layouts at most', count: (r) => r.forced(), max: 10 },
  { scene: 'open-window', says: 'opening the window forces 35 styles or layouts at most', count: (r) => r.forced(), max: 35 },

  // Scrolling the deck: one section down and back.
  { scene: 'scroll', says: 'while the deck scrolls, layout is forced only by the deck, the cursor light and live.ts', count: (r) => r.forced('layout') - r.forced('layout', /^src\/scripts\/(deck|field|live)\.ts/), max: 0 },
  { scene: 'scroll', says: 'the deck forces one layout per frame it asks for, at most', count: (r) => r.forced('layout', /deck\.ts/) / Math.max(1, r.asked('rAF', /deck\.ts/)), max: 1 },
  { scene: 'scroll', says: 'a deck scroll asks for 100 frames at most', count: (r) => r.rafs, max: 100 },

  // Scenes that load something: ceilings with room.
  // (Styles forced on arrival are left out: when the app arrives before its preview is live, pausing
  // each of its long animations in session.ts #rest() forces one, 200 or more in all, but each of one
  // element, about 20 ms together.)
  { scene: 'to-work', says: 'arriving at the showcase forces 50 layouts at most', count: (r) => r.forced('layout'), max: 50 },
  { scene: 'next-product', says: 'changing product forces 90 styles or layouts at most', count: (r) => r.forced(), max: 90 },
  { scene: 'next-product', says: 'changing product asks for 150 frames at most', count: (r) => r.rafs, max: 150 },
  { scene: 'theme', says: 'the theme switch forces 15 styles or layouts at most', count: (r) => r.forced(), max: 15 },
];
