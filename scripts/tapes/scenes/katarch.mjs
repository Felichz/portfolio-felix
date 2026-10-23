// KatArch, the video course: block 1 ("What Makes a Decision Architectural"), in English, at rest. The
// scene runs the cursor down the block's sections, opens the transcript, and comes back to the play
// button. The video isn't played: a recording can't hand a playing video over to the live app at the
// same frame, so the preview shows the page as you'd find it, and the window is where you watch.
export default {
  base: '/apps/katarch/',
  start: 'curso/decision/',
  viewport: [1152, 720],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: 'video',
  storage: ['katarch:theme', 'katarch:video:lang'],
  themeKey: 'katarch:theme',

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('katarch:theme', 'light');
      localStorage.setItem('katarch:video:lang', 'en');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('video');
    // Let the page's entrance settle.
    await new Promise((r) => setTimeout(r, 1500));
  },

  async run(s) {
    await s.checkpoint('start');
    await s.wait(900);
    // Down the sections, one by one.
    for (const i of [1, 2, 3]) {
      const box = await s.page.evaluate((i) => {
        const rows = [...document.querySelectorAll('button, a')].filter((e) => e.offsetParent && /^\d+:\d\d/.test(e.textContent.trim()));
        const r = rows[i]?.getBoundingClientRect();
        return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, i);
      if (box) await s.moveTo(box.x, box.y, 700);
      await s.wait(450);
    }
    await s.clickText(/^Transcript/, { rest: 220 });
    await s.wait(2200);
    const play = await s.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /Play the block|Reproducir el bloque/i.test(e.getAttribute('aria-label') ?? ''));
      const r = b?.getBoundingClientRect();
      return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (play) await s.moveTo(play.x, play.y, 1000);
    await s.wait(1400);
  },
};
