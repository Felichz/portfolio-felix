/**
 * Warms the page's lazy images: each is fetched and decoded before it would otherwise first appear,
 * so the frame that shows it (a showcase slide turning active, a panel scrolling in) doesn't wait on
 * a decode. Only the edition currently shown is warmed — the other theme's variant is display:none
 * and stays unfetched until a switch, which warms it too.
 *
 * Nothing loads before the visitor's first input (page-load audits stay clean), and the fetches are
 * low priority: they only use idle network for bytes the visitor is about to see anyway.
 */
export function initWarm() {
  const seen = new Set<string>();
  const warm = () => {
    for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
      if (img.complete || getComputedStyle(img).display === 'none') continue;
      const src = img.currentSrc || img.src;
      if (!src || seen.has(src)) continue;
      seen.add(src);
      const ahead = new Image();
      ahead.fetchPriority = 'low';
      ahead.decoding = 'async';
      ahead.src = src;
      ahead.decode().catch(() => {});
    }
  };
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600));
  const start = () => {
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) removeEventListener(type, start, true);
    idle(warm);
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, start, { capture: true, passive: true });
  // The deck reaching a panel means the visitor is on their way (a scroll Lighthouse never makes):
  // what's below it warms then too, before it scrolls in. Warm is idempotent; the second call is free.
  document.addEventListener('deck:change', () => idle(warm));
  // A theme switch shows the other edition's images: those get their turn.
  new MutationObserver(() => idle(warm)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
