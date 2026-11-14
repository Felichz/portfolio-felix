/**
 * Draws the pictures the products' READMEs show: each panel of scripts/readme/panels.mjs as one
 * full-width image, a screenshot in the portfolio's window with a headline over it, in a light and a
 * dark version (a README picks one with <picture> and prefers-color-scheme).
 *
 * As on the site, the window shows the product's opposite edition: the dark app on the light panel.
 *
 *   node scripts/readme/build.mjs                 every product whose repo is found next to this one
 *   node scripts/readme/build.mjs lifeui playsync only these
 *   REPOS=~/dev/felichz node scripts/readme/build.mjs   where the products' repos are (default: ..)
 *   OUT=/tmp/panels node scripts/readme/build.mjs       write here instead (one folder per product)
 *
 * Output: <repo>/docs/readme/<nn>-<slug>-light.webp and -dark.webp, and the README's markup on stdout.
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { chromePath } from '../perf/chrome.mjs';
import { products } from './panels.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const expand = (p) => (p.startsWith('~') ? join(homedir(), p.slice(1)) : resolve(p));
const repos = expand(process.env.REPOS || join(root, '..'));
const outRoot = process.env.OUT && expand(process.env.OUT);
const only = process.argv.slice(2);

const WIDTH = 1040; // CSS px; drawn at 2x. A README column is about 880 px wide.
const url = (p) => pathToFileURL(join(root, p)).href;
const font = (family, pkg, file, weight) =>
  `@font-face{font-family:'${family}';src:url('${url(`node_modules/${pkg}/files/${file}`)}') format('woff2');font-weight:${weight};font-display:block}`;
const FONTS = [
  ...[400, 500, 600, 700].map((w) => font('Inter', '@fontsource/inter', `inter-latin-${w}-normal.woff2`, w)),
  ...[600, 700].map((w) => font('Bricolage Grotesque', '@fontsource/bricolage-grotesque', `bricolage-grotesque-latin-${w}-normal.woff2`, w)),
  ...[500, 600].map((w) => font('Martian Mono', '@fontsource/martian-mono', `martian-mono-latin-${w}-normal.woff2`, w)),
  font('Archivo', '@fontsource-variable/archivo', 'archivo-latin-wght-normal.woff2', '100 900'),
].join('\n');

const FACES = {
  inter: `font-family:'Inter';font-weight:700;letter-spacing:-0.028em`,
  bricolage: `font-family:'Bricolage Grotesque';font-weight:700;letter-spacing:-0.025em`,
  martian: `font-family:'Martian Mono';font-weight:600;letter-spacing:-0.045em;text-transform:uppercase;font-size:37px;line-height:1.2`,
  archivo: `font-family:'Archivo';font-weight:750;letter-spacing:-0.03em`,
};

const CSS = `
${FONTS}
*{box-sizing:border-box;margin:0}
html,body{background:transparent}
body{width:${WIDTH}px;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.panel{position:relative;overflow:hidden;width:${WIDTH}px;padding:52px 48px 48px;border-radius:28px;background:var(--bg);color:var(--ink)}
.panel::before{content:'';position:absolute;inset:0;background:
  radial-gradient(70% 55% at 88% -8%,color-mix(in oklab,var(--accent) 26%,transparent),transparent 70%),
  radial-gradient(60% 50% at -6% 108%,color-mix(in oklab,var(--accent) 12%,transparent),transparent 70%)}
.panel::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1.5px var(--line)}
.panel>*{position:relative;z-index:1}
[data-theme=light]{--bg:#f2f1ed;--ink:#16161a;--ink-2:#55555e;--line:rgb(0 0 0 / .08);--chrome-bg:#17171b;--chrome-ink:#9d9da6;--shadow:0 1px 2px rgb(0 0 0 / .1),0 18px 44px -12px rgb(20 20 30 / .34)}
[data-theme=dark]{--bg:#0d0d10;--ink:#f2f1ed;--ink-2:#a3a3ad;--line:rgb(255 255 255 / .1);--chrome-bg:#f1f0ec;--chrome-ink:#6a6a72;--shadow:0 1px 2px rgb(0 0 0 / .5),0 18px 44px -12px rgb(0 0 0 / .7)}
.eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:18px;font:600 17px/1 'Inter';color:var(--accent);letter-spacing:.01em}
.eyebrow b{font:inherit;color:var(--ink)}
.eyebrow i{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.55}
.step{display:inline-grid;place-items:center;height:30px;padding:0 11px;border-radius:999px;background:var(--accent);color:var(--bg);font:600 15px/1 'Martian Mono';letter-spacing:0}
h1{font-size:47px;line-height:1.08;max-width:19em;text-wrap:balance}
p.sub{margin-top:16px;max-width:36em;font:400 22px/1.42 'Inter';color:var(--ink-2);text-wrap:pretty}
.win{margin-top:36px;border-radius:14px;background:var(--chrome-bg);box-shadow:0 0 0 1px var(--line),var(--shadow)}
.bar{position:relative;display:grid;place-items:center;height:38px;color:var(--chrome-ink)}
.lights{position:absolute;left:15px;top:13px;display:flex;gap:8px}
.lights i{width:12px;height:12px;border-radius:50%;background:color-mix(in oklab,var(--chrome-ink) 28%,transparent)}
.lights i:last-child{background:#28c840;box-shadow:inset 0 0 0 .5px rgb(0 0 0 / .2)}
.url{display:inline-flex;align-items:center;gap:7px;height:23px;padding:0 14px;border-radius:999px;background:color-mix(in oklab,var(--chrome-ink) 14%,transparent);font:500 12.5px/1 'Inter';letter-spacing:.01em}
.url svg{width:10px;height:10px}
.screen{position:relative;border-radius:0 0 14px 14px;overflow:hidden}
.screen img{display:block;width:100%}
.pin{position:absolute;display:grid;place-items:center;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:var(--accent);color:var(--bg);font:700 15px/1 'Inter';box-shadow:0 0 0 4px color-mix(in oklab,var(--accent) 30%,transparent),0 4px 12px rgb(0 0 0 / .35)}
.legend{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:28px}
.legend div{display:grid;grid-template-columns:auto 1fr;gap:12px;font:400 17.5px/1.42 'Inter';color:var(--ink-2)}
.legend b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--bg);font:700 14px/1 'Inter'}
.split{display:grid;grid-template-columns:1fr auto;gap:56px;align-items:center}
.split h1{font-size:43px}
.phone{width:300px;padding:9px;border-radius:44px;background:var(--chrome-bg);box-shadow:0 0 0 1px var(--line),var(--shadow)}
.phone img{display:block;width:100%;border-radius:36px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:38px}
.row figure{display:grid;gap:18px;justify-items:center}
.row .phone{width:100%;padding:8px;border-radius:38px}
.row .phone img{border-radius:31px}
.row figcaption{display:flex;gap:10px;align-items:baseline;font:600 19px/1.3 'Inter';text-align:left;width:100%;padding:0 6px}
.row figcaption b{font:600 14px/1 'Martian Mono';color:var(--accent)}
`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const LOCK = `<svg viewBox="0 0 10 10" fill="currentColor"><path d="M3 4V3a2 2 0 1 1 4 0v1h.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Zm1 0h2V3a1 1 0 1 0-2 0Z"/></svg>`;

function panelHTML(product, panel, index, theme) {
  // The opposite edition, as the site shows its previews.
  const edition = theme === 'light' ? 'dark' : 'light';
  const shot = (name) => url(`${product.shots ?? 'src/assets/shots'}/${name}-${edition}.webp`);
  const eyebrow = `<div class="eyebrow">${panel.step ? `<span class="step">${panel.step}</span>` : ''}<b>${esc(product.name)}</b>${
    index === 0 && !panel.step ? `<i></i><span>${esc(product.host)}</span>` : ''
  }</div>`;
  const text = `${eyebrow}<h1 style="${FACES[product.face]}">${esc(panel.title)}</h1><p class="sub">${esc(panel.sub)}</p>`;
  let body;
  if (panel.shot) {
    const pins = panel.pins ?? [];
    body = `${text}
      <div class="win">
        <div class="bar"><span class="lights"><i></i><i></i><i></i></span><span class="url">${LOCK}${esc(product.host)}</span></div>
        <div class="screen"><img src="${shot(panel.shot)}">${pins.map((p, i) => `<span class="pin" style="left:${p.x}%;top:${p.y}%">${i + 1}</span>`).join('')}</div>
      </div>
      ${pins.length ? `<div class="legend">${pins.map((p, i) => `<div><b>${i + 1}</b><span>${esc(p.text)}</span></div>`).join('')}</div>` : ''}`;
  } else if (panel.phone) {
    body = `<div class="split"><div>${text}</div><div class="phone"><img src="${shot(panel.phone)}"></div></div>`;
  } else {
    body = `${text}<div class="row">${panel.phones
      .map((p, i) => `<figure><div class="phone"><img src="${shot(p.shot)}"></div><figcaption><b>${i + 1}</b><span>${esc(p.label)}</span></figcaption></figure>`)
      .join('')}</div>`;
  }
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body><div class="panel" data-theme="${theme}" style="--accent:${product.accent[theme]}">${body}</div>`;
}

const alt = (product, panel) => {
  const what = panel.shot ? 'screenshot in a browser window' : panel.phone ? 'screenshot on a phone' : 'three phone screenshots';
  const pins = panel.pins ? ` Marked: ${panel.pins.map((p, i) => `${i + 1}, ${p.text}`).join(' ')}` : '';
  const steps = panel.phones ? ` ${panel.phones.map((p, i) => `${i + 1}, ${p.label}.`).join(' ')}` : '';
  return `${product.name}, ${what}. ${panel.title}${/[.?!]$/.test(panel.title) ? '' : '.'} ${panel.sub}${pins}${steps}`.replace(/"/g, '&quot;');
};

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: WIDTH, height: 900, deviceScaleFactor: 2 });
const tmp = join(tmpdir(), `readme-panel-${process.pid}.html`);

for (const product of products) {
  if (only.length && !only.includes(product.id)) continue;
  const repo = product.self ? root : product.repo.map((r) => join(repos, r)).find(existsSync);
  if (!repo && !outRoot) {
    console.error(`${product.id}: no repo in ${repos} (${product.repo?.join(', ')}), skipped`);
    continue;
  }
  const dir = outRoot ? join(outRoot, product.id) : join(repo, 'docs/readme');
  mkdirSync(dir, { recursive: true });
  const markup = [];
  for (const [i, panel] of product.panels.entries()) {
    const base = `${String(i + 1).padStart(2, '0')}-${panel.slug}`;
    for (const theme of ['light', 'dark']) {
      writeFileSync(tmp, panelHTML(product, panel, i, theme));
      await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((img) => img.decode()));
      });
      const el = await page.$('.panel');
      await el.screenshot({ path: join(dir, `${base}-${theme}.webp`), type: 'webp', quality: 90, omitBackground: true });
    }
    markup.push(
      `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/${base}-dark.webp">\n  <img src="docs/readme/${base}-light.webp" width="100%" alt="${alt(product, panel)}">\n</picture>`,
    );
  }
  console.log(`\n<!-- ${product.id}: ${dir} -->\n${markup.join('\n\n')}`);
}
rmSync(tmp, { force: true });
await browser.close();
