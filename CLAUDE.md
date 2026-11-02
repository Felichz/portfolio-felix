# Portfolio (Felix Andersson): working notes for Claude

An Astro portfolio whose showcase runs live apps in stages. The work in progress is **performance**, on branch `live-apps`. Read `README.md`, `DESIGN.md` and `scripts/perf/MEASURING.md` before measuring or changing anything.

Felix writes in Spanish: answer him in Spanish. Code, comments, commits, docs and channel messages are in English. His copy rules: no em-dashes, no self-praise, only sourced metrics.

## Hard rules

- Commits are Felix's: author `Felix Andersson <andersson.fx@gmail.com>`, conventional commits (`perf:`, `fix:`, `docs:`, `refactor:`, `perf(scripts):`). **No `Co-Authored-By` and no Claude trailers**, whatever the tool's default attribution says.
- Never merge to `main` without Felix's approval. Never force-push. Never rewrite a commit that is already pushed.
- Never touch Felix's employer repos (`seekr`, `design-system`).
- No secrets in commits, messages or logs. Don't kill processes you didn't start (Felix runs voice and render jobs on his machines): if one is in the way, tell him and wait.
- A change that alters what the visitor sees or when it happens is Felix's call: describe it, hold it on a branch, ask him in the session.

## What Felix wants first

Said by Felix on 2026-10-11. The common things must be fluid for everyone, on modest machines too: **the page's scroll, the interaction with the projects carousel, and the projects themselves**. The window that opens over a preview, and the theme switch, come after. Where the two clash, he keeps his choice and gives up frames: the theme switch is the **circle** (a radial reveal from the toggle), not a fade, even if it doesn't reach 60 fps. A preview's window opens with the app live, not over its recording.

## How the work runs

One instance works here, on Felix's Windows laptop. Until 2026-11-02 a second one ran on his Mac and the two talked through `scripts/coord/coord.mjs` on the `coord` branch; the Mac is retired, the channel is history (its old claims hold nothing), and checking it is optional.

- **Branches.** `main` is production. `live-apps` is the integration branch and follows `main`; work goes on a branch of its own (`perf/<topic>`) and reaches both by fast-forward once Felix agrees.
- **What may be integrated.** Measured A/B, alternating the variants, with the same metric, at least 3 runs each, and the median better; no visible loss; `npx astro check` with 0 errors; `node scripts/perf/ledger.mjs --check` holding; the gate in PASS. When the laptop is too busy for the gate (Felix's jobs, a game), say so plainly: "gate unconfirmed".
- **One baseline.** `scripts/perf/baseline-win.md`. Numbers from another machine or another day are never compared with these.

### Notes on the machine

- The measuring scripts open Chrome off-screen, never in Felix's way (`SHOW=1` to see it, `HEADLESS=1` for true headless). Don't open visible windows on his machine.
- The active display is 100 Hz (use `DISPLAY_HZ=100`); the GPU is shared with Felix's voice and render jobs (python, ffmpeg, HyperFrames), so check the CPU before measuring and treat a busy machine as no measurement. The gate refuses to run when a blank page holds less than 90% of `DISPLAY_HZ`.
- `http://[::1]:PORT` is the page with its stages in the same process, which is what a deployment without `PUBLIC_STAGE_ORIGIN` gives; `http://127.0.0.1:PORT` runs them in their own process. Measure both when it matters.
