// A project's live app: open it in a window (the zoom button over its preview), then close it with
// Escape. The window is what a visitor sees when they use a project, so it is measured as they meet it.
const toWork = async ({ page, url }) => {
  await page.goto(`${url}#work`, { waitUntil: 'load' });
  await page.waitForSelector('#work-show .plate[data-app]');
  await page.evaluate(() => {
    const auto = document.querySelector('[data-auto]');
    if (auto?.getAttribute('aria-pressed') === 'true') auto.click();
  });
};

export default {
  name: 'window',
  setup: toWork,
  steps: [
    {
      name: 'open',
      // The zoom button on the product on show is the window's (the plate itself only goes live). A real
      // mouse click, not a script's click: that is what a visitor does.
      act: async ({ page }) => {
        const box = await page.evaluate(() => {
          const b = [...document.querySelectorAll('#work-show [data-light="zoom"]')].find((x) => getComputedStyle(x).visibility === 'visible');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (!box) throw new Error('no visible zoom button on the product on show');
        await page.mouse.click(box.x, box.y);
      },
      done: ({ page }) => page.evaluate(() => !!document.querySelector('.thaw.landed')),
      doneTimeout: 20000,
    },
    {
      name: 'close',
      act: ({ page }) => page.keyboard.press('Escape'),
      done: ({ page }) => page.evaluate(() => !document.querySelector('.thaw')),
    },
  ],
};
