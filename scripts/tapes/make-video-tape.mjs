// Writes a tape that is only a video: KnowGraph's preview is its product video, since the app needs the
// visitor's own LLM and ships as a desktop download. The tape's document is a <video data-tape-clip> per
// app edition filling the viewport (its css shows the one the theme attribute names), which the tape
// player drives on its own clock (src/scripts/tape.ts); the "live app" under it
// (scripts/apps/knowgraph-video/) plays the same files on the bridge's clock.
//
// Usage: node scripts/tapes/make-video-tape.mjs <id> <dark.mp4> <light.mp4> [seconds]
//   Encodes public/tapes/<id>.clip.mp4 and <id>.light.clip.mp4 (30 fps, H.264), cut to the first
//   [seconds] when given, and writes public/tapes/<id>.json.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [id, dark, light, cut] = process.argv.slice(2);
if (!id || !dark || !light) throw new Error('Usage: node scripts/tapes/make-video-tape.mjs <id> <dark.mp4> <light.mp4> [seconds]');

// The app clock at tape time 0; the video page derives its playhead from it, so they must match.
const CLOCK0 = 1793000000000;
const BG = { dark: '#0E1117', light: '#F6F7F9' };

const encode = (source, name) => {
  const out = resolve(root, 'public/tapes', name);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, ...(cut ? ['-t', cut] : []), '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow',
    '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }));
};
const seconds = encode(dark, `${id}.clip.mp4`);
encode(light, `${id}.light.clip.mp4`);

const style = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain';
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
    [3, 'body', { style: 'margin:0;height:100%;overflow:hidden' }, [
      [4, 'video', { 'data-tape-clip': `/tapes/${id}.clip.mp4`, 'data-edition': 'dark', style }],
      [7, 'video', { 'data-tape-clip': `/tapes/${id}.light.clip.mp4`, 'data-edition': 'light', style }],
      [5, 'span', { hidden: '' }, [[6, '0']]],
    ]],
  ]],
  events: ticks,
  checkpoints: [{ name: 'start', t: 0, clock: CLOCK0, route: '/', storage: {} }],
  actions: [],
  clock0: CLOCK0,
  clip: { src: `/tapes/${id}.clip.mp4`, t: 0 },
  css: `html,body{height:100%;margin:0;background:${BG.dark}}html[data-theme=light],html[data-theme=light] body{background:${BG.light}}`
    + 'html[data-theme=light] video[data-edition=dark],html:not([data-theme=light]) video[data-edition=light]{display:none}',
  duration,
};
writeFileSync(resolve(root, 'public/tapes', `${id}.json`), JSON.stringify(tape));
console.log(`wrote public/tapes/${id}.json (${seconds.toFixed(2)} s) and its two clips`);
