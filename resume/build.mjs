// Prints resume.html to PDF in both editions with headless Chrome:
//   public/felix-andersson-resume.pdf       (light, the one the site links to)
//   public/felix-andersson-resume-dark.pdf  (dark)
// Usage: node resume/build.mjs   (set CHROME to override the browser path)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chrome =
  process.env.CHROME ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].find(existsSync);
if (!chrome) throw new Error('Chrome not found; set CHROME to its path.');

const page = pathToFileURL(resolve(here, 'resume.html')).href;
const editions = [
  { hash: '', out: 'felix-andersson-resume.pdf' },
  { hash: '#dark', out: 'felix-andersson-resume-dark.pdf' },
];

for (const { hash, out } of editions) {
  const file = resolve(here, '../public', out);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--virtual-time-budget=3000',
    `--print-to-pdf=${file}`,
    page + hash,
  ], { stdio: 'ignore' });
  console.log('wrote', file);
}
