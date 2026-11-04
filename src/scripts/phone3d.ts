/**
 * A phone app's lead shot as a phone in real 3D (phone-model.ts), over the CSS phone that Plate.astro
 * draws. The CSS phone is what shows first and what stays if WebGL or the worker never arrive; the 3D
 * one takes over once its first frame is drawn. It is built and drawn in a worker (phone-worker.ts),
 * started when such a plate nears the viewport.
 *
 * Inside a `[data-phone-stage]` it leans toward the pointer and eases back when the pointer leaves.
 * It draws only while it moves: a resting phone costs nothing.
 */
import { drawScreen } from './phone-screen';
import type { PhoneMessage } from './phone-worker';

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
        mount(e.target as HTMLElement).catch(() => unmount(e.target as HTMLElement));
      }
    },
    { rootMargin: '50%' },
  );
  plates.forEach((p) => io.observe(p));
}

const unmount = (plate: HTMLElement) => {
  plate.removeAttribute('data-3d');
  plate.querySelector('.phone3d')?.remove();
};

async function mount(plate: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'phone3d';
  canvas.setAttribute('aria-hidden', 'true');
  // Before it joins the page: handing over a canvas that's in the document lays the page out.
  const offscreen = canvas.transferControlToOffscreen();
  plate.prepend(canvas);
  const worker = new Worker(new URL('./phone-worker.ts', import.meta.url), { type: 'module' });
  const post = (message: PhoneMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
  // Without WebGL in a worker, or if it never loads: the CSS phone stays.
  worker.onerror = () => {
    unmount(plate);
    worker.terminate();
  };
  // Shown once there is something to show: the CSS phone goes under it.
  worker.onmessage = () => plate.setAttribute('data-3d', '');
  post({ type: 'init', canvas: offscreen, fill: 1 / (1 + OVER_Y * 2), pixelRatio: devicePixelRatio }, [offscreen]);

  const root = document.documentElement;
  const rad = Math.PI / 180;
  const now = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let raf = 0;

  const frame = () => {
    now.x += (target.x - now.x) * 0.1;
    now.y += (target.y - now.y) * 0.1;
    post({ type: 'turn', x: now.x, y: now.y });
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
    const bitmap = drawScreen(img, dark);
    post({ type: 'screen', screen: bitmap }, [bitmap]);
  };

  new ResizeObserver(() => post({ type: 'size', width: canvas.clientWidth, height: canvas.clientHeight })).observe(canvas);

  await screen();
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
