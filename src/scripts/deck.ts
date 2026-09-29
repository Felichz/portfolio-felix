/**
 * The deck: a horizontal row of full-window panels.
 * Vertical wheel gestures page between panels unless something inside the panel can scroll first,
 * horizontal gestures and touch swipes scroll natively with snapping, and the keyboard, the bar
 * tabs, the dock and in-page links all move through the same `go()`.
 *
 * Events on document:
 * - `deck:change` { id, index } when a panel becomes the active one.
 * - `deck:sub` { id, sub } when a link asks for something inside a panel (`#work/katarch`).
 * - `deck:refresh` (listened for) re-reads the active panel's glow color.
 */
export function initDeck() {
  const stage = document.querySelector<HTMLElement>('[data-deck]');
  if (!stage) return;
  const root = document.documentElement;
  const panels = [...stage.children].filter((p): p is HTMLElement => p.classList.contains('panel'));
  if (!panels.length) return;

  const tabs = [...document.querySelectorAll<HTMLAnchorElement>('[data-tab]')];
  const strip = document.querySelector<HTMLElement>('[data-tabs]');
  const ticks = [...document.querySelectorAll<HTMLElement>('.dock-tick')];
  const num = document.querySelector<HTMLElement>('[data-dock-num]');
  const label = document.querySelector<HTMLElement>('[data-dock-label]');
  const prev = document.querySelector<HTMLButtonElement>('[data-deck-prev]');
  const next = document.querySelector<HTMLButtonElement>('[data-deck-next]');
  const nextLabel = document.querySelector<HTMLElement>('[data-dock-next]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const labels = panels.map((p) => p.dataset.label ?? p.id);

  const width = () => stage.clientWidth || 1;
  const nearest = () => Math.max(0, Math.min(panels.length - 1, Math.round(stage.scrollLeft / width())));
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
    ticks.forEach((t, j) => t.toggleAttribute('data-on', j <= i));
    pill();
    if (num) num.textContent = String(i + 1).padStart(2, '0');
    if (label) label.textContent = labels[i] ?? '';
    if (prev) prev.disabled = i === 0;
    // From the last panel, the next button leads on: back to the start, or to the next case study.
    const atEnd = i === panels.length - 1;
    const upNext = atEnd ? (next?.dataset.endLabel ?? 'Back to start') : (labels[i + 1] ?? '');
    next?.setAttribute('aria-label', atEnd ? upNext : `Next: ${upNext}`);
    next?.toggleAttribute('data-end', atEnd);
    if (nextLabel) nextLabel.textContent = upNext;
    // Keep the address in step, without adding a history entry per panel.
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
    stage.scrollTo({ left: panels[j]!.offsetLeft, behavior: smooth ? 'smooth' : 'instant' });
    if (!smooth) setActive(j);
    if (opts.focus) panels[j]!.focus({ preventScroll: true });
  };

  // Scroll: progress for the dock, and the active panel once it's more than halfway in.
  let raf = 0;
  let settle = 0;
  stage.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = stage.scrollWidth - stage.clientWidth;
        root.style.setProperty('--deck-p', String(max > 0 ? stage.scrollLeft / max : 0));
        setActive(nearest());
      });
      clearTimeout(settle);
      settle = window.setTimeout(() => (target = nearest()), 140);
    },
    { passive: true },
  );

  // Vertical wheel pages the deck. One gesture moves one panel, and a gesture that started by
  // scrolling something inside the panel never turns into a page flip halfway through.
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
  stage.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return;
      const now = performance.now();
      if (now - last > 200) {
        acc = 0;
        spent = false;
        inner = false;
      }
      last = now;
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      for (let el = e.target as HTMLElement | null; el && el !== stage; el = el.parentElement) {
        if (canScroll(el, e.deltaY)) {
          inner = true;
          return;
        }
      }
      e.preventDefault();
      if (spent || inner) return;
      acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(acc) >= 28) {
        spent = true;
        go(target + Math.sign(acc));
      }
    },
    { passive: false },
  );

  // Keyboard, unless focus is somewhere that owns the keys.
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable], [data-own-keys]') || document.querySelector('dialog[open]')) return;
    const step: Record<string, number> = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
    if (e.key in step) {
      e.preventDefault();
      go(target + step[e.key]!);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      go(e.key === 'Home' ? 0 : panels.length - 1);
    }
  });

  prev?.addEventListener('click', () => go(target - 1));
  next?.addEventListener('click', () => {
    if (index < panels.length - 1) return go(target + 1);
    if (next.dataset.endHref) location.href = next.dataset.endHref;
    else go(0);
  });

  // In-page links: `#panel` or `#panel/sub`, also written as `/#panel` on the home page.
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

  // Stay on the same panel through resizes and rotation.
  new ResizeObserver(() => {
    stage.scrollTo({ left: panels[index]?.offsetLeft ?? 0, behavior: 'instant' });
    pill();
  }).observe(stage);

  document.addEventListener('deck:refresh', glow);
  new MutationObserver(glow).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  setActive(nearest());
  requestAnimationFrame(() => strip?.setAttribute('data-ready', ''));
  document.fonts?.ready.then(pill);
  root.setAttribute('data-deck-ready', '');
}
