// Writes a tape that is only a video: KnowGraph's preview is its product video, since the app needs the
// visitor's own LLM and ships as a desktop download. The tape's document is one <video data-tape-clip>
// filling the viewport, which the tape player drives on its own clock (src/scripts/tape.ts), and the
// "live app" under it (scripts/apps/knowgraph-video/) plays the same file on the bridge's clock.
//
// Usage: node scripts/tapes/make-video-tape.mjs <id> <video.mp4>
//   Encodes public/tapes/<id>.clip.mp4 (30 fps, H.264) and writes public/tapes/<id>.json.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [id, source] = process.argv.slice(2);
if (!id || !source) throw new Error('Usage: node scripts/tapes/make-video-tape.mjs <id> <video.mp4>');

// The app clock at tape time 0; the video page derives its playhead from it, so they must match.
const CLOCK0 = 1793000000000;
const BG = '#07090D';

const clip = resolve(root, 'public/tapes', `${id}.clip.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', clip]);
const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip], { encoding: 'utf8' }));

const style = `position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:${BG}`;
const duration = Math.round(seconds * 1000);
// The app goes live on the clock of the last change the tape showed (src/scripts/session.ts); a video
// shows no DOM changes, so a hidden counter ticks every STEP ms and the page picks up within that.
const STEP = 200;
const ticks = [];
for (let t = STEP; t < duration; t += STEP) ticks.push(['t', t, 6, String(t / STEP)]);
const tape = {
  v: 1,
  id,
  viewport: [1152, 720],
  themeAttr: 'data-theme',
  app: { entry: `/apps/${id}/`, readySelector: 'video', storage: [], prefetch: [] },
  snapshot: [1, 'html', { lang: 'en', 'data-theme': 'dark' }, [
    [2, 'head', {}, []],
    [3, 'body', { style: `margin:0;height:100%;overflow:hidden;background:${BG}` }, [[4, 'video', { 'data-tape-clip': '', style }], [5, 'span', { hidden: '' }, [[6, '0']]]]],
  ]],
  events: ticks,
  checkpoints: [{ name: 'start', t: 0, clock: CLOCK0, route: '/', storage: {} }],
  actions: [],
  clock0: CLOCK0,
  clip: { src: `/tapes/${id}.clip.mp4`, t: 0 },
  css: `html,body{height:100%;margin:0;background:${BG}}`,
  duration,
};
writeFileSync(resolve(root, 'public/tapes', `${id}.json`), JSON.stringify(tape));
console.log(`wrote public/tapes/${id}.json (${seconds.toFixed(2)} s) and its clip`);
