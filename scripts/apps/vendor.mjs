// Builds each product for a subpath of this site and copies it into public/apps/<id>/, with the
// portfolio bridge inlined at the top of each of its pages. The build is committed next to its tape, so
// the preview, the seed state it boots into and the app that reads that state always match.
//
// Usage: node scripts/apps/vendor.mjs [id]   (each app's repo must be checked out next to this one)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

export const APPS = {
  lifeui: {
    // A worktree of github.com/Felichz/life-ui on the portfolio-embed branch.
    repo: resolve(root, '../life-ui-embed'),
    build: (out) => ['npx', ['vite', 'build', '--base', '/apps/lifeui/', '--outDir', out, '--emptyOutDir']],
  },
  katarch: {
    // github.com/Felichz/katarch: the course is the Astro site in v2/, already base-aware.
    repo: resolve(root, '../katarch/v2'),
    build: (out) => ['npx', ['astro', 'build', '--base', '/apps/katarch/', '--outDir', out]],
    // A few content strings point at /img/ on the site root.
    rewrite: [[/(["'(=]|\\")\/img\//g, '$1/apps/katarch/img/']],
  },
  knowgraph: {
    // A worktree of github.com/Felichz/KnowGraph on the portfolio-embed branch, which makes its routes
    // and service worker follow the base path.
    repo: resolve(root, '../learning-embed'),
    build: (out) => ['npx', ['vite', 'build', '--base', '/apps/knowgraph/', '--outDir', out, '--emptyOutDir']],
  },
  playsync: {
    // A worktree of github.com/Felichz/PlaySync on the portfolio-embed branch: no service worker in
    // this build, and the video starts muted in a frame. There's no server here: playsync-room.js
    // stands in for one room, played from the tape (public/tapes/playsync.json, app.socket).
    repo: resolve(root, '../rave2-embed'),
    env: { PLAYSYNC_EMBED: '1' },
    build: (out) => ['npx', ['vite', 'build', '--base', '/apps/playsync/', '--outDir', out, '--emptyOutDir']],
    inject: ['playsync-room.js'],
  },
  lolimpact: {
    // github.com/Felichz/LoL-Impact: the Svelte frontend. Its API answers come with the tape
    // (public/tapes/lolimpact.net.json), recorded against a local backend.
    repo: resolve(root, '../LoLImpact/frontend'),
    build: (out) => ['npx', ['vite', 'build', '--base', '/apps/lolimpact/', '--outDir', out, '--emptyOutDir']],
  },
};

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

const only = process.argv.slice(2).find((a) => !a.startsWith('--'));

// With --bridge, the built apps stay as they are and only get the current bridge (and its hash), in
// place of the one they have: for a bridge change, without rebuilding every app from its repo.
if (process.argv.includes('--bridge')) {
  const bridge = readFileSync(resolve(here, 'bridge.js'), 'utf8');
  const hash = `'sha256-${createHash('sha256').update(bridge).digest('base64')}'`;
  for (const id of Object.keys(APPS)) {
    if (only && only !== id) continue;
    for (const file of walk(resolve(root, 'public/apps', id))) {
      if (extname(file) !== '.html') continue;
      const text = readFileSync(file, 'utf8');
      const start = text.indexOf(`<script data-app="${id}">`);
      const end = text.indexOf('</script>', start);
      if (start < 0) continue;
      const old = text.slice(start + `<script data-app="${id}">`.length, end);
      const oldHash = `'sha256-${createHash('sha256').update(old).digest('base64')}'`;
      writeFileSync(file, text.slice(0, start) + `<script data-app="${id}">${bridge}` + text.slice(end).replace(oldHash, hash));
    }
    console.log(`bridge updated in public/apps/${id}/`);
  }
  process.exit(0);
}

for (const [id, app] of Object.entries(APPS)) {
  if (only && only !== id) continue;
  const out = resolve(root, 'public/apps', id);
  const [cmd, args] = app.build(out);
  console.log(`building ${id} from ${app.repo}`);
  execFileSync(cmd, args, { cwd: app.repo, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...app.env } });

  const bridge = readFileSync(resolve(here, 'bridge.js'), 'utf8');
  // App-specific stand-ins (a room server, for PlaySync) go right after it, before the app's code.
  const extra = (app.inject ?? []).map((f) => `\n    <script data-app="${id}">${readFileSync(resolve(here, f), 'utf8')}</script>`).join('');
  for (const file of walk(out)) {
    const ext = extname(file);
    if (ext !== '.html' && ext !== '.js') continue;
    let text = readFileSync(file, 'utf8');
    const before = text;
    for (const [from, to] of app.rewrite ?? []) text = text.replace(from, to);
    if (ext === '.html') {
      text = text.replace(/<head>/, `<head>\n    <script data-app="${id}">${bridge}</script>${extra}`);
      // An app with a Content-Security-Policy allows the bridge by its hash, like its own inline scripts.
      const hash = `'sha256-${createHash('sha256').update(bridge).digest('base64')}'`;
      text = text.replace(/(http-equiv="Content-Security-Policy"\s+content="[^"]*script-src [^;"]*)/, `$1 ${hash}`);
    }
    if (text !== before) writeFileSync(file, text);
  }

  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app.repo, encoding: 'utf8' }).trim();
  writeFileSync(resolve(out, 'vendored.json'), JSON.stringify({ id, commit, built: new Date().toISOString() }, null, 2) + '\n');
  console.log(`vendored ${id} @ ${commit.slice(0, 7)} -> public/apps/${id}/`);
}
