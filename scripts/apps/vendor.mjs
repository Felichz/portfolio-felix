// Builds each product for a subpath of this site and copies it into public/apps/<id>/, with the
// portfolio bridge inlined at the top of each of its pages. The build is committed next to its tape, so
// the preview, the seed state it boots into and the app that reads that state always match.
//
// Usage: node scripts/apps/vendor.mjs [id]   (each app's repo must be checked out next to this one)
import { execFileSync } from 'node:child_process';
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
};

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

const only = process.argv[2];
for (const [id, app] of Object.entries(APPS)) {
  if (only && only !== id) continue;
  const out = resolve(root, 'public/apps', id);
  const [cmd, args] = app.build(out);
  console.log(`building ${id} from ${app.repo}`);
  execFileSync(cmd, args, { cwd: app.repo, stdio: 'inherit', shell: process.platform === 'win32' });

  const bridge = readFileSync(resolve(here, 'bridge.js'), 'utf8');
  for (const file of walk(out)) {
    const ext = extname(file);
    if (ext !== '.html' && ext !== '.js') continue;
    let text = readFileSync(file, 'utf8');
    const before = text;
    for (const [from, to] of app.rewrite ?? []) text = text.replace(from, to);
    if (ext === '.html') text = text.replace(/<head>/, `<head>\n    <script data-app="${id}">${bridge}</script>`);
    if (text !== before) writeFileSync(file, text);
  }

  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app.repo, encoding: 'utf8' }).trim();
  writeFileSync(resolve(out, 'vendored.json'), JSON.stringify({ id, commit, built: new Date().toISOString() }, null, 2) + '\n');
  console.log(`vendored ${id} @ ${commit.slice(0, 7)} -> public/apps/${id}/`);
}
