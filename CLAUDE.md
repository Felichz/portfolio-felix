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

## Deciding trade-offs

Before taking a choice to Felix, check it against these and decide when they settle it; ask only what they leave open, and add his answer here.

- **What gets the frames.** Modest machines count (`--throttle 4`) for the scroll, the carousel and the projects; the window and the theme come after. Where frames clash with something Felix chose, his choice stays and the frames go. So the window keeps its view transition (the transform alternative measured worse anyway) and its 70 to 100 ms at 4x is accepted.
- **Felix's other apps.** Their code may be changed (said 2026-11-03): his own repos in `~/dev` (`../rave2-embed`, `../life-ui-embed`, `../katarch`, `../LoLImpact`, ...), never the employer's (`seekr`, `design-system`). A change there goes on a branch of that repo, measured here with the app vendored again, and reaches its main branch with Felix's OK, like here.
- **Costs paid once per browser** (said 2026-11-03): accepted, unless they land at load or on the first interaction. Heavy work isn't moved to the arrival to save it later: the arrival is a first impression for every visitor. So the GPU's first shaders on a first visit to PlaySync (450 ms in an empty profile, 1.2 s after arriving at the product, while its recording plays) stay.
- **Infrastructure** (said 2026-11-03): may be added when it serves this work, such as a second hostname of this same Vercel project for the stages (`PUBLIC_STAGE_ORIGIN`). The apps' own deployments (`katarch.vercel.app`, ...) don't serve as stages: the stages need the vendored builds with the bridge, on the stage's own origin. Pending (2026-11-03): the alias isn't set (the Vercel CLI here isn't logged in, and logging in is Felix's), and before `PUBLIC_STAGE_ORIGIN` goes to production the rare long stall closing the window with the stages out of process (1,370 ms once at 4x) needs more runs: `HOST=127.0.0.1 node scripts/perf/freezes.mjs --cycles window --n 8 --throttle 4`; 3 runs on 2026-11-03 didn't show it.

## How the work runs

One instance works here, on Felix's Windows laptop. Until 2026-11-02 a second one ran on his Mac and the two talked through `scripts/coord/coord.mjs` on the `coord` branch; the Mac is retired, the channel is history (its old claims hold nothing), and checking it is optional.

- **Branches.** `main` is production. `live-apps` is the integration branch and follows `main`; work goes on a branch of its own (`perf/<topic>`) and reaches both by fast-forward once Felix agrees.
- **What may be integrated.** An A/B with `scripts/perf/drops.mjs --ab` (late frames counted by Chrome, alternated, with a p-value) on the cycles the change touches, at normal speed and at `--throttle 4`: better where it aims (p < 0.05) and not worse elsewhere. No visible loss; `npx astro check` with 0 errors; `node scripts/perf/ledger.mjs --check` holding. The gate (`check.mjs --gate`) still runs as a smoke test; `lifeui:close` breaches it at every commit since at least 560092e (2026-11-02), so that breach alone says nothing. When the laptop is too busy to measure (Felix's jobs, a game), say so plainly: "unmeasured".
- **Work is not frames.** The ledger counts work; it found savings on 2026-11-02 that moved no late frame. Report a change by what `drops.mjs` says, and the ledger's counts only as where the work went.
- **One baseline.** `scripts/perf/baseline-win.md`. Numbers from another machine or another day are never compared with these.

### Notes on the machine

- The measuring scripts open Chrome off-screen, never in Felix's way (`SHOW=1` to see it, `HEADLESS=1` for true headless). Don't open visible windows on his machine.
- The active display is 100 Hz (use `DISPLAY_HZ=100`); the GPU is shared with Felix's voice and render jobs (python, ffmpeg, HyperFrames), so check the CPU before measuring and treat a busy machine as no measurement. The gate refuses to run when a blank page holds less than 90% of `DISPLAY_HZ`.
- `http://[::1]:PORT` is the page with its stages in the same process, which is what a deployment without `PUBLIC_STAGE_ORIGIN` gives; `http://127.0.0.1:PORT` runs them in their own process. Measure both when it matters.
