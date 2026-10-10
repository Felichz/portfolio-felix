// The page's main thread while it loads and for a few seconds after: its long tasks, and the JavaScript
// behind each. node scripts/perf/loadtrace.mjs
import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4391';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync),
  headless: false,
  defaultViewport: null,
  userDataDir: mkdtempSync(join(tmpdir(), 'lt-')),
  args: ['--window-size=1600,1047', '--window-position=0,0', '--no-first-run', '--disable-features=CalculateNativeWinOcclusion'],
  ignoreDefaultArgs: ['--enable-automation'],
});
const [page] = await browser.pages();
const path = join(mkdtempSync(join(tmpdir(), 'ltr-')), 't.json');
await page.tracing.start({ path, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink'] });
await page.goto(`${BASE}/#work`, { waitUntil: 'load' });
await sleep(4000);
await page.tracing.stop();
await browser.close();
const ev = JSON.parse(readFileSync(path, 'utf8')).traceEvents;
const tn = new Map();
const pn = new Map();
for (const e of ev) if (e.ph === 'M') (e.name === 'thread_name' ? tn : e.name === 'process_name' ? pn : new Map()).set(e.name === 'thread_name' ? `${e.pid}:${e.tid}` : e.pid, e.args.name);
// The page's renderer: the one whose main thread runs the document's own scripts (localhost).
const docPid = new Set();
for (const e of ev) if (typeof e.args?.data?.url === 'string' && e.args.data.url.startsWith(BASE) && e.args.data.frame) docPid.add(e.pid);
const isPage = (e) => docPid.has(e.pid) && tn.get(`${e.pid}:${e.tid}`) === 'CrRendererMain';
const tasks = ev.filter((e) => e.ph === 'X' && e.name === 'RunTask' || (e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask')).filter(isPage).filter((e) => e.dur > 40000);
const t0 = Math.min(...ev.filter(isPage).map((e) => e.ts));
for (const t of tasks.sort((a, b) => a.ts - b.ts)) {
  const kids = ev.filter((x) => x.ph === 'X' && x.pid === t.pid && x.tid === t.tid && x.ts >= t.ts && x.ts + x.dur <= t.ts + t.dur && x !== t && x.dur > 4000).sort((a, b) => b.dur - a.dur).slice(0, 14).map((x) => `${x.name}${x.args?.data?.url ? "[" + x.args.data.url.split("/").pop().slice(0, 30) + ":" + x.args.data.lineNumber + "]" : ""} ${(x.dur / 1000).toFixed(0)}`);
  console.log(`@${((t.ts - t0) / 1000).toFixed(0)}ms ${(t.dur / 1000).toFixed(0)}ms | ${kids.join(' ; ')}`);
}
const fns = new Map();
for (const e of ev) {
  if (e.ph !== 'X' || e.name !== 'FunctionCall' || !isPage(e) || !e.dur) continue;
  const d = e.args?.data ?? {};
  const k = `${(d.url || '').split('/').pop().slice(0, 36)}:${d.lineNumber}:${d.functionName || '(anon)'}`;
  fns.set(k, (fns.get(k) ?? 0) + e.dur / 1000);
}
console.log('JS by function (ms):');
for (const [k, ms] of [...fns].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${ms.toFixed(0).padStart(5)}  ${k}`);
