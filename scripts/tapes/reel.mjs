// Films a tape: plays it frame by frame in a stage of the built site and encodes each edition (light,
// dark) as a video, public/tapes/<id>.<theme>.mp4. A reel is the same recording as its tape, on the
// same timeline: a checkpoint's t is the video's currentTime, so the live app boots from it as before.
//
// Deterministic, not a screen capture: every frame seeks the tape to its time, and the CSS
// transitions and animations the app's stylesheet started are paused and set to their age at that time.
//
// Usage: BASE=http://127.0.0.1:4391 node scripts/tapes/reel.mjs <id>   (a server of a build: dist/)
//   FPS (60), CRF (27): a keyframe every two seconds, THEMES (light,dark)
import { spawn } from 'node:child_process';
import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromePath, windowPosition } from '../perf/chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const id = process.argv[2];
if (!id) throw new Error('Usage: BASE=<server of dist/> node scripts/tapes/reel.mjs <id>');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4391';
const FPS = Number(process.env.FPS ?? 60);
const CRF = String(process.env.CRF ?? 27);
const THEMES = (process.env.THEMES ?? 'light,dark').split(',');

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS,
  userDataDir: mkdtempSync(join(tmpdir(), 'reel-')),
  args: [`--window-position=${windowPosition()}`, '--hide-scrollbars', '--force-device-scale-factor=1'],
  defaultViewport: null,
});

try {
  for (const theme of THEMES) {
    const page = await browser.newPage();
    const tape = await (await fetch(`${BASE}/tapes/${id}.json`)).json();
    const [w, h] = tape.viewport;
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/stage/#${id}`, { waitUntil: 'load' });
    // The stage's tape, built in this edition, its fonts loaded.
    await page.evaluate(async (theme) => {
      const core = document.querySelector('tape-core');
      core.theme = theme;
      await core.ready();
      core.currentTime = 0;
      // The film's own clock: every animation in the frame is held, and set to its age at each frame.
      window.__born = new Map();
      window.__film = (t) => {
        core.currentTime = t / 1000;
        const doc = core.frame.contentDocument;
        for (const a of doc.getAnimations()) {
          // The core's own animations (recorded Web Animations) already follow its time.
          if (a.constructor.name !== 'CSSTransition' && a.constructor.name !== 'CSSAnimation') continue;
          if (!window.__born.has(a)) window.__born.set(a, t);
          a.pause();
          a.currentTime = t - window.__born.get(a);
        }
        return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      };
    }, theme);

    const out = resolve(root, 'public', 'tapes', `${id}.${theme}.mp4`);
    const ff = spawn(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
        '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), '-movflags', '+faststart',
        out,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const closed = new Promise((r, no) => ff.on('close', (c) => (c ? no(new Error(`ffmpeg exited ${c}`)) : r())));

    const frames = Math.ceil((tape.duration / 1000) * FPS) + 1;
    for (let i = 0; i < frames; i++) {
      const t = Math.min(tape.duration, (i * 1000) / FPS);
      await page.evaluate((t) => window.__film(t), t);
      const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % FPS === 0) process.stdout.write(`\r${theme} ${i}/${frames}`);
    }
    ff.stdin.end();
    await closed;
    console.log(`\r${theme}: ${frames} frames, ${(statSync(out).size / 1024).toFixed(0)} KB -> ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
}
