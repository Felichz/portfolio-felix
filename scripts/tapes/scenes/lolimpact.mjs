// LoLImpact, one of LP Felix's games (minute 12: 64%, the case study's screenshot). The scene steps
// through the minutes with the readout's own buttons, back and forth.
//
// Its API answers are recorded against a local backend (LoLImpact/backend: uvicorn app.main:app
// --port 8010) and served to the live app from the tape, with every game on the profile fetched once
// so the visitor can open any of them.
const BACKEND = 'http://127.0.0.1:8010';
const PROFILE = '/api/profile?riot_id=' + encodeURIComponent('LP Felix#LAS') + '&region=LAS';

export default {
  base: '/apps/lolimpact/',
  start: '?rid=LP%20Felix%23LAS&region=LAS#/partidas/LA2_1626772172',
  spa: true,
  viewport: [1440, 900],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: 'article.detail',
  storage: ['lolimpact.theme', 'lolimpact.lang', 'lolimpact.riotId', 'lolimpact.region'],
  themeKey: 'lolimpact.theme',
  network: {
    match: /\/api\//,
    rewrite: (u) => (/^http:\/\/localhost:\d+\/api\//.test(u) ? u.replace(/^http:\/\/localhost:\d+/, BACKEND) : null),
  },

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('lolimpact.theme', 'light');
      localStorage.setItem('lolimpact.lang', 'en');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('article.detail', { timeout: 60000 });
    // Every game on the profile, so any of them opens in the live app.
    await page.evaluate(async (profile) => {
      const p = await (await fetch(profile)).json();
      for (const m of p.matches) await fetch(`/api/match/LAS/${m.match_id}`);
    }, PROFILE);
    await new Promise((r) => setTimeout(r, 1200));
  },

  async run(s) {
    await s.checkpoint('start');
    await s.wait(900);
    const steps = ['Previous', 'Previous', 'Next', 'Next', 'Next', 'Next', 'Next', 'Previous', 'Previous', 'Previous'];
    for (const [i, dir] of steps.entries()) {
      await s.clickText(new RegExp(`^${dir} min$`), { rest: i && steps[i - 1] === dir ? 60 : 200 });
      await s.wait(760);
    }
    await s.moveTo(1150, 640, 900);
    await s.wait(1000);
  },
};
