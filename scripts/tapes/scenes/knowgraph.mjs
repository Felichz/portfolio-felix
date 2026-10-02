// KnowGraph's map of React concepts, with a study history restored from the app's own fixture (the
// same backup the README screenshots use): the scene picks two focus areas in the sidebar, then All.
// The history lives in IndexedDB, so checkpoints keep it (scene.idb) and the live app boots with it.
const FIXTURE = new URL('../../../../learning-embed/tests/fixtures/hydrated-state.json', import.meta.url);

const clickText = (page, re) =>
  page.evaluate((src) => {
    const r = new RegExp(src, 'i');
    const el = [...document.querySelectorAll('button, a, [role=tab]')].find((e) => e.offsetParent !== null && r.test(((e.getAttribute('aria-label') || '') + ' ' + e.textContent).trim()));
    el?.click();
    return !!el;
  }, re.source);

export default {
  base: '/apps/knowgraph/',
  start: 'react',
  spa: true,
  viewport: [1440, 900],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: 'main',
  storage: ['knowgraph:theme', 'learning-workspace:locale', 'learning-workspace:ui-prefs:v3'],
  themeKey: 'knowgraph:theme',
  idb: true,

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('knowgraph:theme', 'light');
      localStorage.setItem('learning-workspace:locale', 'en');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    // Restore the study history from the fixture, the way a user restores a backup.
    await clickText(page, /AI connections/);
    await new Promise((r) => setTimeout(r, 1200));
    const input = await page.$('input[type=file]');
    await input.uploadFile(decodeURIComponent(FIXTURE.pathname.replace(/^\/([A-Z]:)/, '$1')));
    await new Promise((r) => setTimeout(r, 1200));
    await clickText(page, /^Restore$/);
    await new Promise((r) => setTimeout(r, 1500));
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    await clickText(page, /^List$/);
    await new Promise((r) => setTimeout(r, 1000));
    console.log('storage keys', await page.evaluate(() => Object.keys(localStorage)));
  },

  async run(s) {
    await s.checkpoint('start');
    await s.wait(1000);
    await s.clickText(/^State & data/);
    await s.wait(1700);
    await s.clickText(/^Effects & async/, { rest: 140 });
    await s.wait(1700);
    await s.clickText(/^All\s*\d/, { rest: 160 });
    await s.wait(700);
    await s.moveTo(1180, 860, 900);
    await s.wait(1300);
  },
};
