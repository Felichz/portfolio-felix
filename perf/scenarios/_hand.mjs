// The hand on the showcase, shared by the scenarios (a file starting with _ isn't a scenario). Ported from
// scripts/perf/kit.mjs: go live, aim at the lights through the plate's tilt, read what is on screen.
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The product the showcase scenarios run on (ID=playsync to change it), as scripts/perf does. */
export const ID = process.env.ID ?? 'knowgraph';

export function hand(page) {
  const plateBox = () =>
    page.evaluate(() => {
      const r = document.querySelector('.slide[data-state="active"] .plate')?.getBoundingClientRect();
      return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  const isLive = () => page.evaluate(() => !!document.querySelector('.slide[data-state="active"] .plate')?.hasAttribute('data-live'));
  const wiggle = async (at, ms) => {
    const end = Date.now() + ms;
    let a = 0;
    while (Date.now() < end) {
      a += 0.4;
      await page.mouse.move(at.x + Math.cos(a) * 30, at.y + Math.sin(a) * 30);
      await sleep(16);
    }
  };
  const goLive = async () => {
    const at = await plateBox();
    await page.mouse.move(at.x, at.y, { steps: 6 });
    for (let i = 0; i < 80 && !(await isLive()); i++) await wiggle(at, 80);
  };
  // The lights show on the pointer's side and the plate tilts toward it, so the button moves as the
  // pointer comes: aim again until the pointer is on it.
  const clickZoom = async () => {
    const zoom = () =>
      page.evaluate(() => {
        const pair = document.querySelector('.slide[data-state="active"] .plate .lights-pair');
        const r = pair?.querySelector(`.lights--${pair.dataset.side === 'right' ? 'right' : 'left'} .light--zoom`)?.getBoundingClientRect();
        return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    const on = (at) => page.evaluate((z) => !!document.elementFromPoint(z.x, z.y)?.closest('.light--zoom'), at);
    let at = await zoom();
    await page.mouse.move(at.x, at.y, { steps: 8 });
    for (let i = 0; i < 20 && !(await on(at)); i++) {
      await sleep(30);
      at = await zoom();
      await page.mouse.move(at.x, at.y);
    }
    await page.mouse.click(at.x, at.y);
  };
  return {
    isLive,
    goLive,
    clickZoom,
    activeHref: () => page.evaluate(() => document.querySelector('.slide[data-state="active"] .slide-media')?.getAttribute('href') ?? ''),
    windowOpen: () => page.evaluate(() => !!document.querySelector('.thaw.landed')),
    theme: () => page.evaluate(() => document.documentElement.dataset.theme),
    deckTop: () => page.evaluate(() => document.querySelector('[data-deck]').scrollTop),
  };
}

/** A fresh page on the showcase at a product, its auto-advance off (which product is on screen would
    otherwise depend on how long each step took), the pointer off the plate, settled. */
export async function arrive(page, url, id = ID) {
  await page.goto(`${url.replace(/\/$/, '')}/#work/${id}`, { waitUntil: 'load' });
  await page.evaluate(() => {
    const auto = document.querySelector('[data-auto]');
    if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
  });
  await page.mouse.move(40, 900);
  await sleep(3000);
}
