// The projects themselves: a fresh page on a product (ID, knowgraph by default), the pointer on its
// preview until the app runs live in its stage.
import { arrive, hand } from './_hand.mjs';

export default {
  name: 'projects',
  setup: async ({ page, url, state }) => {
    await arrive(page, url);
    state.h = hand(page);
  },
  steps: [
    {
      name: 'live',
      act: ({ state }) => state.h.goLive(),
      done: async ({ state }) => ((await state.h.isLive()) ? true : 'the preview never went live'),
      settle: 2000,
    },
  ],
};
