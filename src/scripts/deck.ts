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
 * A hash can also name an element inside a section (its id): the
 * deck moves to its section and scrolls it into view, and the address keeps that hash.
 * - `deck:refresh` (listened for) re-reads the active section's glow color.
 * - `deck:glow` { detail: color } once the glow is set on the elements that draw with it.
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
  const nearest = (top = stage.scrollTop) => {
    const mid = top + stage.clientHeight / 2;
    let i = 0;
    panels.forEach((p, j) => p.offsetTop <= mid && (i = j));
    return i;
  };
  let index = -1;
  let target = nearest();

  // The room's light, the active section's two glow colors, is set on the elements that draw with it
  // ([data-glow]: the ambient light, the cursor's pool, the section rail, the contact card), not on the
  // root: a custom property changed on the root restyles the whole page, and did so on every theme
  // switch and product change, in a frame that had just restyled it all once. `deck:glow` follows.
  const lit = [...document.querySelectorAll<HTMLElement>('[data-glow]')];
  const setGlow = (a: string, b?: string) => {
    for (const el of lit) {
      if (a) el.style.setProperty('--glow', a);
      if (b) el.style.setProperty('--glow-2', b);
    }
    document.dispatchEvent(new CustomEvent('deck:glow', { detail: a }));
  };
  const glow = () => {
    const panel = panels[index];
    if (!panel) return;
    const cs = getComputedStyle(panel);
    setGlow(cs.getPropertyValue('--panel-glow').trim(), cs.getPropertyValue('--panel-glow-2').trim());
  };

  const pill = () => {
    if (!strip) return;
    const tab = strip.querySelector<HTMLElement>('[aria-current="true"]');
    if (!tab) return;
    strip.style.setProperty('--pill-x', `${tab.offsetLeft}px`);
    strip.style.setProperty('--pill-w', `${tab.offsetWidth}px`);
  };

  /** The section an element is in, if it's inside one (not a section itself). */
  const inside = (id: string) => {
    const el = id ? document.getElementById(id) : null;
    const panel = el?.closest<HTMLElement>('.panel');
    return el && panel && el !== panel ? { el, i: panels.indexOf(panel) } : undefined;
  };
  /** Brings an element inside a section to the top of the view: in the section, when it scrolls on
      its own (desktop), or in the deck (phones). */
  const reveal = (el: HTMLElement, smooth: boolean) => {
    const panel = el.closest<HTMLElement>('.panel')!;
    const own = panel.scrollHeight > panel.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(panel).overflowY);
    const scroller = own ? panel : stage;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (own ? 24 : 88);
    scroller.scrollBy({ top, behavior: smooth && !reduce.matches ? 'smooth' : 'instant' });
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
    // (A page that opens on one of its panels, with no hash, keeps its own address there.)
    const home = i === 0 || panel.id === stage.dataset.start;
    if (current !== panel.id && !(home && !current) && inside(current)?.i !== i) {
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

  // Scroll: the active section changes once the next one is past the middle. While the page is being
  // flung, the ambient light steps between its colors instead of drifting: a drift repaints the whole
  // fixed background on every frame for the better part of a second, panel after panel at that speed.
  // At rest and at reading speed it drifts as usual.
  // The deck is read once a frame, in the frame, and written after: read in the scroll event, its
  // position would lay the page out there, and the class it sets would have the frame lay it out again.
  let raf = 0;
  let settle = 0;
  let fast = 0;
  let lastTop = stage.scrollTop;
  let lastAt = 0;
  const onFrame = (now: number) => {
    raf = 0;
    const top = stage.scrollTop;
    const v = Math.abs(top - lastTop) / Math.max(1, now - lastAt);
    lastTop = top;
    lastAt = now;
    setActive(nearest(top));
    if (v > 1.1) {
      root.classList.add('deck-fast');
      clearTimeout(fast);
      fast = window.setTimeout(() => root.classList.remove('deck-fast'), 160);
    }
  };
  // `data-moving` while it scrolls: the sections out of sight that skip their rendering for a moment
  // (global.css) render again before any of them comes in.
  let moving = false;
  stage.addEventListener(
    'scroll',
    () => {
      raf ||= requestAnimationFrame(onFrame);
      if (!moving) {
        moving = true;
        stage.setAttribute('data-moving', '');
      }
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        target = nearest();
        moving = false;
        stage.removeAttribute('data-moving');
      }, 140);
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
    const at = i < 0 ? inside(id) : undefined;
    if (at) {
      // Something inside a section: its section, then the element, and the address names it.
      e.preventDefault();
      history.replaceState(history.state, '', `#${id}`);
      if (at.i !== index) go(at.i, { smooth: false });
      reveal(at.el, true);
      return;
    }
    if (i < 0) return;
    e.preventDefault();
    const nav = a.closest('.bar, .dock') !== null;
    go(i, { focus: nav });
    // A link in the page's own text to a long section opens it at its start, wherever it was left.
    if (!nav && !sub) panels[i]!.scrollTo({ top: 0, behavior: 'instant' });
    // (The same section: the address still drops whatever it named inside it.)
    if (i === index && location.hash !== url.hash) history.replaceState(history.state, '', i === 0 ? location.pathname + location.search : url.hash);
    if (sub) document.dispatchEvent(new CustomEvent('deck:sub', { detail: { id, sub } }));
  });
  addEventListener('hashchange', () => {
    const { i, id, sub } = resolve(location.hash);
    const at = i < 0 ? inside(id) : undefined;
    if (at) {
      if (at.i !== index) go(at.i, { smooth: false });
      return reveal(at.el, true);
    }
    if (i >= 0) go(i);
    if (sub) document.dispatchEvent(new CustomEvent('deck:sub', { detail: { id, sub } }));
  });

  // Desktop sections are exactly one window tall: stay aligned through resizes.
  new ResizeObserver(() => {
    if (desktop.matches) stage.scrollTo({ top: panels[index]?.offsetTop ?? 0, behavior: 'instant' });
    pill();
  }).observe(stage);

  // Read on the next frame: right after a product change the panel's styles are dirty, and reading
  // them here would force a full layout (container queries) and then a second style pass.
  let glowFrame = 0;
  // A section that knows its new light passes it ({ panel, glow: { light, dark } }, Work on a product
  // change): set without a read, which right after the change restyled the whole page on the spot
  // (freezes.mjs: 60 ms at 4x CPU). The second color is the section's own and stays as it is.
  document.addEventListener('deck:refresh', (e) => {
    const said = (e as CustomEvent<{ panel?: HTMLElement; glow?: { light: string; dark: string } } | null>).detail;
    cancelAnimationFrame(glowFrame);
    glowFrame = requestAnimationFrame(() => {
      if (said?.glow && said.panel === panels[index]) setGlow(root.dataset.theme === 'dark' ? said.glow.dark : said.glow.light);
      else glow();
    });
  });
  new MutationObserver(glow).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  setActive(nearest());
  // A deep link into a section (the pre-paint script opened its section): once the fonts have laid
  // the section out, the element it names comes to the top.
  const linked = inside(decodeURIComponent(location.hash.slice(1)).split('/')[0]);
  if (linked) (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => reveal(linked.el, false)));
  requestAnimationFrame(() => strip?.setAttribute('data-ready', ''));
  document.fonts?.ready.then(pill);
  root.setAttribute('data-deck-ready', '');
}
