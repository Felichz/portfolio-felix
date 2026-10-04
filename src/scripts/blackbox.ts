/**
 * The black box: a flight recorder for the page's frame times. It keeps the last few hundred frame
 * timestamps and long animation frames, and when a frame gap over 250 ms happens (a freeze a person
 * sees) it writes out what the page was doing at that moment — what stage was mounting, whether the
 * app window was open, whether the page was being flung — so the cause arrives with the occurrence
 * instead of needing a hunt. Dumps go to the console and to sessionStorage under `bb-dump`; the
 * arrays are exposed as `window.__bb` for the perf scripts to read.
 *
 * The recorder starts on the visitor's first input, like everything else on the page: page-load
 * audits pay nothing for it. And it runs only when measuring (the perf scripts set `perf` in
 * sessionStorage, or add ?perf to the address): its frame loop keeps the page's main thread awake on
 * every vsync, and then every running animation is restyled there too, composited or not. For
 * visitors that cost half of a core while a preview played.
 */
export function initBlackbox() {
  if (window !== window.top) return;
  let measuring = new URLSearchParams(location.search).has('perf');
  try {
    measuring ||= sessionStorage.getItem('perf') === '1';
  } catch {}
  if (!measuring) return;
  type Loaf = { t: number; d: number };
  type Dump = { gap: number; at: number; [k: string]: unknown };
  const frames: number[] = [];
  const loaf: Loaf[] = [];
  const dumps: Dump[] = [];
  let armed = false;
  let last = 0;

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) loaf.push({ t: e.startTime, d: e.duration });
      while (loaf.length > 120) loaf.shift();
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}

  const context = () => ({
    at: Math.round(performance.now()),
    hidden: document.hidden,
    flinging: document.documentElement.classList.contains('deck-fast'),
    windowOpen: document.documentElement.classList.contains('thawing') || !!document.querySelector('.thaw'),
    slide: document.querySelector('.slide[data-state="active"]')?.getAttribute('data-id') ?? null,
    mounts: performance
      .getEntriesByType('mark')
      .filter((m) => m.name.startsWith('live:mount'))
      .slice(-6)
      .map((m) => `${m.name}@${Math.round(m.startTime)}`),
    loaf: loaf.filter((e) => e.t > performance.now() - 3000).map((e) => `${Math.round(e.d)}ms@${Math.round(e.t)}`),
  });

  const dump = (gap: number) => {
    const c: Dump = { gap: Math.round(gap), ...context() };
    dumps.push(c);
    while (dumps.length > 8) dumps.shift();
    console.warn(`[blackbox] ${c.gap}ms frame gap`, c);
    try {
      sessionStorage.setItem('bb-dump', JSON.stringify(dumps));
    } catch {}
  };

  const tick = (t: number) => {
    frames.push(t);
    while (frames.length > 600) frames.shift();
    if (armed) {
      const gap = t - last;
      if (gap > 250 && (!dumps.length || t - (dumps.at(-1)!.at ?? 0) > 5000)) dump(gap);
    }
    last = t;
    requestAnimationFrame(tick);
  };

  const arm = () => {
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(type, arm, true);
    armed = true;
    requestAnimationFrame(tick);
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, arm, { capture: true, passive: true });

  (window as Window & { __bb?: unknown }).__bb = {
    get frames() {
      return frames;
    },
    get loaf() {
      return loaf;
    },
    get dumps() {
      return dumps;
    },
  };
}
