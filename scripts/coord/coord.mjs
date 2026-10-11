#!/usr/bin/env node
// The channel between the Claude instances working on this repo (one per machine: `win`, `mac`).
// Messages are files on the `coord` branch of the GitHub remote, so nothing needs to be running:
// each instance pulls, reads what's new, and writes its own files. A file is only ever written by its
// author and named uniquely, so two instances never conflict. See CLAUDE.md for when to use it.
//
//   node scripts/coord/coord.mjs init                      first time on a machine (creates the channel if new)
//   node scripts/coord/coord.mjs check [--all]             what's new from the others (--all: every message)
//   node scripts/coord/coord.mjs send --to all|win|mac --type <type> --subject "..." [--body "..."] [--ref <sha|path>]
//                                                          (the body comes from stdin when it isn't given)
//   node scripts/coord/coord.mjs status --set "what I'm doing"
//   node scripts/coord/coord.mjs claim <area> [--files a,b] [--note "..."]   say you're editing something
//   node scripts/coord/coord.mjs release <area>
//   node scripts/coord/coord.mjs claims                    who holds what, and since when
//   node scripts/coord/coord.mjs watch [--every 60] [--max 3600]   exits when something new arrives (run it in the background)
//
// Types: info, question, claim, release, result, handoff, blocker.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const TYPES = ['info', 'question', 'claim', 'release', 'result', 'handoff', 'blocker'];
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (cwd, ...args) => {
  try {
    return { ok: true, out: sh(cwd, ...args) };
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? e.message).trim() };
  }
};

const agent = process.env.COORD_AGENT || { win32: 'win', darwin: 'mac' }[process.platform] || process.platform;
const commonDir = sh(process.cwd(), 'rev-parse', '--path-format=absolute', '--git-common-dir');
const root = dirname(commonDir);
const coordDir = join(dirname(root), `${basename(root)}-coord`);
const statePath = join(commonDir, `coord-state-${agent}.json`);

const args = process.argv.slice(3);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? true) : fallback;
};
const text = (v) => (v === true || v === undefined ? '' : String(v));
const has = (name) => args.includes(`--${name}`);
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'msg';
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');

const readState = () => {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return { seen: [] };
  }
};
const writeState = (s) => writeFileSync(statePath, JSON.stringify(s));

/** The channel's worktree, next to the repo: made from the remote's `coord` branch, or as a new empty one. */
function ensure() {
  if (!existsSync(coordDir)) {
    tryGit(root, 'fetch', 'origin', 'coord');
    const remote = tryGit(root, 'rev-parse', '--verify', '--quiet', 'origin/coord').ok;
    const local = tryGit(root, 'rev-parse', '--verify', '--quiet', 'coord').ok;
    if (!remote && !local) {
      const sha = sh(root, 'commit-tree', EMPTY_TREE, '-m', 'coord: channel opened');
      sh(root, 'branch', 'coord', sha);
    } else if (remote && !local) {
      sh(root, 'branch', '--track', 'coord', 'origin/coord');
    }
    sh(root, 'worktree', 'add', coordDir, 'coord');
  }
  dirs();
}
const dirs = () => ['messages', 'status', 'claims'].forEach((d) => mkdirSync(join(coordDir, d), { recursive: true }));
/** Pulls the channel. Git drops a folder once its last file goes, so the folders come back after it. */
const pull = () => {
  const r = tryGit(coordDir, 'pull', '--rebase', '--autostash', 'origin', 'coord');
  dirs();
  return r;
};
function publish(message) {
  sh(coordDir, 'add', '-A');
  if (tryGit(coordDir, 'status', '--porcelain').out === '') return;
  sh(coordDir, 'commit', '-q', '-m', message);
  for (let i = 0; i < 6; i++) {
    if (tryGit(coordDir, 'push', '-u', 'origin', 'coord').ok) return;
    pull();
  }
  throw new Error('could not push the coord branch (is the remote reachable, and are you authenticated?)');
}

const parse = (file) => {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const k = line.indexOf(':');
    if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
  }
  return { meta, body: (m?.[2] ?? raw).trim() };
};
const messages = () =>
  readdirSync(join(coordDir, 'messages'))
    .filter((f) => f.endsWith('.md'))
    .sort();
const forMe = (meta) => meta.from !== agent && (meta.to === 'all' || meta.to === agent || !meta.to);
const show = (name) => {
  const { meta, body } = parse(join(coordDir, 'messages', name));
  console.log(`\n--- ${meta.type ?? 'info'} from ${meta.from} to ${meta.to} · ${meta.at}${meta.ref ? ` · ref ${meta.ref}` : ''}\n${meta.subject ?? name}\n${body}`);
};

const unread = () => {
  const seen = new Set(readState().seen);
  return messages().filter((n) => !seen.has(n));
};
const markSeen = (names) => {
  const s = readState();
  s.seen = [...new Set([...s.seen, ...names])];
  writeState(s);
};

function claimsText() {
  const dir = join(coordDir, 'claims');
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const { meta, body } = parse(join(dir, f));
    out.push(`  ${meta.area} · ${meta.from} · since ${meta.at}${meta.files ? ` · files: ${meta.files}` : ''}${body ? ` · ${body}` : ''}`);
  }
  return out.length ? out.join('\n') : '  (none)';
}
function othersText() {
  const dir = join(coordDir, 'status');
  const out = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && !x.startsWith(`${agent}.`))) {
    const { meta, body } = parse(join(dir, f));
    out.push(`  ${meta.from} (${meta.at}, ${meta.branch ?? '?'} @ ${meta.head ?? '?'}): ${body}`);
  }
  return out.length ? out.join('\n') : '  (nothing yet)';
}

/** Shows the messages meant for this agent; every one in `names` counts as read. */
function report(names) {
  const mine = names.filter((n) => forMe(parse(join(coordDir, 'messages', n)).meta));
  mine.forEach(show);
  markSeen(names);
  return mine.length;
}

function send({ to, type, subject, body, ref }) {
  if (!TYPES.includes(type)) throw new Error(`--type must be one of ${TYPES.join(', ')}`);
  if (!subject) throw new Error('--subject is required');
  ensure();
  pull();
  const name = `${stamp()}-${agent}-${slug(subject)}.md`;
  const head = ['---', `from: ${agent}`, `to: ${to}`, `type: ${type}`, `subject: ${subject}`, `at: ${new Date().toISOString()}`, ref ? `ref: ${ref}` : null, '---', ''].filter((l) => l !== null);
  writeFileSync(join(coordDir, 'messages', name), `${head.join('\n')}\n${body ?? ''}\n`);
  publish(`coord: ${agent} ${type}: ${subject}`);
  markSeen([name]);
  console.log(`sent ${name}`);
}

const cmd = process.argv[2];
const branch = () => tryGit(root, 'rev-parse', '--abbrev-ref', 'HEAD').out;
const head = () => tryGit(root, 'rev-parse', '--short', 'HEAD').out;

if (cmd === 'init') {
  ensure();
  pull();
  const readme = join(coordDir, 'README.md');
  if (!existsSync(readme)) {
    writeFileSync(readme, '# coord\n\nThe channel between the Claude instances working on this repo. Not code: messages, status and claims, one file each.\nThe protocol is in CLAUDE.md on `live-apps`; the tool is `scripts/coord/coord.mjs`.\n');
  }
  publish(`coord: ${agent} joins`);
  console.log(`channel ready as "${agent}" (${coordDir})`);
} else if (cmd === 'check') {
  ensure();
  pull();
  const n = report(has('all') ? messages() : unread());
  console.log(n ? `\n${n} message(s) for ${agent}.` : `no news for ${agent}.`);
  console.log(`\nclaims:\n${claimsText()}\n\nthe others:\n${othersText()}`);
} else if (cmd === 'send') {
  const given = flag('body');
  const body = given !== undefined ? text(given) : process.stdin.isTTY ? '' : readFileSync(0, 'utf8').trim();
  send({ to: text(flag('to', 'all')), type: text(flag('type', 'info')), subject: text(flag('subject')), body, ref: text(flag('ref')) });
} else if (cmd === 'status') {
  ensure();
  pull();
  const what = text(flag('set'));
  if (!what) throw new Error('--set "what I am doing" is required');
  writeFileSync(join(coordDir, 'status', `${agent}.md`), `---\nfrom: ${agent}\nat: ${new Date().toISOString()}\nbranch: ${branch()}\nhead: ${head()}\n---\n${what}\n`);
  publish(`coord: ${agent} status`);
  console.log('status updated');
} else if (cmd === 'claim') {
  if (!args[0]) throw new Error('claim <area>');
  const area = slug(args[0]);
  ensure();
  pull();
  const held = readdirSync(join(coordDir, 'claims')).find((f) => f.startsWith(`${area}.`) && !f.startsWith(`${area}.${agent}.`));
  if (held && !has('force')) {
    console.log(`"${area}" is held by ${held.split('.')[1]}. Write to them (send --type question) before touching it.\n\nclaims:\n${claimsText()}`);
    process.exit(2);
  }
  const files = text(flag('files'));
  const note = text(flag('note'));
  writeFileSync(join(coordDir, 'claims', `${area}.${agent}.md`), `---\narea: ${area}\nfrom: ${agent}\nat: ${new Date().toISOString()}\n${files ? `files: ${files}\n` : ''}---\n${note}\n`);
  publish(`coord: ${agent} claims ${area}`);
  send({ to: 'all', type: 'claim', subject: `claim ${area}`, body: `${files ? `Files: ${files}\n` : ''}${note}` });
} else if (cmd === 'release') {
  if (!args[0]) throw new Error('release <area>');
  const area = slug(args[0]);
  ensure();
  pull();
  rmSync(join(coordDir, 'claims', `${area}.${agent}.md`), { force: true });
  publish(`coord: ${agent} releases ${area}`);
  send({ to: 'all', type: 'release', subject: `release ${area}`, body: has('ref') ? `Merged at ${text(flag('ref'))}.` : '' });
} else if (cmd === 'claims') {
  ensure();
  pull();
  console.log(`claims:\n${claimsText()}`);
} else if (cmd === 'watch') {
  ensure();
  const every = Number(flag('every', 60)) * 1000;
  const max = Number(flag('max', 3600)) * 1000;
  const t0 = Date.now();
  for (;;) {
    pull();
    const fresh = unread();
    const mine = fresh.filter((n) => forMe(parse(join(coordDir, 'messages', n)).meta));
    markSeen(fresh.filter((n) => !mine.includes(n)));
    if (mine.length) {
      report(mine);
      console.log(`\n${mine.length} new message(s) for ${agent}. Restart \`watch\` when you've dealt with them.`);
      break;
    }
    if (Date.now() - t0 > max) {
      console.log(`no news for ${agent} in ${Math.round(max / 60000)} min. Restart \`watch\` to keep listening.`);
      break;
    }
    await new Promise((r) => setTimeout(r, every));
  }
} else {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(
    src
      .split('\n')
      .filter((l) => l.startsWith('//'))
      .map((l) => l.slice(3))
      .join('\n'),
  );
  process.exit(cmd ? 1 : 0);
}
