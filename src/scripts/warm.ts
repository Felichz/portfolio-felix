/**
 * Warms the page's lazy images: each is fetched and decoded before it would otherwise first appear,
 * so the frame that shows it (a showcase slide turning active, a panel scrolling in) doesn't wait on
 * a decode. Both editions get warmed — the theme that isn't showing is `display:none` and unfetched,
 * and it is exactly what a toggle will ask for, so its decode is the toggle's worst surprise.
 *
 * Nothing loads before the visitor's first input (page-load audits stay clean), and the fetches are
 * low priority: they only use idle network for bytes the visitor is about to see anyway.
 */
export function initWarm() {
  const warmed = new WeakSet<HTMLImageElement>();
  // What to fetch is decided by the browser, so the probe has to be a real picture in a real document:
  // a detached one selects nothing, and `img.src` alone is the fallback — the heaviest file of the set
  // (a portrait's fallback runs to 1.1 MB where the candidate that fits the page is 7 KB). This hole is
  // in the viewport, so a cloned <picture> resolves against the same viewport the real one will, and
  // 1px, clipped and transparent, so the warm adds no paint.
  let hole: HTMLElement | undefined;
  const pit = () =>
    (hole ??= (() => {
      const d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;contain:strict';
      document.body.append(d);
      return d;
    })());

  // A few pictures per idle slice, the rest in the next one: cloning and laying out every lazy picture in
  // one task was a 59 ms freeze at 4x (warm.ts:27, the carousel's next step).
  const warm = (deadline?: IdleDeadline) => {
    for (const img of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
      if (img.complete || img.currentSrc || warmed.has(img)) continue;
      if (deadline && deadline.timeRemaining() < 8) {
        idle(warm);
        return;
      }
      warmed.add(img);
      const box = img.closest('picture') ?? img;
      const probe = box.cloneNode(true) as HTMLElement;
      const target = (probe.tagName === 'IMG' ? probe : probe.querySelector('img')) as HTMLImageElement | null;
      if (!target) continue;
      // src off, so only the srcset of this picture can resolve; eager, so a hole the size of a pixel
      // is enough to start it; low, so the warm never takes bytes from what the visitor is looking at.
      target.removeAttribute('src');
      target.loading = 'eager';
      target.decoding = 'async';
      target.fetchPriority = 'low';
      pit().append(probe);
      target
        .decode()
        .catch(() => {})
        .finally(() => probe.remove());
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
