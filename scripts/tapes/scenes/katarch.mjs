// KatArch, chapter 5 (Domain): from step 3 the scene steps forward twice with the player's Next
// button, to the Menu Catalog service diagram of step 5 (the case study's screenshot).
export default {
  base: '/apps/katarch/',
  start: 'domain/#step-3',
  viewport: [1440, 900],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: '#step-title',
  storage: ['katarch:theme', 'katarch:lang', 'katarch:v2:progress'],
  themeKey: 'katarch:theme',

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('katarch:theme', 'light');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#step-title');
    // Let the stage's entrance animations settle.
    await new Promise((r) => setTimeout(r, 1500));
  },

  async run(s) {
    await s.checkpoint('step-3');
    await s.wait(1300);
    await s.click('.bottombar .btn--primary', { rest: 240 });
    await s.wait(2600);
    await s.checkpoint('step-4');
    await s.click('.bottombar .btn--primary', { rest: 200 });
    await s.wait(3200);
    await s.checkpoint('step-5');
    await s.moveTo(1180, 560, 1000);
    await s.wait(900);
  },
};
