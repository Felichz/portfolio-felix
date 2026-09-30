/**
 * The cursor light. A soft light follows the pointer across the page background and brings up the
 * dot grid under it: nearby dots grow, brighten in the room's glow color, and bulge away from the
 * pointer as if under a lens.
 *
 * Cheap by construction: one canvas behind everything, only the dots within reach are drawn, and the
 * loop runs only while the light is moving or fading, then stops. Off on touch screens and under
 * reduced motion.
 */
export function initField() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  // Must match .ambient-dots in global.css: 22px tiles, dot centered in each.
  const STEP = 22;
  const OFFSET = 11;
  const REACH = 170; // dots within this distance react
  const LIGHT = 340; // radius of the soft light

  let dpr = 1;
  let w = 0;
  let h = 0;
  let color = '#13a07c';
  let dark = false;
  // Where the pointer is, where the light is (eased toward it), and how visible it is.
  const target = { x: -1e4, y: -1e4 };
  const pos = { x: -1e4, y: -1e4 };
  let on = 0;
  let want = 0;
  let raf = 0;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  };

  const readColor = () => {
    color = getComputedStyle(root).getPropertyValue('--glow').trim() || color;
    dark = root.dataset.theme === 'dark';
    kick();
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    if (on < 0.01) return;

    // The light itself: a wide, faint pool of the room color.
    const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, LIGHT);
    ctx.globalAlpha = on * (dark ? 0.16 : 0.2);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(pos.x - LIGHT, pos.y - LIGHT, LIGHT * 2, LIGHT * 2);

    // The dots it reaches.
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
        const push = (kk * 7) / (d || 1);
        ctx.globalAlpha = on * (0.12 + 0.75 * kk);
        ctx.beginPath();
        ctx.arc(cx + dx * push, cy + dy * push, 0.9 + 1.7 * kk, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const tick = () => {
    pos.x += (target.x - pos.x) * 0.16;
    pos.y += (target.y - pos.y) * 0.16;
    on += (want - on) * 0.12;
    draw();
    const moving = Math.abs(target.x - pos.x) > 0.3 || Math.abs(target.y - pos.y) > 0.3 || Math.abs(want - on) > 0.01;
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
