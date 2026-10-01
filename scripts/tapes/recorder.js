/*
 * Tape recorder, evaluated inside the app while a scene drives it (scripts/tapes/record.mjs).
 *
 * A tape is the app's own DOM over time, not pixels: a snapshot of the document, then every change to
 * it, in order, with timestamps. It keeps what the browser needs to paint the same frames again with
 * the app's own CSS and none of its JavaScript:
 * - nodes (scripts, links, meta and comments dropped; event handler attributes too), each with an id;
 * - childList changes as the parent's full new child list, which stays correct through moves and
 *   reorders without tracking each insertion; attribute and text changes as their final value;
 * - form values, scroll offsets, and the interaction state CSS can't see in a replay (hover, focus,
 *   pressed), which the player turns into attributes that the rewritten stylesheet matches;
 * - the pointer, so the replay has a cursor;
 * - checkpoints: rest points where the scene is idle, with the app's storage and clock, so a replay
 *   paused there can be thawed into the live app in exactly that state.
 */
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const SKIP = new Set(['SCRIPT', 'NOSCRIPT', 'LINK', 'META', 'TITLE', 'BASE', 'TEMPLATE', 'IFRAME']);
  const URL_ATTRS = new Set(['src', 'href', 'xlink:href', 'poster', 'action']);
  const t0 = performance.now();
  // The app's clock when the tape starts; at tape time t it read clock0 + t.
  const clock0 = Date.now();
  const T = () => Math.round((performance.now() - t0) * 10) / 10;

  const ids = new WeakMap();
  let next = 1;
  const events = [];
  const emit = (e) => events.push(e);

  // Scenes can leave parts of the page out of the tape (window.__tapeIgnore, a selector).
  const ignore = window.__tapeIgnore;
  const skip = (n) => n.nodeType === 8 || (n.nodeType === 1 && (SKIP.has(n.tagName) || (ignore && n.matches(ignore))));
  const fixUrl = (name, value) => {
    if (!URL_ATTRS.has(name) || !value || /^(data:|blob:|#|mailto:|tel:|javascript:)/i.test(value)) return value;
    try {
      const u = new URL(value, location.href);
      return u.origin === location.origin ? u.pathname + u.search + u.hash : u.href;
    } catch {
      return value;
    }
  };
  const attrsOf = (el) => {
    const out = {};
    for (const a of el.attributes) if (!/^on/i.test(a.name)) out[a.name] = fixUrl(a.name, a.value);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      out.__value = el.value;
      if (el.type === 'checkbox' || el.type === 'radio') out.__checked = el.checked ? '1' : '';
    }
    return out;
  };

  // Text: [id, "text"]. Element: [id, tag, attrs, children?], tag prefixed with "s:" in SVG.
  let fresh = new Set();
  const ser = (n) => {
    const id = next++;
    ids.set(n, id);
    fresh.add(n);
    if (n.nodeType === 3) return [id, n.data];
    const kids = [];
    for (const c of n.childNodes) if (!skip(c) && (c.nodeType === 1 || c.nodeType === 3)) kids.push(ser(c));
    const tag = n.namespaceURI === SVG ? 's:' + n.localName : n.localName;
    const out = [id, tag, attrsOf(n)];
    if (kids.length) out.push(kids);
    return out;
  };
  const snapshot = ser(document.documentElement);
  fresh = new Set();

  // ---- DOM changes
  const dirtyKids = new Set();
  const dirtyAttrs = new Map();
  const dirtyText = new Set();
  const flush = () => {
    const t = T();
    fresh = new Set();
    for (const parent of dirtyKids) {
      if (!ids.has(parent) || !parent.isConnected) continue;
      const kids = [];
      for (const c of parent.childNodes) {
        if (skip(c) || (c.nodeType !== 1 && c.nodeType !== 3)) continue;
        kids.push(ids.has(c) && !fresh.has(c) ? ids.get(c) : ser(c));
      }
      emit(['c', t, ids.get(parent), kids]);
    }
    for (const [el, names] of dirtyAttrs) {
      if (!ids.has(el) || fresh.has(el) || !el.isConnected) continue;
      for (const name of names) {
        if (/^on/i.test(name)) continue;
        const v = el.getAttribute(name);
        emit(['a', t, ids.get(el), name, v === null ? null : fixUrl(name, v)]);
      }
    }
    for (const node of dirtyText) {
      if (!ids.has(node) || fresh.has(node) || !node.isConnected) continue;
      emit(['t', t, ids.get(node), node.data]);
    }
    dirtyKids.clear();
    dirtyAttrs.clear();
    dirtyText.clear();
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') dirtyKids.add(r.target);
      else if (r.type === 'attributes') {
        if (!dirtyAttrs.has(r.target)) dirtyAttrs.set(r.target, new Set());
        dirtyAttrs.get(r.target).add(r.attributeName);
      } else dirtyText.add(r.target);
    }
    flush();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

  // ---- State the DOM doesn't carry
  const idOf = (el) => (el && ids.has(el) ? ids.get(el) : 0);
  const on = (type, fn) => document.addEventListener(type, fn, { capture: true, passive: true });
  on('input', (e) => {
    const el = e.target;
    if (!ids.has(el)) return;
    if (el.type === 'checkbox' || el.type === 'radio') emit(['k', T(), idOf(el), el.checked ? 1 : 0]);
    else if ('value' in el) emit(['v', T(), idOf(el), el.value]);
  });
  const scrolled = new Set();
  let scrollFrame = 0;
  on('scroll', (e) => {
    scrolled.add(e.target === document ? document.scrollingElement : e.target);
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const t = T();
      for (const el of scrolled) if (ids.has(el)) emit(['s', t, idOf(el), Math.round(el.scrollTop), Math.round(el.scrollLeft)]);
      scrolled.clear();
    });
  });
  let hover = null;
  on('pointermove', (e) => {
    const t = T();
    emit(['p', t, Math.round(e.clientX * 10) / 10, Math.round(e.clientY * 10) / 10]);
    if (e.target !== hover) {
      hover = e.target;
      emit(['h', t, idOf(hover)]);
    }
  });
  on('pointerdown', () => emit(['d', T(), 1]));
  // Clicks, addressed by structure: the live app renders the same DOM for the same build and state, so
  // the path of element-child indices from <body> finds the same node there. The thaw replays these to
  // bring the live app to the frame the preview was on.
  const actions = [];
  const pathOf = (el) => {
    const path = [];
    for (let x = el; x && x !== document.body; x = x.parentElement) path.unshift([...x.parentElement.children].indexOf(x));
    return path;
  };
  // A signature too, in case a portal that only appeared here (a tooltip on hover) shifted the path.
  const sigOf = (el) => ({
    tag: el.localName,
    testid: el.getAttribute('data-testid') ?? undefined,
    role: el.getAttribute('role') ?? undefined,
    label: el.getAttribute('aria-label') ?? undefined,
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
  });
  on('click', (e) => {
    if (!(e.target instanceof Element) || !document.body.contains(e.target)) return;
    // The element that handles the click, not the icon inside it.
    const el = e.target.closest('button, a, [role], input, label, summary') ?? e.target;
    actions.push({ t: T(), path: pathOf(el), sig: sigOf(el) });
  });
  on('pointerup', () => emit(['d', T(), 0]));
  on('focusin', (e) => emit(['f', T(), idOf(e.target), e.target.matches(':focus-visible') ? 1 : 0]));
  on('focusout', (e) => {
    if (!e.relatedTarget) emit(['f', T(), 0, 0]);
  });

  // ---- Checkpoints and the end
  const checkpoints = [];
  window.__tapeCheckpoint = (name, keys, base) => {
    flush();
    const storage = {};
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v !== null) storage[k] = v;
    }
    let route = location.pathname.startsWith(base) ? '/' + location.pathname.slice(base.length) : location.pathname;
    route += location.search;
    checkpoints.push({ name, t: T(), clock: Date.now(), route, storage });
  };

  window.__tapeStop = () => {
    flush();
    observer.disconnect();
    const duration = T();
    // The app's stylesheets, with the pseudo-classes a replay can't trigger mapped to attributes.
    const pseudo = /(?<!\\):(hover|focus-visible|focus-within|focus|active)\b/g;
    const rewrite = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText && pseudo.test(rule.selectorText)) {
          pseudo.lastIndex = 0;
          const next = rule.selectorText.replace(pseudo, (_, p) => `[data-tape-${p}]`);
          try {
            rule.selectorText = next;
          } catch {}
        }
        pseudo.lastIndex = 0;
        if (rule.cssRules) rewrite(rule.cssRules);
      }
    };
    let css = '';
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.tagName !== 'LINK') continue; // inline <style> nodes are in the DOM
      rewrite(sheet.cssRules);
      css += Array.from(sheet.cssRules, (r) => r.cssText).join('\n') + '\n';
    }
    return { snapshot, events, checkpoints, actions, clock0, css, duration };
  };
})();
