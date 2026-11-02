/**
 * A phone app's lead shot as a phone in real 3D (phone-model.ts), over the CSS phone that Plate.astro
 * draws. The CSS phone is what shows first and what stays if WebGL or the module never arrive; the 3D
 * one fades in over it once its first frame is drawn. three.js is fetched only when such a plate
 * nears the viewport.
 *
 * Inside a `[data-phone-stage]` it leans toward the pointer and eases back when the pointer leaves.
 * It draws only while it moves: a resting phone costs nothing.
 */
import type { PhoneModel } from './phone-model';

// The canvas overflows the plate so a leaning phone isn't cut off; see .phone3d in global.css.
const OVER_Y = 0.12; // the share of its height it takes above and below
const MAX_Y = 16;
const MAX_X = 9;

export function initPhones() {
  const plates = document.querySelectorAll<HTMLElement>('[data-phone3d]');
  if (!plates.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        mount(e.target as HTMLElement).catch(() => e.target.querySelector('.phone3d')?.remove());
      }
    },
    { rootMargin: '50%' },
  );
  plates.forEach((p) => io.observe(p));
}

async function mount(plate: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'phone3d';
  canvas.setAttribute('aria-hidden', 'true');
  plate.prepend(canvas);
  const { createPhone } = await import('./phone-model');
  const model: PhoneModel = createPhone(canvas, 1 / (1 + OVER_Y * 2));

  const root = document.documentElement;
  const rad = Math.PI / 180;
  const now = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let raf = 0;
  let sized = false;

  const draw = () => sized && model.render(now.x, now.y);
  const frame = () => {
    now.x += (target.x - now.x) * 0.1;
    now.y += (target.y - now.y) * 0.1;
    draw();
    const moving = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 1e-4;
    raf = moving ? requestAnimationFrame(frame) : 0;
  };
  const wake = () => (raf ||= requestAnimationFrame(frame));

  const screen = async () => {
    const dark = root.dataset.theme === 'dark';
    const img = new Image();
    img.src = (dark ? plate.dataset.screenDark : plate.dataset.screenLight)!;
    await img.decode();
    // The theme may have changed again while it loaded.
    if ((root.dataset.theme === 'dark') !== dark) return;
    model.setScreen(img, dark);
    draw();
  };

  new ResizeObserver(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    sized = w > 0 && h > 0;
    if (!sized) return;
    model.resize(w, h);
    draw();
  }).observe(canvas);

  await screen();
  // Shown once there is something to show: the CSS phone fades out under it.
  requestAnimationFrame(() => plate.setAttribute('data-3d', ''));
  new MutationObserver(() => screen().catch(() => {})).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  const stage = plate.closest<HTMLElement>('[data-phone-stage]');
  if (!stage) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  stage.addEventListener('pointermove', (e) => {
    if (!fine.matches || reduce.matches) return;
    const r = stage.getBoundingClientRect();
    // It turns to face the pointer: right turns its face right, below tips it down.
    target.y = ((e.clientX - r.left) / r.width - 0.5) * 2 * MAX_Y * rad;
    target.x = ((e.clientY - r.top) / r.height - 0.5) * 2 * MAX_X * rad;
    wake();
  });
  stage.addEventListener('pointerleave', () => {
    target.x = 0;
    target.y = 0;
    wake();
  });
}
