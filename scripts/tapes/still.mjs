// A product's still, from its tape: the last frame, at 2x, in both editions, into
// src/assets/shots/<shot>-main-<edition>.webp. A plate shows the still before and after its recording,
// so the hand-off from one to the other only holds if the still is the recording's last frame.
//
// Usage: BASE=http://127.0.0.1:4391 node scripts/tapes/still.mjs <tape id> [shot name]   (a server of
//   a build; the tape is read from it). OUT=<dir> writes elsewhere.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { chromePath, windowPosition } from '../perf/chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [id, name = id] = process.argv.slice(2);
if (!id) throw new Error('Usage: BASE=<server of dist/> node scripts/tapes/still.mjs <tape id> [shot name]');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4391';
const OUT = process.env.OUT ?? resolve(root, 'src/assets/shots');

const tape = await (await fetch(`${BASE}/tapes/${id}.json`)).json();
const [w, h] = tape.viewport;
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  userDataDir: mkdtempSync(join(tmpdir(), 'still-')),
  args: [`--window-position=${windowPosition()}`, '--hide-scrollbars'],
  defaultViewport: null,
});
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.goto(`${BASE}/stage/#${id}`, { waitUntil: 'load' });
    await page.evaluate(async (theme) => {
      const core = document.querySelector('tape-core');
      core.theme = theme;
      await core.ready();
      core.currentTime = core.duration;
      // The recording's drawn cursor isn't part of the product.
      core.querySelector('.tape-cursor-layer')?.remove();
      // A filmed clip (PlaySync's player) seeks only once it has loaded: wait for it, then seek again.
      const doc = core.frame.contentDocument;
      const until = performance.now() + 8000;
      while ([...doc.querySelectorAll('video')].some((v) => v.readyState < 2) && performance.now() < until) await new Promise((r) => setTimeout(r, 100));
      core.currentTime = 0;
      core.currentTime = core.duration;
      // Transitions the last changes started, finished; endless ones (a pulse) as they stand.
      await new Promise((r) => setTimeout(r, 1200));
      for (const a of core.frame.contentDocument.getAnimations())
        try {
          a.finish();
        } catch {}
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, theme);
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
    const out = join(OUT, `${name}-main-${theme}.webp`);
    await sharp(png).webp({ quality: 92 }).toFile(out);
    console.log(`${out}: ${w * 2}x${h * 2}`);
    await page.close();
  }
} finally {
  await browser.close();
}
