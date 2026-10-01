// Builds each product for a subpath of this site and copies it into public/apps/<id>/, with the
// portfolio bridge inlined at the top of its index.html. The build is committed next to its tape, so
// the preview, the seed state it thaws into and the app that reads that state always match.
//
// Usage: node scripts/apps/vendor.mjs [id]   (each app's repo must be checked out next to this one)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

export const APPS = {
  lifeui: {
    // A worktree of github.com/Felichz/life-ui on the portfolio-embed branch.
    repo: resolve(root, '../life-ui-embed'),
    build: (out) => ['npx', ['vite', 'build', '--base', '/apps/lifeui/', '--outDir', out, '--emptyOutDir']],
  },
};

const only = process.argv[2];
for (const [id, app] of Object.entries(APPS)) {
  if (only && only !== id) continue;
  const out = resolve(root, 'public/apps', id);
  const [cmd, args] = app.build(out);
  console.log(`building ${id} from ${app.repo}`);
  execFileSync(cmd, args, { cwd: app.repo, stdio: 'inherit', shell: process.platform === 'win32' });

  const html = resolve(out, 'index.html');
  const bridge = readFileSync(resolve(here, 'bridge.js'), 'utf8');
  const page = readFileSync(html, 'utf8').replace('<head>', `<head>\n    <script data-app="${id}">${bridge}</script>`);
  writeFileSync(html, page);

  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app.repo, encoding: 'utf8' }).trim();
  writeFileSync(resolve(out, 'vendored.json'), JSON.stringify({ id, commit, built: new Date().toISOString() }, null, 2) + '\n');
  console.log(`vendored ${id} @ ${commit.slice(0, 7)} -> public/apps/${id}/`);
}
