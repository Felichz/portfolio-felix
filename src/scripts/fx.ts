/**
 * Small pointer effects, all opt-in by attribute and all off under reduced motion or on touch:
 * - `.spot`: a soft light that follows the pointer across a card (--mx / --my).
 * - `[data-tilt]`: a gentle 3D tilt toward the pointer, with a sheen position (--sx / --sy).
 * - Buttons are magnetic: they lean a few pixels toward the pointer while it's over them.
 */
export function initFx() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!fine.matches) return;
      const spot = (e.target as HTMLElement).closest<HTMLElement>('.spot');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    },
    { passive: true },
  );

  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt) || 6;
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      if (!fine.matches || reduce.matches) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
        el.style.setProperty('--sx', `${x * 100}%`);
        el.style.setProperty('--sy', `${y * 100}%`);
        el.setAttribute('data-tilting', '');
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.removeAttribute('data-tilting');
    });
  });

  // Magnetic buttons, through the independent `translate` property so hover transforms still apply.
  document.querySelectorAll<HTMLElement>('.btn, .icon-btn').forEach((el) => {
    const pull = el.classList.contains('icon-btn') ? 0.25 : 0.12;
    const max = 3;
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches || reduce.matches) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(-max, Math.min(max, (e.clientX - (r.left + r.width / 2)) * pull));
      const y = Math.max(-max, Math.min(max, (e.clientY - (r.top + r.height / 2)) * pull * 1.4));
      el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => (el.style.translate = ''));
  });
}
