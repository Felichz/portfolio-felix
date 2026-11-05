// The theme switch: the circle from the toggle, there and back.
import { arrive, hand } from './_hand.mjs';

const toggle = (page) => page.evaluate(() => document.querySelector('[data-theme-toggle]').click());

export default {
  name: 'theme',
  setup: async ({ page, url, state }) => {
    await arrive(page, url);
    state.h = hand(page);
    await page.mouse.move(1530, 770, { steps: 3 });
    state.from = await state.h.theme();
  },
  steps: [
    { name: 'switch', act: ({ page }) => toggle(page), done: async ({ state }) => ((await state.h.theme()) !== state.from ? true : 'the theme did not change') },
    { name: 'back', act: ({ page }) => toggle(page), done: async ({ state }) => ((await state.h.theme()) === state.from ? true : 'the theme did not come back') },
  ],
};
