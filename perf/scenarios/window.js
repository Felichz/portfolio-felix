// The window over a preview: open it from the green light with the app live, then close it.
import { arrive, hand, sleep } from './_hand.mjs';

export default {
  name: 'window',
  setup: async ({ page, url, state }) => {
    await arrive(page, url);
    state.h = hand(page);
    await state.h.goLive();
    await sleep(300);
    if (!(await state.h.isLive())) throw new Error('the preview never went live');
  },
  steps: [
    {
      name: 'open',
      act: ({ state }) => state.h.clickZoom(),
      done: async ({ state }) => ((await state.h.windowOpen()) ? true : 'the window did not open'),
    },
    {
      name: 'close',
      // Escape on the page itself (live.ts listens there): pressed for real it goes to the app, which may
      // take it for a dialog of its own, and the step would measure something else.
      act: ({ page }) => page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))),
      done: async ({ state }) => ((await state.h.windowOpen()) ? 'the window is still open' : true),
    },
  ],
};
