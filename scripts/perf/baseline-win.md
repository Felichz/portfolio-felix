# Baseline: win

Machine: Windows laptop, active display NVIDIA panel at 100 Hz (`DISPLAY_HZ=100`), idle while measured (checked: under 1 s of CPU per 4 s). Chrome headful, off-screen (`scripts/perf/chrome.mjs`). Commit 1c27a2a (live-apps), dist built from it.

Hitch share = the time each late frame runs over one 60 Hz frame (16.7 ms), as a share of the window (fd620e9). Earlier numbers in this file and in commit messages used a formula that counted whole late frames and was about five times too high; these are the measured values.

## Product change (`switch.mjs base`, two rounds per run, alternated, three runs)

| Origin | Window | fps | hitches |
|---|---|---|---|
| `127.0.0.1` (stage in its own process) | 3 s | 292–293 (about 97/s) | 2% |
| `[::1]` (stage in the page's process: production today without `PUBLIC_STAGE_ORIGIN`) | 3 s | 277 (about 92/s) | 6% |
| `[::1]`, CPU 4x | 3 s | 186–192 (about 63/s) | 27–29% |

Worst frames at 4x: 600–650 ms on the fourth click, the cold one. At 1x the worst is 250–280 ms.

Elimination at 4x, `[::1]`, three seconds, the hitch share: the app hidden (`.live-app`) 28–29%: no change. The whole stage hidden (`.stage-frame`): 10–11%. The tape alone hidden (`tape-player`): 10–11%. So the cost in one process is the recording replaying in the page's process. In the trace, the largest tape (KnowGraph, the one the first click lands on) has a 158 KB snapshot, 93 pointer events and 40 hover events; the others are smaller.

`DWELL` 600 against 1200 (reverted in 1c27a2a): no difference at 1x over three seconds (6–7% and 6%). The first-second gain it showed was the boot moving out of the window.

## Scroll (`scroll.mjs`)

| Page | Speed | fps | hitches |
|---|---|---|---|
| home, `[::1]` | 1x | 100 | 0% |
| home, `[::1]` | 4x | 95–96 | 3–4% |
| KatArch case study, `[::1]` | 4x | 100 | 0–0.2% |

## Gate (`check.mjs --gate`, `DISPLAY_HZ=100`)

PASS on the five products (last full run: 12 phases over budget before the window fix; re-run before trusting). Hover to live 105–124 ms at DWELL 600; not re-measured at 1200.

---

# Baseline: win, again — 2026-10-27, commit 560092e

The panel on this machine is a 60 Hz one today, not the 100 Hz one above, so none of these numbers are comparable to that table and none of them should be read against it. Preview is one dual-stack listener (`astro preview --host :: --port 4391`), which is what makes both origins exist at once:

- `http://[::1]:4391` — the stage stays in the page's process. What production does today, `PUBLIC_STAGE_ORIGIN` unset.
- `http://localhost:4391` — `src/scripts/origin.ts` maps localhost to `127.0.0.1`, so every stage gets its own process.

Two instruments changed on the way to this baseline, both of them wrong rather than the site:

- `check.mjs` gated steady phases at a 16.7 ms p99, which is a 60 Hz frame with no room for rounding: 15 phases "failed" at p99 16.8–17.0 with max 50. The steady budget now follows the panel (`max(16.7, VSYNC * 1.05)`).
- `ab.mjs` counted a whole late frame as jank instead of the excess over 60 Hz defined in fd620e9; it was reporting about five times the hitch share.

## Before

Every row is the median of the runs in `scripts/perf/out/base-2026-10-27/`, at the origin named.

| Instrument | `[::1]`, stage in the page | `localhost`, stage in its own process |
|---|---|---|
| `check.mjs --gate` | PASS, 3 runs. Worst phase `playsync:arrive` 43 fps, p99 66.7, max 300, 28.7% in hitches, 69 frames dropped | FAIL, 3 phases over budget: the three closes — LifeUI, LoL Impact, PlaySync — at p99 33.1–33.3 ms and 3.6–4.5% in hitches |
| `switch.mjs` (product change, 1x) | 7% of the second in hitches; worst click 24.1%, worst frame 267–284 ms | 1%; worst click 20.2%, worst frame 217 ms |
| `switch.mjs` (product change, CPU 4x) | 40%, worst frame 817 ms | not run |
| `scroll.mjs` (1x) | 60 fps, 0.2–0.3%, worst gap 317 ms at the intro panel | not run |
| `scroll.mjs` (4x) | worst gaps 183 ms (intro), 149 ms (work→experience) | not run |
| `ab.mjs` steady, 2 rounds x 3 | rest 60 fps/0%, playing 59–60 fps/1%, **change 52–54 fps, 11–14% in hitches, max 292 ms**, over 60 fps/0% | not run |
| `bytes.mjs` | load 451 KB, **first input 2,429 KB (2,270 KB of it images)**, whole tour 3,058 KB | load 451 KB, first input 2,429 KB, whole tour 3,058 KB |
| `residency.mjs` (tour, one live app, window opened and closed, then 90 s idle) | page nodes 908→912, page heap 5→6 MB, iframes 1→5, stage documents 3→7, stage heap 42 MB, 1 page timer callback per second still firing at rest, animations 3→7 | same shape |

The load trace puts 215 ms of the 3.4 s boot in the document parser's forced style-and-layout, and the biggest single frame gap on the page is 1,742 ms at load with two long tasks (171 ms, 374 ms) behind it — that is the first tape mounting its stage.

## First fix: `warm.ts` warmed the fallback, not the candidate

`initWarm` fetched `img.currentSrc || img.src` for every lazy image. An image the visitor has not reached has no `currentSrc`, so it fetched `src` — the fixed fallback of its `<picture>`, which is the heaviest file in the set: `felix-portrait-dark…uLzr3.png` at 1,118.5 KB, against the 21.2 KB AVIF the browser would have chosen for the same box. Twelve of these went out at the first input.

The fix clones each lazy image's `<picture>` — with its `<source>`s, so the browser does the picking — into a 1px, clipped, in-viewport hole, sets it eager and low-priority, and decodes that. It has to be in a document: a detached `<picture>` selects nothing.

Alternated builds, same origin (`[::1]`), same instrument:

| | before | after |
|---|---|---|
| first input | 2,429 KB | **519 KB** |
| of which images | 2,270 KB | 360 KB |
| overpaid fallbacks | 2,044 KB over 12 fetches | **0 KB over 0 fetches** |
| whole tour | 3,058 KB | 974 KB |
| theme toggle | 54 KB | 0 KB — both editions are now warm, so the toggle pulls nothing |

Round 2 and the frame instruments are below, in the after column.

## After

Runs in `scripts/perf/out/after-warm-2026-10-27/`, the same invocations, `[::1]` unless stated.

| Instrument | Before | After | Reading |
|---|---|---|---|
| `bytes.mjs` first input | 2,429 KB | 519 KB | fixed, twice alternated |
| `bytes.mjs` whole tour | 3,058 KB | 974 KB | fixed |
| `bytes.mjs` theme toggle | 54 KB | 0 KB | fixed: both editions are warm before the toggle is asked for |
| `switch.mjs` 1x | 7%, worst click 24.1%, worst frame 267–284 ms | 7%, worst click 22.9%, worst frame 267 ms | unchanged |
| `switch.mjs` CPU 4x | 40%, worst frame 817 ms | 41%, worst frame 800 ms | unchanged |
| `check.mjs --gate`, arrivals | KnowGraph 54 fps/9.3%, LifeUI 57/4.3%, LoL Impact 55/8.9%, PlaySync 42/29.9%, KatArch 60/0.2% | KnowGraph 57/5.6%, LifeUI 59/1.5%, LoL Impact 57/4.8%, PlaySync 42/29.5%, KatArch 60/0.3% | better where the visitor arrives and the picture must be on screen at once |
| `check.mjs --gate` | PASS at `[::1]` (3 runs); FAIL at `localhost`, 3 phases over budget | PASS at both origins. The three closes that breached now read p99 16.8–16.9 ms and 1.1–1.9% (`lifeui:close` was 33.1 / 3.6%) | the breaching phases were all closes: a window shutting over a picture that had to decode first |
| `ab.mjs` steady | rest 60/0%, playing 59–60/1%, change 52–54/11–14%, max 250–292 ms | rest 60/0%, playing 60/0%, change 53/11%, max 275 ms | unchanged. One round: the second was discarded, another process was on the machine while it ran |
| `residency.mjs` | 5 stage iframes and 7 stage documents alive at rest, stage heap 42 MB, 1 timer callback per second | the same: 5 iframes, 7 stage documents, 1 timer per second, page heap 5 MB | not touched by this fix, and not made worse by it |
| `bytes.mjs` at `localhost` | input 2,429 KB, tour 3,058 KB, overpay 2,044 KB | input 519 KB, tour 972 KB, overpay 0 KB | fixed at both origins |

The first-input and tour rows are the same at `[::1]` and `localhost`: 519 KB and about 973 KB at both, against 2,429 KB and 3,058 KB before.

The bytes went down by 2 MB and the frames stayed where they were. That is the honest shape of this fix: the overpaid fetches were low-priority and off the critical path, so they cost wire, not frames. The one place frames did improve is the arrival at a product, where a picture has to be on screen the moment the slide does — KnowGraph 9.3% → 5.6%, LifeUI 4.3% → 1.5%, LoL Impact 8.9% → 4.8%.

## Second and third fixes: the pointer read, and the pause that mounted a stage

`src/scripts/fx.ts` measured the box under the pointer on every `pointermove`; a mouse sends 60 to 120 of
those a second and each read asks for an up-to-date layout. Both handlers now land the move in a slot and
read once per frame. `src/components/Work.astro`'s `rest()` addressed every `tape-player` in a plate to
pause it, and addressing one mounts its stage: the setter posts to the frame, and posting creates it. It
now only speaks to a player that already has a frame.

Runs in `scripts/perf/out/after-fx-2026-10-27/`, two alternations, only these two files swapped, the
`warm.ts` fix in both builds.

| Instrument | Before | After | Reading |
|---|---|---|---|
| `ab.mjs` rest / playing / over | 60 fps 0%, 60 fps 0%, 60 fps 0% | 60 fps 0%, 60 fps 0%, 60 fps 0% | unchanged |
| `ab.mjs` change | 55 fps, 9%, worst frame 200–217 ms, main 28–31% | 55 fps, 9%, worst frame 208 ms, main 28% | unchanged |
| `switch.mjs` 1x, median over all clicks | 7% and 8% of the second in hitches, worst frame 100 ms | 9% and 6%, worst frame 83 and 100 ms | unchanged |
| `check.mjs --gate`, 29 of 30 phases | all ok, `katarch:open` 5.1%, `lolimpact:arrive` 7.7% | all ok, `katarch:open` 3.2%, `lolimpact:arrive` 5.7% | unchanged to slightly better |
| `check.mjs --gate`, `playsync:arrive` | 52 fps, 13.5%, 32 hitched frames | 42 fps, 29.1%, 70 hitched frames | contradicts itself, see below |
| `check.mjs --gate` verdict | PASS | PASS | both |
| `residency.mjs`, what stays alive | load 2 stage documents / 4 MB, first input 3 / 15 MB, end of the tour 5 iframes, 7 documents, 467 nodes, 42 MB | the same to the row: 2 / 4, 3 / 15, 5 iframes, 7 documents, 467 nodes, 42 MB | unchanged, and that is the guard's problem |

The guard exists because the code path is real: `pause()` on a `tape-player` that has no frame posts to it, and posting creates the frame. But the deck never rests a plate that has no stage, because `rest()` is called only for the panel the visitor just left (`src/components/Work.astro:585`, `if (prev !== j) rest(prev)`), and by then that plate has one. So the mount the guard would prevent does not happen on the path any of these instruments walk, which is why nothing moves in the residency column.

The first run of the after side read badly everywhere (26% in the change moment against 9%) and the second
read exactly like the before side, which is the pattern this baseline already established: the first run
after a build is cold and is not evidence. The medians above are over the runs that agree.

Nothing here buys frames. What it buys, if anything, is work that stops happening, and that is a different
instrument: `scripts/perf/out/resid-2026-10-27/` alternates `Work.astro` alone and reads stage documents,
iframes and stage heap at rest. If the guard does not reduce what is alive at rest, it goes. `fx.ts` is
judged the same way: a layout read on a clean tree is nearly free, and if the coalescing shows nothing in
the trace it is complexity for no return and goes too.

The PlaySync line is the one that does not resolve inside this batch. The before build of this batch is the
same code as the after build of the `warm.ts` batch (only the warm fix in place), and that identical code
read `playsync:arrive` at 29.9% and 29.5% there, 13.5% here, while the both-fixed build reads 29.1%. So the
line is bimodal, not a before/after difference: it swings by whether the Windows media stack was already up
in the machine when the run started, which is what the 1,678 ms GPU task is about. `scripts/perf/out/psync-2026-10-27/`
alternates `Work.astro` alone, three times, with only PlaySync exercised, so no other phase touches the
media first, and adds the same run with the stage in its own process. Until that reads one way, the guard is
not charged with making the click costlier, and not credited with anything either.

## What the remaining hitches are

`switchtrace.mjs CLICK=2 STACK=1` at 1x, the 1.4 s around a product change:

- `MediaFoundationVideoEncodeAccelerator::GetSupportedProfiles`, 1,608 ms on a GPU-process COM thread: Windows' media stack initialising itself. Nothing in this repo asks for an encoder (`MediaRecorder`, `captureStream` and `MediaCapabilities` appear nowhere in `src/` or in the vendored apps), so it is Chromium probing codec support when a media element first appears.
- The same shape shows up at load: the gate's blackbox reports a 1,678–1,693 ms gap with no frames on the KatArch slide right after `live:mount:katarch`, in every run of this batch and the last. The mount does pull a video: `bytes.mjs` shows the stage navigating to `/apps/katarch/curso/decision/` (a 23.3 KB document, 12.8 KB of media in the same phase) and that page carries `<video preload="metadata" src="https://…r2.dev/curso/bNN.mp4">`. **That is not what the gap is.** Patching `dist` alone, three states, same build: as shipped 1,678 and 1,693 ms, `preload="none"` 1,678 and 1,676 ms, remote source removed 1,693 ms (`scripts/perf/out/media-2026-10-27/`). The gap does not move at all, and no measured phase is worse around it: `katarch:arrive` reads 60 fps and 0.3% in every one of those runs. So the gap is a window in which nothing needed presenting, not a stall the visitor feels, and the media element is not the cause. The only load-path cost with a name and an owner is the 209 ms below.
- What the filmed clip costs is now measured rather than assumed. `dist/tapes/playsync.json` carries `{"src":"/tapes/playsync.clip.mp4","t":131}`, a 340 KB mp4 that plays as the PlaySync arrival. Same build, same browser, same phase, only that entry removed in `dist`: with the clip `playsync:arrive` reads 41 fps, p99 83.3 ms, worst frame 300 ms, 30.8% of the second in hitches, 74 hitched frames; without it 53 fps, p99 66.6 ms, worst 317 ms, 12.6%, 30 hitched frames. Both PASS, because an arrival is allowed to be the expensive phase. `scripts/perf/out/media-2026-10-27/`. The worst single frame did not improve with the clip gone, so the clip is most of the time spent hitching rather than the deepest hitch, and this is the same 2.4x that the two `Work.astro` gate rows disagree about.
- ~800 `UpdateLayoutTree` records in the window, 209 ms of `LocalFrameView::UpdateStyleAndLayout` on the renderer main thread: the recording replaying its DOM inside the page's own process.
- The same click at `127.0.0.1` (stage in its own process) costs 1% instead of 7%. Today's production has no `PUBLIC_STAGE_ORIGIN`, so it is the 7% case. **This does not survive the gate**: on the same build the isolated sweep at `127.0.0.1` BREACHES four phases that pass at `[::1]` (`katarch:open` 35 fps and 42.3% of the second, `katarch:close` 20.8%, `knowgraph:close` 17.5%, `playsync:close` 8%), and its load gap is 2,368 ms against 1,678 ms. Separating the processes makes the plate change cheap and opening a product expensive, so it is not a switch to throw. `scripts/perf/out/psync-2026-10-27/` alternates `Work.astro` alone and runs both origins per variant, because the missing pre-mounted stage is the common candidate for both effects.

`loadtrace.mjs` on the final build, the load path itself:

- The long task at load is 209 ms of `HTMLDocumentParser::RunScriptsForPausedTreeBuilder` → `Document::UpdateStyleAndLayout` → `Layout` 201 ms: the parser pausing to run a blocking inline script that asks for layout. It is `src/layouts/Base.astro:100`, `stage.scrollTop = panels[i].offsetTop`, the deep-link opener. It reads `offsetTop` (and writes `scrollTop`), so it lays the document out before the parser may continue. It costs 8 ms of its own JS; the other 201 is layout.
- It is not the warm clone loop: the whole JS-by-function list at load peaks at 11 ms (a stage script) and 8 ms (the Work inline script). That closes the question the previous batch left open.
- It only runs when the URL names something to land on. `/#work`, which is how these instruments load the page, triggers it; `/` with no hash resolves to panel 0 and never reads `offsetTop`. So the cost belongs to landing on a deep link, where the read is there precisely so the visitor does not see the intro first. Cheaper is possible (a CSS `:target` rule) but it changes what a landing looks like, so it is a proposal and not a fix.

## What is left, and whose call each one is

Everything in win's lane that the measurements support is implemented. What remains has an owner or a trade-off, and the four are not alike:

1. `PUBLIC_STAGE_ORIGIN` (the stage in its own process). The plate change is genuinely cheaper: 1% of the second in hitches against 7%, and 6% against 41% at four times CPU throttle. But on the same build the full sweep at that origin BREACHES four phases that pass today, and opening a product is the worst of them (`katarch:open` 35 fps and 42.3%). So this is not a flag to throw; it is a real trade, and today's configuration is the one that passes the gate. `scripts/perf/out/psync-2026-10-27/` runs both origins against `Work.astro` alternated, because the missing pre-mounted stage is the common candidate.
2. The filmed clip on PlaySync's arrival. Priced, both ways, same build: 30.8% of the second in hitches with it, 12.6% without, and the worst single frame does not improve either way. The three ways out are to drop the clip from the arrival, to leave it and accept the arrival as the expensive phase, or to bring Windows' media engine up while the page has nothing to do so the click does not pay for it. The first and third change what the visitor sees or when, so they are Felix's. The third is being measured with a hidden video injected into `dist` at idle, no `src` touched (`scripts/perf/out/inject-idlewarm.mjs`).
3. The deep-link opener at `src/layouts/Base.astro:100`, 209 ms of forced style and layout on a landing that names a panel. Cheaper exists only by letting the visitor see the intro first, which is what the read is there to prevent. Not a fix; a proposal, and a small one: it is 209 ms on a link landing, not on `/`.
4. Still in mac's lane, unchanged for sixteen days: `Intro.astro`'s two portraits with no `fallbackFormat` (a 1,118 KB PNG where a 21 KB AVIF fits), and `player.ts`, `live.ts`, `deck.ts` and the stage residency. Exact patches and the numbers went to the channel on 2026-10-27; nothing came back and no claim was released, so nothing was edited here.

## Claims the review list carried, that the measurements do not support

Kept here so they are not re-raised:

- "The app prefetch costs 2.66 MB." The prefetch the first input triggers is 83 KB of JS in the sweep.
- "A theme switch pulls the other edition's video." The media column of the switch phase is 12–14 KB, and after `warm.ts` it is 0: the toggle fetches nothing.
- "`Plate.astro` ships heavy fallbacks." It already passes `fallbackFormat: 'webp'` (line 41). The heavy fallback was `Intro.astro`'s portrait, which passes no `fallbackFormat` at all.
- "`session.ts` leaves a 50 ms watch running." It clears itself when the app's ready selector appears, and the resting reading is 1 timer callback per second (`#restTimer`), not 20.
- "`tape.ts` spins when it has nothing to do." Its scheduler sleeps to the next recorded event (`#schedule`, one timer plus one frame, early by 8 ms); at rest the page schedules 0 frames.
- "`public/felix-andersson-resume-dark.pdf` is dead weight." Nothing links to it, but `resume/build.mjs:23` writes it on purpose as the dark edition of the résumé. It is a build output, not a stray file.
- `warm.ts` clones 112 lazy pictures across the site's 76 pages, at most 18 on one page, and no `<picture>` in the build carries an `id`, so the clones cannot shadow a real element.
- "The fonts are heavy." They are the largest part of the load, 290 KB of its 452 KB, and they are not waste: `public/fonts/` is 288 KB in total, all twelve `@font-face` rules declare `font-display: swap`, and the five faces the load pulls are the five that set text on screen. The heaviest single request on the whole tour is the house face, `archivo-wdth.woff2` at 88.3 KB, which is `--font`: every body line on the site. Deferring it is a visible change, and subsetting it needs tooling that is not in this repo (no `pyftsubset`, no `fonttools`); the face carries a width axis, so its size is the variable range, not stray scripts. Recorded as measured, not as a defect.

## Closing state: what ships, and the final after column

The tree that goes to Felix is `src/scripts/warm.ts` plus these instruments and notes. Nothing else changed behaviour. `npx astro check`: 0 errors, 0 warnings, 42 hints over 88 files.

| instrument | before (HEAD) | after (final tree) | verdict |
| `bytes.mjs` at `localhost` | input 2,429 KB, tour 3,058 KB, overpay 2,044 KB / 12 fetches | input 519 KB, tour 974 KB, overpay 0 KB | ships. 2 MB of wire off a first visit, at both origins |
| `bytes.mjs`, theme toggle and portrait | toggle 54 KB, portrait 1,118.5 KB PNG | toggle 0 KB, portrait 21.2 KB AVIF | ships |
| `check.mjs --gate` at `[::1]` | FAIL (warm fetched the fallback on arrival) | PASS: playsync:arrive 41 fps, p99 83.3 ms, worst 300 ms, 32.5%; lolimpact all phases ok | ships |
| `ab.mjs` steady | change 52-54 fps, 11-14% hitches, max 250-292 ms | 53 fps, 11%, max 275 ms | unchanged, as expected: the overpaid fetches were low priority and off the critical path |
| `residency.mjs` | 5 iframes, 7 stage docs, 467 stage nodes, 42 MB stage heap | identical to the row, two rounds each | unchanged |

Two alternated residency rounds (after, before, after, before) printed the same numbers for every phase - `tour1`, `closed` and `rest:30s` all read 913 nodes, 5 iframes, 7 stage documents, 467 stage nodes, 42 MB of stage heap - so the `Work.astro` `rest()` guard keeps nothing extra alive and sheds nothing that was leaking. It also has no reachable case: `rest()` is only called for the panel the visitor just left (`src/components/Work.astro:585`), and by then that plate has a stage. It went back to what is committed.

`src/scripts/fx.ts` went back too, and it went back with a number this time. Its frames did not move and its residency did not move, so the claim had to be made in work instead of frames: `scripts/perf/pointerlab.mjs` now drives Chrome with the same `puppeteer-core` and `scripts/perf/chrome.mjs` as the rest of the instruments (the first version of it imported `playwright`, which this repo does not have, and that is why the lane closed unmeasured the first time). It sweeps the cursor 400 times across the spotlight plate and then the magnetic button, and reads Blink's `RecalcStyleCount`, `LayoutCount` and `TaskDuration` deltas.

| per move | coalesced, 2 runs | HEAD, 2 runs |
| spot: style recalcs | 3.89 / 3.88 | 3.13 / 2.87 |
| spot: layouts | 0.07 / 0.08 | 0.15 / 0.09 |
| spot: main thread | 5.33 / 5.30 ms | 20.11 / 6.01 ms |
| button: style recalcs | 4.08 / 4.57 | 4.57 / 4.24 |
| button: layouts | 0.09 / 0.09 | 0.07 / 0.08 |
| button: main thread | 4.61 / 5.26 ms | 17.54 / 4.59 ms |

The counters do not separate the two versions. Style recalcs sit between 2.9 and 4.6 per move in both, layouts are a tenth of a move in both, and the only wide gap is main-thread time in the HEAD rounds, which is bimodal: one round reads 20.1 and 17.5 ms per move and the other reads 6.0 and 4.6, so that is the page doing something else, not the handler. A read of an already clean layout costs nothing measurable here, which is what the coalescing was there to avoid. The change is not shipped, on the evidence this time rather than on principle, and the two rejected versions stay in `scripts/perf/out/v-rejected/`.

The gate is load-sensitive, and this time the load was mine. The first full sweep on the final tree (five products, both origins) reported FAIL - 5 phases at `[::1]`, 3 at `127.0.0.1` - with phases that normally hold 60 fps reading 47-58 and `playsync:arrive` at 28 fps with a 916 ms worst frame. I blamed other windows on the machine. That was wrong: the PlaySync batch was still running (06:36 to 06:51), and the pointer lab batch then fired four `astro build` calls straight on top of the sweep I took to confirm it. The final tree is measured again with nothing queued, and it is a PASS at both origins:

| phase | `[::1]`, stage in the page | `127.0.0.1`, stage in its own process |
| katarch:arrive | 60 fps, p99 16.9 ms, worst 17, 0.3% | 60 fps, 0.3% |
| knowgraph:arrive | 57 fps, 33.4, 67, 5.2% | 60 fps, 0.3% |
| lifeui:arrive | 59 fps, 33.2, 34, 2.0% | 60 fps, 0.3% |
| lolimpact:arrive | 57 fps, 17, 133, 5.6% | 58 fps, 3.2% |
| playsync:arrive | 42 fps, 83.4, 217, 30.0% | 44 fps, 50, 167, 26.3% |
| verdict | PASS | PASS |

Two things came out of the batch that had been running. The PlaySync arrival is not something the `rest()` guard damaged or saved: three alternated rounds read 41/41/41 fps and 32.0/32.5/31.1% with the guard, 41/42/40 fps and 32.1/28.7/32.9% without it. The arrival belongs to the clip, and the guard has no share in it. The earlier single-round signal that pointed the other way was noise.

The idle warm is dead. Building a hidden `preload="auto"` video for `/tapes/playsync.clip.mp4` at `requestIdleCallback` in the landing page moves the arrival from 32% to 30.4% and 31.6% in two runs, which is inside the spread of the unwarmed rounds. Fetching the clip early does not help because the cost is not the fetch, it is the decode and the paint while the slide is arriving. Of the three ways out written above, that leaves dropping the clip, shortening it, or accepting the cost.

A method rule for the next batch: a background measurement must not be chained behind another one that is still going, and a batch that swaps source files has to leave them at HEAD, because a queued run that re-applies a rejected variant turns "reverted" back into "in the tree" while nobody is looking. Both rejected files are in `scripts/perf/out/v-rejected/`, and the tree that goes to Felix is `src/scripts/warm.ts` alone.

## The fourth fix: the filmed clip waits for the slide to land

Felix picked "shorten the clip" for the PlaySync arrival, so it was shortened, and shortening turned out to buy nothing. Every variant is the `playsync:arrive` phase at `[::1]`, two runs each, the file changed in `public/tapes` and rebuilt:

| what the clip is | arrival hitch share | fps | worst frame |
| as shipped, 12.4 s, 702x394, 30 fps, 341 KB | 22.2% / 31.1% | 47 / 41 | 300 / 317 ms |
| cut to 6 s | 30.0% / 31.6% | 42 / 41 | 300 / 317 ms |
| 12 fps at 480 px, same 12.4 s | 32.0% / 30.9% | 41 / 42 | 333 / 283 ms |
| first frame cloned for 2.5 s inside the file | 24.2% / 32.0% | 45 / 41 | 317 / 317 ms |
| one frame only, nothing plays | 12.2% / 13.1% | 53 / 52 | 317 / 300 ms |
| no clip at all (the media batch) | 12.6% | 53 | 317 ms |

Halving the duration, dropping to a third of the frame rate and a fifth of the pixels, and pre-fetching the file at idle all leave the arrival where it was. A single-frame video - same element, same box, same source picture, nothing playing - is the one that reaches 12%. The cost is a video that is *playing* while the slide arrives, not the bytes, the length or the frame rate of what plays.

So the delay went into the tape engine instead of the file. `src/scripts/tape.ts` now takes an optional `delay` on a tape's clip, and holds the clip at its first frame until the tape clock reaches `t + delay`; `public/tapes/playsync.json` sets it to 2500 ms. Three runs:

| | before | after |
| playsync:arrive | 26.7% median hitch share, 41-47 fps, worst 300-317 ms | 16.3% median (16.8 / 12.2 / 16.3), 50-53 fps, worst 284-300 ms |
| playsync:open | 2.2% | 2.2% |
| playsync:close | 1.1% | 1.1% |
| gate | PASS | PASS |

What the visitor sees changed, and Felix approved the direction: the plate opens on the clip's first frame and the motion starts about 3.7 s later. Probed inside the stage document, the element reads `paused, currentTime 0, readyState 4` at 1.5 s and at 3.0 s, then `0.94 s` at 4.5 s and `8.52 s` at 12.0 s, so it plays at real speed once it starts. The price is the tail: the demo is 12.4 s long and starts 2.5 s later than before, so the last couple of seconds of it now fall outside the time the tour spends on that slide.

## Round 2: the coordination fixes, measured

The second read-only pass found four defects in the page's own machinery: the warm queue spends its head without warming it, a queued boot is never checked again when its turn comes, a preview is marked live when a timeout runs out rather than when the stage answers, and the stage's pace loop keeps sampling while the app is held. `scripts/perf/queues.mjs` counts each one on a fresh profile per scenario, and `scripts/perf/queues-ab.sh` alternates the builds (after, before, before, after). Every row is two runs per variant at `[::1]`, `DISPLAY_HZ=60`, the machine otherwise idle; raw runs in `scripts/perf/out/queues-{after,before}-{1,2}-*.json`, logs in `queues-ab*.log`.

| what | before | after |
| tape mounts at rest after the visitor's first gesture | 1 of 6 (knowgraph, playsync, lifeui, lolimpact, portfolio never mount); 36 KB of tape fetched | 6 of 6; 614 KB |
| preview marked live before the stage answered (cold hover, 6x CPU) | marked at 7,369 ms, the app answered at 11,406 ms: 4,037 ms live with nothing behind it, and the mark stayed | never marked inside 12 s, and nothing answered after the drop |
| takeover of a hovered preview, cold / warm | 96.3 / 115.9 ms; warm already live | 46.4 / 48.6 ms; warm already live |
| rAF callbacks and timers per second in a held app's stage | 19 and 0.5, both rounds | 0 and 0, both rounds |
| queued boots that started after their preview had gone | 0 in 12 runs, three designs, 6x CPU included | 0 |

The gate on this tree at `[::1]`, five products: PASS, every phase `ok` (`scripts/perf/out/gate-round2-all.log`). `playsync:arrive` reads 50 fps, p99 66.8 ms and 16.4% of the second in hitches, which matches the 16.3% the clip delay was measured at; the other steady phases sit at 59-62 fps and 0.1-4.9%. `npx astro check`: 0 errors, 0 warnings.

**The warm queue was losing previews.** Both events that queue warming (a product turned over, a window closed) also set the clock that makes the page "not quiet", and the queue took its head out before checking. A scroll as the first gesture is enough: the sweep queued six players and mounted one, and the other five had never mounted their tapes after nine seconds at rest. Keeping the head in the queue until it has been handled mounts all six, twice. The cost is the byte column above: 578 KB more of tape JSON and stage documents, which is what the pre-mount was always for. It is a real cost on a first visit and it lands on the idle path, after the visitor's first gesture.

**A preview could be marked live with no app behind it.** On a 6x-slower CPU a cold hover's answer lands after the page's 2.5 s wait. Before, the wait running out marked the preview live anyway: the plate showed `data-live` 4,037 ms before the stage said anything, over a session the drop had already disposed, and the pointermove retry is gated on `state !== 'live'`, so nothing asked again. Now only the stage's word marks it, the wait clears the ask so the next move retries, and the drop aborts the listener so a late word cannot take over a preview nobody wants. A normal takeover is not slower for it: 46-49 ms cold against 96-116 ms before, both far inside the wait the old path allowed, and warm previews already live in both. No visible change on any path where the stage answers at all.

**The pace loop watched held apps.** An app the visitor used stays live while its preview is off the viewport (the slide is still the rendered one) and the page holds it: clock stopped, animations paused. The pace loop, judged on the stage document's own frames, kept sampling 19 rAF callbacks and half a timer per second in that stage, two rounds each way, and it is the loop that can call `#wakeDecorative()`. Now the hold stops the loop and the release restarts it; the same spot reads 0 and 0. The app measured here has no endless animation, so no animation was seen waking (`Animation.play` calls: 0 in both variants): what the fix removes is the sampling, not a measured animation. The renderer column does not support a saving (5.3 and 5.7 ms/s before against 7.2 and 7.2 after) and is noise at this size.

**The queued boot was not reproduced.** The revalidation is in (`queueBoot` asks `visible`, `zooming` and `state` again when its turn comes), and no measurement shows it changing anything: 0 boots landed on a preview that had gone, in 12 runs across three scenarios (clicks at 700 ms, clicks at 350 ms, and a scroll-out under 6x CPU). The chain's turn always arrived while the preview was still wanted, so the guard is untested by measurement on this machine. It stays because it costs nothing measurable (the same number of boots was queued and sent in both variants of every run, 5 or 2 depending on the design) and the path it closes is real in the code; Felix can drop it with no cost to any of the numbers above.

