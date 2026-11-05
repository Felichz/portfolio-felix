// The page's scroll: the deck moves a panel down with the keyboard, then back up. Replaces the built-in
// scroll, since the page scrolls inside [data-deck], one panel at a time.
import { hand, sleep } from './_hand.mjs';

export default {
  name: 'scroll',
  setup: async ({ page, url, state }) => {
    await page.goto(url, { waitUntil: 'load' });
    await sleep(2000);
    // The keys go to the page, not to an app that has focus.
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(80, 500);
    state.h = hand(page);
    state.top = await state.h.deckTop();
  },
  steps: [
    {
      name: 'down',
      act: ({ page }) => page.keyboard.press('ArrowDown'),
      done: async ({ state }) => ((await state.h.deckTop()) > state.top ? true : 'the deck did not move down'),
    },
    {
      name: 'up',
      act: ({ page }) => page.keyboard.press('ArrowUp'),
      done: async ({ state }) => (Math.abs((await state.h.deckTop()) - state.top) < 2 ? true : 'the deck did not come back'),
    },
  ],
};
