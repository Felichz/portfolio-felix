// The projects carousel: to the next product and back, as a hand does it. The pointer onto the product's
// item in the rail (which prepares its slide, see preraster in Work.astro), a moment there, then a real
// click: a click made from script skips that, and measures a change no pointer makes.
import { arrive, hand, sleep } from './_hand.mjs';

const go = async (page, d) => {
  const target = await page.evaluate((d) => {
    const go = [...document.querySelectorAll('[data-go]')];
    const i = go.findIndex((b) => b.getAttribute('aria-current') === 'true' || b.closest('[aria-current="true"]'));
    return (i + d + go.length) % go.length;
  }, d);
  const aim = () =>
    page.evaluate((k) => {
      const el = document.querySelectorAll('[data-go]')[k];
      const r = el.getBoundingClientRect();
      const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { ...at, on: document.elementFromPoint(at.x, at.y)?.closest('[data-go]') === el };
    }, target);
  let at = await aim();
  await page.mouse.move(at.x, at.y, { steps: 6 });
  await sleep(300);
  for (let i = 0; i < 10 && !(at = await aim()).on; i++) await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
};

export default {
  name: 'carousel',
  setup: async ({ page, url, state }) => {
    await arrive(page, url);
    state.h = hand(page);
    await page.mouse.move(1530, 770, { steps: 3 });
    state.from = await state.h.activeHref();
  },
  steps: [
    {
      name: 'next',
      act: ({ page }) => go(page, 1),
      done: async ({ state }) => ((await state.h.activeHref()) !== state.from ? true : 'the showcase stayed on the same product'),
    },
    {
      name: 'back',
      act: ({ page }) => go(page, -1),
      done: async ({ state }) => ((await state.h.activeHref()) === state.from ? true : 'the showcase did not come back'),
    },
  ],
};
