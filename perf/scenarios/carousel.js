// The products carousel: change to the next product and back. Each step waits until the rail shows
// the chosen product as current, so a click that did nothing is reported, not timed.
const toWork = async ({ page, url }) => {
  await page.goto(`${url}#work`, { waitUntil: 'load' });
  await page.waitForSelector('[data-go]');
  // Pause the auto-advance: it would move the carousel on its own during a step.
  await page.evaluate(() => {
    const auto = document.querySelector('[data-auto]');
    if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
  });
};

const current = (index) => ({ page }) =>
  page.evaluate(
    (i) => document.querySelectorAll('[data-go]')[i]?.getAttribute('aria-current') === 'true',
    index,
  );

export default {
  name: 'carousel',
  setup: toWork,
  steps: [
    {
      name: 'next',
      act: ({ page }) => page.click('[data-go="1"]'),
      done: current(1),
    },
    {
      name: 'back',
      act: ({ page }) => page.click('[data-go="0"]'),
      done: current(0),
    },
  ],
};
