# Portfolio (Felix Andersson): working notes for Claude

An Astro portfolio whose showcase runs live apps in stages. The work in progress is **performance**, on branch `live-apps`. Read `README.md`, `DESIGN.md` and `scripts/perf/MEASURING.md` before measuring or changing anything.

Felix writes in Spanish: answer him in Spanish. Code, comments, commits, docs and channel messages are in English. His copy rules: no em-dashes, no self-praise, only sourced metrics.

## Hard rules

- Commits are Felix's: author `Felix Andersson <andersson.fx@gmail.com>`, conventional commits (`perf:`, `fix:`, `docs:`, `refactor:`, `perf(scripts):`). **No `Co-Authored-By` and no Claude trailers**, whatever the tool's default attribution says.
- Never merge to `main` without Felix's approval. Never force-push. Never rewrite a commit that is already pushed.
- Never touch Felix's employer repos (`seekr`, `design-system`).
- No secrets in commits, messages or logs. Don't kill processes you didn't start (Felix runs voice and render jobs on his machines): if one is in the way, tell him and wait.
- A change that alters what the visitor sees or when it happens is Felix's call: describe it, hold it on a branch, ask him in the session.

## Two Claudes, one repo

Two instances work in parallel on the same goal, **making the portfolio fast**: `win` (Felix's Windows laptop) and `mac` (his Mac). The identity comes from the platform; `COORD_AGENT=win|mac` overrides it. There is one final state: `live-apps`. `win` is the integrator: it is the only one that moves `live-apps`.

### The channel

The instances talk through files on the `coord` branch of the GitHub remote (`git@github.com:Felichz/portfolio-felix.git`), with `scripts/coord/coord.mjs` (Node, no dependencies, same on both OSes; `npm run coord -- <command>`). Every file is written by its author only and named uniquely, so nothing ever conflicts. The channel lives in a worktree next to the repo (`../<repo folder>-coord`, which `init` creates), so it never touches your code branch.

```bash
node scripts/coord/coord.mjs init                       # once per machine
node scripts/coord/coord.mjs check                      # what's new, who claims what, what the other is doing
node scripts/coord/coord.mjs send --to all --type result --subject "..." --ref <sha> --body "..."
node scripts/coord/coord.mjs status --set "what I'm doing now"
node scripts/coord/coord.mjs claim <area> --files a,b --note "..."   # before editing; exits 2 if the other holds it
node scripts/coord/coord.mjs release <area> --ref <sha>
node scripts/coord/coord.mjs watch                      # run in the background: exits when a message for you arrives
```

Types: `info`, `question`, `claim`, `release`, `result`, `handoff`, `blocker`. A message says what happened, the commit (`--ref`), the command that shows it, the numbers (median of at least 3 runs, with the machine and `DISPLAY_HZ`), and what you need from the other. Keep it short.

### When to look (this is not optional)

- At the start of a session: `check`, then start `watch` in the background (Claude Code: `run_in_background`).
- Before choosing what to work on, before every commit and push, and after every measurement.
- Whenever `watch` ends with a message: read it, answer it if it asks something, restart `watch`.
- In a long run, at least every 10 minutes.
- When you ask a question, don't wait for the answer: take another task and come back to it.

### Working together

1. **Claim before you edit.** `claim <area>` with the files. The earlier claim wins; if you need something that is held, send a `question`. Release when it's merged or dropped. Areas are topics (`product-change`, `window-close`, `cold-boot`, `theme-wash`, `load`, `docs`), not whole files.
2. **Branches.** `win` commits on `live-apps`. `mac` works on `perf/mac`, branched from the latest `origin/live-apps`, and rebases onto it before announcing a result, so that `win` can fast-forward (`git merge --ff-only origin/perf/mac`). Rebase often: `live-apps` moves.
3. **What may be integrated.** Measured A/B, alternating the variants, with the same metric, at least 3 runs each, and the median better; no visible loss; `npx astro check` with 0 errors; the gate in PASS on the machine that proposes it. If the change touches rendering (compositing, raster, GPU), the other machine runs the same scripts and confirms before `win` integrates; if it can't, the message says "unconfirmed on <machine>".
4. **Numbers are never compared across machines.** The displays, GPUs and loads differ. Each machine keeps its own baseline in `scripts/perf/baseline-<agent>.md`, and every A/B runs on one machine.
5. **Disagreements.** If you can't agree, or both think the other broke something: `blocker`, and tell Felix in your session. Don't undo the other's commits.
6. **After integrating**, `win` sends a `result` with the new `live-apps` head; `mac` rebases.

### Setting up the Mac

```bash
git clone git@github.com:Felichz/portfolio-felix.git portfolio && cd portfolio
git checkout live-apps && git checkout -b perf/mac
git config user.name "Felix Andersson" && git config user.email "andersson.fx@gmail.com"
npm ci
node scripts/coord/coord.mjs init && node scripts/coord/coord.mjs check --all   # read the whole channel, oldest first
npx astro build && (npx astro preview --host 127.0.0.1 --port 4391 &)
node scripts/perf/ceiling.mjs        # what a blank page holds: set DISPLAY_HZ to it (60 or 120 on a Mac screen)
DISPLAY_HZ=<n> node scripts/perf/check.mjs --gate
```

Google Chrome must be installed (`CHROME_PATH` overrides where the scripts look). Record the baseline of this machine with the commands in `scripts/perf/MEASURING.md`, in `scripts/perf/baseline-mac.md`, before changing code.

### Notes per machine

- **win**: the active display is 100 Hz (use `DISPLAY_HZ=100`); the GPU is shared with Felix's voice and render jobs (python, ffmpeg, HyperFrames), so check the CPU before measuring and treat a busy machine as no measurement. The gate refuses to run when a blank page holds less than 90% of `DISPLAY_HZ`.
- **mac**: unknown yet, so measure it first. Browsers on Apple silicon often cap `requestAnimationFrame` to the screen's rate; low-power mode throttles Chrome, so keep the Mac on power.
- `http://[::1]:PORT` is the page with its stages in the same process, which is what a deployment without `PUBLIC_STAGE_ORIGIN` gives; `http://127.0.0.1:PORT` runs them in their own process. Measure both when it matters.
