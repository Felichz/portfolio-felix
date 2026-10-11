// Which JavaScript runs in the theme toggle's click and its first frames: the CPU profile's hottest
// call frames, by file, line and column. node scripts/perf/themeprof.mjs
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath, windowPosition } from './chrome.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: !!process.env.HEADLESS, defaultViewport: null, userDataDir: mkdtempSync(join(tmpdir(), 'tp-')),
  args: ['--window-size=1600,1047', `--window-position=${windowPosition()}`, '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await page.mouse.move(1530, 900, { steps: 4 });
await sleep(9000);
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
await page.evaluate(() => document.querySelector('[data-theme-toggle]').click());
await sleep(1500);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();
// Self time per call frame (the sample's own node), by url:line:column.
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
const self = new Map();
profile.samples.forEach((id, i) => {
  const n = byId.get(id);
  const f = n.callFrame;
  const k = `${(f.url || '(native)').split('/').pop().slice(0, 40)}:${f.lineNumber + 1}:${f.columnNumber + 1} ${f.functionName || '(anon)'}`;
  self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000);
});
for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`${ms.toFixed(1).padStart(7)} ms  ${k}`);
