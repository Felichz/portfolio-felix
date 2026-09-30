/**
 * The cursor light. A soft light follows the pointer across the page background and brings up the
 * dot grid under it: nearby dots grow, brighten in the room's glow color, and bulge away from the
 * pointer as if under a lens.
 *
 * Near text, the dots step back: they fade and stop bulging, so they never compete with reading.
 *
 * Cheap by construction:
 * - The light is a CSS gradient and the dots a small canvas around the pointer, both moved with
 *   transforms. A frame redraws only that area; the full-window canvas this replaced made the
 *   whole screen recomposite on every frame.
 * - Hit-testing for text runs a few times a second, not every frame.
 * - The loop runs only while the light is moving or fading, then stops. Off on touch screens and
 *   under reduced motion.
 */
export function initField() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
  const light = document.querySelector<HTMLElement>('[data-light]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !light || !ctx) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  // Must match .ambient-dots in global.css: 22px tiles, dot centered in each.
  const STEP = 22;
  const OFFSET = 11;
  const REACH = 170; // dots within this distance react
  const HALF = REACH + 16; // the canvas covers the reach plus the lens push and dot radius
  const SIZE = HALF * 2;
  const SAMPLE_MS = 90; // how often to check for text near the pointer

  let dpr = 1;
  let color = '#13a07c';
  let dark = false;
  // Where the pointer is, where the light is (eased toward it), and how visible it is.
  const target = { x: -1e4, y: -1e4 };
  const pos = { x: -1e4, y: -1e4 };
  let on = 0;
  let want = 0;
  // 1 when the pointer is on or near text: the dots fade out of the way.
  let quiet = 0;
  let wantQuiet = 0;
  let sample = false;
  let sampledAt = 0;
  let raf = 0;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);
    canvas.style.width = canvas.style.height = `${SIZE}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  };

  const readColor = () => {
    color = getComputedStyle(root).getPropertyValue('--glow').trim() || color;
    dark = root.dataset.theme === 'dark';
    kick();
  };

  // Text under the pointer or within reach of it, sampled at the pointer and around it.
  const TEXT = 'p, h1, h2, h3, h4, li, dt, dd, figcaption, blockquote, label, time, a, button, summary, .chip';
  const NEAR = 44;
  const around = [
    [0, 0],
    [NEAR, 0],
    [-NEAR, 0],
    [0, NEAR],
    [0, -NEAR],
  ];
  const nearText = (x: number, y: number) =>
    around.some(([dx, dy]) => {
      const el = document.elementFromPoint(x + dx!, y + dy!);
      return !!el && el !== canvas && !!el.closest(TEXT);
    });

  // Style writes only when a value changes: each one costs the page a style and layer update.
  const last = new Map<HTMLElement, Record<string, string>>();
  const set = (el: HTMLElement, prop: 'opacity' | 'translate', value: string) => {
    const seen = last.get(el) ?? {};
    if (seen[prop] === value) return;
    seen[prop] = value;
    last.set(el, seen);
    el.style[prop] = value;
  };

  const draw = () => {
    // The light itself: a wide, faint pool of the room color.
    set(light, 'opacity', (on * (dark ? 0.16 : 0.2) * (1 - 0.35 * quiet)).toFixed(3));
    set(light, 'translate', `${Math.round(pos.x)}px ${Math.round(pos.y)}px`);
    set(canvas, 'opacity', on < 0.01 ? '0' : '1');
    if (on < 0.01) return;

    // The dots it reaches, drawn into a canvas that sits on whole pixels around the pointer.
    const origin = { x: Math.round(pos.x) - HALF, y: Math.round(pos.y) - HALF };
    set(canvas, 'translate', `${origin.x}px ${origin.y}px`);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = color;
    const x0 = Math.floor((pos.x - REACH - OFFSET) / STEP);
    const x1 = Math.ceil((pos.x + REACH - OFFSET) / STEP);
    const y0 = Math.floor((pos.y - REACH - OFFSET) / STEP);
    const y1 = Math.ceil((pos.y + REACH - OFFSET) / STEP);
    for (let i = x0; i <= x1; i++) {
      for (let j = y0; j <= y1; j++) {
        const cx = OFFSET + i * STEP;
        const cy = OFFSET + j * STEP;
        const dx = cx - pos.x;
        const dy = cy - pos.y;
        const d = Math.hypot(dx, dy);
        if (d > REACH) continue;
        const k = 1 - d / REACH;
        const kk = k * k;
        // Lens: dots near the pointer are pushed outward a few pixels.
        const push = (kk * 7 * (1 - quiet)) / (d || 1);
        ctx.globalAlpha = on * (0.12 + 0.75 * kk) * (1 - 0.85 * quiet);
        ctx.beginPath();
        ctx.arc(cx + dx * push - origin.x, cy + dy * push - origin.y, 0.9 + 1.7 * kk, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const tick = (now: number) => {
    if (sample && now - sampledAt >= SAMPLE_MS) {
      sample = false;
      sampledAt = now;
      wantQuiet = nearText(target.x, target.y) ? 1 : 0;
    }
    pos.x += (target.x - pos.x) * 0.16;
    pos.y += (target.y - pos.y) * 0.16;
    on += (want - on) * 0.12;
    quiet += (wantQuiet - quiet) * 0.14;
    draw();
    const moving =
      sample ||
      Math.abs(target.x - pos.x) > 0.3 ||
      Math.abs(target.y - pos.y) > 0.3 ||
      Math.abs(want - on) > 0.01 ||
      Math.abs(wantQuiet - quiet) > 0.01;
    raf = moving ? requestAnimationFrame(tick) : 0;
  };
  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches || reduce.matches) return;
      // First move: start the light where the pointer is, instead of sliding in from a corner.
      if (want === 0 && on < 0.01) {
        pos.x = e.clientX;
        pos.y = e.clientY;
      }
      target.x = e.clientX;
      target.y = e.clientY;
      sample = true;
      want = 1;
      kick();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    want = 0;
    kick();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      want = 0;
      on = 0;
      draw();
    }
  });

  addEventListener('resize', resize, { passive: true });
  document.addEventListener('deck:refresh', readColor);
  document.addEventListener('deck:change', () => setTimeout(readColor, 0));
  new MutationObserver(readColor).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  resize();
  readColor();
}
