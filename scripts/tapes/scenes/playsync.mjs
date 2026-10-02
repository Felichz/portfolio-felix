// A PlaySync room on Felix's side: Big Buck Bunny playing for him and Sofi, the chat open. Sofi says
// they're in sync, Felix answers, and her popcorn floats over the video.
//
// Recorded against the real server, its clock pinned like the page's (in rave2:
// PIN=15:24 PORT=3099 npx tsx --import ../portfolio/scripts/tapes/pin-clock.mjs server/index.ts). Sofi is a bare
// WebSocket client: one YouTube player decodes smoothly in headless Chrome, two don't. The YouTube
// frame is filmed as a clip (scene.clip); the socket's messages come with the tape for the live app's
// stand-in room (scripts/apps/playsync-room.js).
import { createRequire } from 'node:module';

const WebSocket = createRequire(new URL('../../../../rave2/package.json', import.meta.url))('ws');
const SERVER = 'ws://localhost:3099/ws';
const VIDEO = 'YE7VzlLtp-4'; // Big Buck Bunny
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sofi;

async function client(code, name) {
  const ws = new WebSocket(SERVER);
  await new Promise((ok, no) => (ws.once('open', ok), ws.once('error', no)));
  ws.send(JSON.stringify({ type: 'join', room: code, name }));
  await sleep(500);
  return { say: (text) => ws.send(JSON.stringify({ type: 'chat', text })), close: () => ws.close() };
}
const clickText = (page, re) =>
  page.evaluate((src) => {
    const r = new RegExp(src, 'i');
    const el = [...document.querySelectorAll('button, a, [role=tab]')].find((e) => e.offsetParent !== null && r.test(((e.getAttribute('aria-label') || '') + ' ' + e.textContent).trim()));
    el?.click();
    return !!el;
  }, re.source);

export default {
  base: '/apps/playsync/',
  spa: true,
  viewport: [1440, 900],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: '.composer input',
  storage: ['playsync:theme', 'playsync.lang', 'playsync.name', 'playsync.lastRoom', 'playsync.client'],
  themeKey: 'playsync:theme',
  socket: { url: SERVER },
  clip: true,

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('playsync:theme', 'light');
      localStorage.setItem('playsync.lang', 'en');
      localStorage.setItem('playsync.name', 'Felix');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1200);
    await clickText(page, /Create a room/);
    await page.waitForFunction(() => location.hash.startsWith('#/r/'), { timeout: 30000 });
    const code = await page.evaluate(() => location.hash.split('#/r/')[1]);
    await sleep(1500);
    await clickText(page, /^Queue/);
    await sleep(500);
    const add = await page.$('.add-field input');
    await add.type(`https://www.youtube.com/watch?v=${VIDEO}`);
    await clickText(page, /^Add$/);
    await sleep(2500);
    sofi = await client(code, 'Sofi');
    await sleep(1500);
    await clickText(page, /^Play$/);
    await page.evaluate(() => document.querySelector('.player-overlay')?.click());
    await sleep(1500);
    await clickText(page, /^Chat/);
    await sleep(800);
    sofi.say('hiii, loading on my side');
    await sleep(1100);
    await page.type('.composer input', 'starting it now, we are synced');
    await page.keyboard.press('Enter');
    // Until the video plays steadily.
    const yt = () => page.frames().find((f) => f.url().includes('youtube'));
    const probe = () => yt()?.evaluate(() => { const v = document.querySelector('video'); return v ? [v.currentTime, v.readyState] : null; }).catch(() => null);
    for (let i = 0; i < 30; i++) {
      const a = await probe();
      await sleep(2000);
      const z = await probe();
      if (a && z && z[0] > 8 && z[0] - a[0] > 1.6 && z[1] >= 3) break;
    }
    await page.mouse.move(1200, 520);
  },

  async run(s) {
    await s.checkpoint('start');
    // The chat tab (which tab is open isn't kept anywhere: this click brings the live app to it).
    await s.clickText(/^Chat/, { rest: 160 });
    await s.wait(500);
    sofi.say('yes! same second');
    await s.wait(1400);
    await s.click('.composer input', { rest: 200 });
    await s.wait(300);
    await s.page.keyboard.type('pause at 2:10 if you need snacks', { delay: 55 });
    await s.page.keyboard.press('Enter');
    await s.wait(600);
    await s.moveTo(1180, 560, 700);
    await s.wait(500);
    sofi.say('🍿🙌');
    await s.wait(3400);
    await s.checkpoint('end');
  },

  // After the tape has stopped, so her leaving isn't on it.
  teardown() {
    sofi?.close();
  },
};
