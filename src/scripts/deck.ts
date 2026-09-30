/**
 * The deck: a vertical stack of full-window sections that moves one section at a time.
 * On desktop, a wheel or trackpad gesture moves one section, unless something inside the section
 * can still scroll that way (then that scrolls first). On phones the deck scrolls naturally with
 * loose snapping. The keyboard, the bar tabs, the section rail and in-page links all move through
 * the same `go()`.
 *
 * Events on document:
 * - `deck:change` { id, index } when a section becomes the active one.
 * - `deck:sub` { id, sub } when a link asks for something inside a section (`#work/katarch`).
 * - `deck:refresh` (listened for) re-reads the active section's glow color.
 */
export function initDeck() {
  const stage = document.querySelector<HTMLElement>('[data-deck]');
  if (!stage) return;
  const root = document.documentElement;
  const panels = [...stage.children].filter((p): p is HTMLElement => p.classList.contains('panel'));
  if (!panels.length) return;

  const tabs = [...document.querySelectorAll<HTMLAnchorElement>('[data-tab]')];
  const strip = document.querySelector<HTMLElement>('[data-tabs]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 761px)');

  // The active section is the last one whose top has passed the middle of the window.
  const nearest = () => {
    const mid = stage.scrollTop + stage.clientHeight / 2;
    let i = 0;
    panels.forEach((p, j) => p.offsetTop <= mid && (i = j));
    return i;
  };
  let index = -1;
  let target = nearest();

  const glow = () => {
    const panel = panels[index];
    if (!panel) return;
    const cs = getComputedStyle(panel);
    const a = cs.getPropertyValue('--panel-glow').trim();
    const b = cs.getPropertyValue('--panel-glow-2').trim();
    if (a) root.style.setProperty('--glow', a);
    if (b) root.style.setProperty('--glow-2', b);
  };

  const pill = () => {
    if (!strip) return;
    const tab = strip.querySelector<HTMLElement>('[aria-current="true"]');
    if (!tab) return;
    strip.style.setProperty('--pill-x', `${tab.offsetLeft}px`);
    strip.style.setProperty('--pill-w', `${tab.offsetWidth}px`);
  };

  const setActive = (i: number) => {
    if (i === index) return;
    index = i;
    const panel = panels[i]!;
    panels.forEach((p, j) => p.toggleAttribute('data-active', j === i));
    panel.setAttribute('data-seen', '');
    tabs.forEach((t) => (t.dataset.tab === panel.id ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    pill();
    // Keep the address in step, without adding a history entry per section.
    const current = decodeURIComponent(location.hash.slice(1)).split('/')[0];
    if (current !== panel.id && !(i === 0 && !current)) {
      history.replaceState(history.state, '', i === 0 ? location.pathname + location.search : `#${panel.id}`);
    }
    glow();
    document.dispatchEvent(new CustomEvent('deck:change', { detail: { id: panel.id, index: i } }));
  };

  const go = (i: number, opts: { smooth?: boolean; focus?: boolean } = {}) => {
    const j = Math.max(0, Math.min(panels.length - 1, i));
    target = j;
    const smooth = opts.smooth !== false && !reduce.matches;
    stage.scrollTo({ top: panels[j]!.offsetTop, behavior: smooth ? 'smooth' : 'instant' });
    if (!smooth) setActive(j);
    if (opts.focus) panels[j]!.focus({ preventScroll: true });
  };

  // Scroll: the active section changes once the next one is past the middle.
  let raf = 0;
  let settle = 0;
  stage.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(nearest()));
      clearTimeout(settle);
      settle = window.setTimeout(() => (target = nearest()), 140);
    },
    { passive: true },
  );

  // One gesture moves one section, and a gesture that started by scrolling something inside the
  // section never turns into a section change halfway through.
  const canScroll = (el: HTMLElement, dy: number) => {
    if (el.scrollHeight <= el.clientHeight + 1) return false;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll') return false;
    return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  };
  let last = 0;
  let acc = 0;
  let spent = false;
  let inner = false;
  // When something inside a section was just scrolled, reaching its edge never changes section
  // right away: the wheel has to rest for a moment first. Inner and section scrolling never compete.
  const INNER_REST = 900;
  let innerAt = -Infinity;
  stage.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || !desktop.matches) return;
      const now = performance.now();
      if (now - last > 200) {
        acc = 0;
        spent = false;
        inner = false;
      }
      last = now;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      for (let el = e.target as HTMLElement | null; el && el !== stage; el = el.parentElement) {
        if (canScroll(el, e.deltaY)) {
          inner = true;
          innerAt = now;
          return;
        }
      }
      e.preventDefault();
      if (spent || inner) return;
      if (now - innerAt < INNER_REST) {
        innerAt = now;
        return;
      }
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(acc) >= 24) {
        spent = true;
        go(target + Math.sign(acc));
      }
    },
    { passive: false },
  );

  // Keyboard, unless focus is somewhere that owns the keys. A section that overflows scrolls first.
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (e.key === ' ' && t.closest('a, button, summary')) return;
    if (t.closest('input, textarea, select, [contenteditable], [data-own-keys]') || document.querySelector('dialog[open]')) return;
    const step: Record<string, number> = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
    if (e.key in step) {
      const dir = e.shiftKey && e.key === ' ' ? -1 : step[e.key]!;
      const panel = panels[index];
      if (desktop.matches && panel && canScroll(panel, dir)) {
        e.preventDefault();
        panel.scrollBy({ top: dir * panel.clientHeight * 0.6, behavior: reduce.matches ? 'instant' : 'smooth' });
        return;
      }
      if (!desktop.matches) return;
      e.preventDefault();
      go(target + dir);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      go(e.key === 'Home' ? 0 : panels.length - 1);
    }
  });

  // In-page links: `#section` or `#section/sub`, also written as `/#section` on the home page.
  const resolve = (hash: string) => {
    const [id = '', sub] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
    return { i: panels.findIndex((p) => p.id === id), id, sub };
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!a || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const { i, id, sub } = resolve(url.hash);
    if (i < 0) return;
    e.preventDefault();
    go(i, { focus: a.closest('.bar, .dock') !== null });
    if (sub) document.dispatchEvent(new CustomEvent('deck:sub', { detail: { id, sub } }));
  });
  addEventListener('hashchange', () => {
    const { i, id, sub } = resolve(location.hash);
    if (i >= 0) go(i);
    if (sub) document.dispatchEvent(new CustomEvent('deck:sub', { detail: { id, sub } }));
  });

  // Desktop sections are exactly one window tall: stay aligned through resizes.
  new ResizeObserver(() => {
    if (desktop.matches) stage.scrollTo({ top: panels[index]?.offsetTop ?? 0, behavior: 'instant' });
    pill();
  }).observe(stage);

  document.addEventListener('deck:refresh', glow);
  new MutationObserver(glow).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  setActive(nearest());
  requestAnimationFrame(() => strip?.setAttribute('data-ready', ''));
  document.fonts?.ready.then(pill);
  root.setAttribute('data-deck-ready', '');
}
