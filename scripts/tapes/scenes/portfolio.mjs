// This site's own Intro, recorded from the built site (dist/). The pointer sweeps the name, so its
// letters widen toward it, leans on "See the work" and the portrait, then rests. Only the Intro is
// kept: the other sections hold videos and tapes of their own.
export default {
  root: 'dist',
  base: '/',
  viewport: [1440, 900],
  clock: null,
  themeAttr: 'data-theme',
  readySelector: '#intro-name',
  storage: ['fa-theme'],
  themeKey: 'fa-theme',
  ignore: '#work, #experience, #about, .cursor-light',
  prefetch: false,

  async setup(page) {
    await page.evaluate(() => localStorage.setItem('fa-theme', 'light'));
    await page.reload({ waitUntil: 'networkidle0' });
    // Let the name and the reveals finish arriving.
    await new Promise((r) => setTimeout(r, 2600));
  },

  async run(s) {
    await s.checkpoint('start');
    await s.wait(500);
    // Across the name, slowly, like reading it.
    await s.moveTo(150, 175, 900);
    await s.moveTo(560, 160, 1500);
    await s.moveTo(780, 300, 900);
    await s.moveTo(300, 330, 1300);
    await s.wait(300);
    // Over to the work button, which leans toward the pointer.
    await s.point('.intro-actions .btn--solid');
    await s.wait(900);
    // The portrait tilts toward it.
    await s.moveTo(1010, 330, 900);
    await s.moveTo(1120, 520, 1000);
    await s.wait(700);
    await s.moveTo(1330, 820, 900);
    await s.wait(1200);
    await s.checkpoint('rest');
    await s.wait(400);
  },
};
