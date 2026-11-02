# Measuring the showcase

How to measure the frames of this site, and the numbers to compare against. The rule is one metric, alternated builds, and a machine that is not busy.

## Method

- **A/B, alternated.** Run variant A, then B, then A again. Two alternations and two rounds per run is the minimum; compare medians. Never compare a number from one run against a number from another day.
- **Same metric.** switch.mjs counts the page's own animation frames for the second after each product change. scroll.mjs does the same for a fling. The gate reads the live preview phases. They are not interchangeable: fps from switch.mjs is not the compositor's draw count (switchtrace.mjs gives that).
- **The display sets the ceiling.** A blank page holds the panel's refresh rate when the machine is free. Set `DISPLAY_HZ` to it (240 by default; 100 on this laptop, where the NVIDIA panel is active). The gate refuses to run when a blank page holds less than 90% of it.
- **Two origins, two pictures.**
  - `http://127.0.0.1:PORT` (the local default): stages load from `localhost`, a different site, so each runs in its own process. This is the best case.
  - `http://[::1]:PORT`: the page's own origin, so stages run in the page's process. This is what a visitor gets on a deployment without `PUBLIC_STAGE_ORIGIN`.
- **Attribute before you change.** switchtrace.mjs (CLICK, FLING, THEME, LABEL, JS, COUNTS) splits the renderers, names the JavaScript, and counts the style work. Remove a cost by injected CSS first, measure, and only then change the code.
- **One display.** The off-screen window lands on whichever display its position falls on. On 2026-11-02 a 240 Hz display came up on the laptop's Intel GPU next to the NVIDIA 100 Hz panel mid-run, and the frame counts per step jumped (225 to 330): runs from before and after a change of displays don't compare. An A/B alternates, so it holds within itself.
- **Close what competes.** League, Riot clients or any game left running make the numbers about the game. If the gate says the machine is busy, close it and run again.

## Late frames, counted by Chrome: the first measure

`drops.mjs` counts what the visitor sees. Chrome's compositor reports every frame it meant to show (`PipelineReporter` in the trace): shown, shown in part (the compositor drew on time without the main thread's update) or dropped, whether that hurt smoothness, and how long each stage took. A cycle (`window`: open and close; `scroll`: down and up; `product`: next and back) repeats N times on a fresh page and each step is traced alone. With `--ab` two builds alternate in blocks and each step gets a permutation test: `p < 0.05` is a real difference, anything else is noise. `--throttle 4` slows the CPU (the GPU stays), which is what a modest laptop does and what makes a main-thread cost stand out. `--why` also traces the main thread and says what it did in the late frames (script by source line through a build with maps, style, layout, paint); it costs the page something, so count without it and explain with it.

```bash
npx astro build --outDir scripts/perf/out/dist-a                     # one folder per variant
node scripts/perf/drops.mjs --cycle window --n 10 --throttle 4 --ab scripts/perf/out/dist-a dist   # about 4 min
SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps
DIST=scripts/perf/out/dist-maps node scripts/perf/drops.mjs --cycle window --n 4 --throttle 4 --why
```

How it was checked, on win, 2026-11-02, the machine free:

- **A/A.** The same build against itself, 10 cycles: no difference (open p = 0.74, close p = 0.09).
- **A known cost.** 12 ms of busy work in each frame for 600 ms after each step, in one build only: 5 late frames a step became 28, p < 0.001, both steps, and the cause read as the main thread.
- **A regression the gate reported.** The gate breaches `lifeui:close` at HEAD, and the baseline of 2026-10-27 had it passing, so the close looked worse since 560092e. `drops.mjs` with `ID=lifeui` says 560092e and ef45156 close the same (11.6 and 10.6 late frames, p = 0.5), and the gate on 560092e breaches the same phase twice. There was no regression: the passing run sat at p99 16.8 ms against a 17.5 ms budget.

What it found on that day (ef45156 against 7e4877b, 10 cycles each): at 4x throttle the close went from 50 to 44 late frames a step (p = 0.02); open, scroll and product change showed no difference at either speed. Product change is the noisiest cycle (18 to 133 late frames a step at 4x): read it with more cycles. `--why` on the close at 4x: about 283 ms of style recalculation and 144 ms of paint a step in the late frames against 35 ms of script, so the close is rendering work, not JavaScript.

Read before trusting a count:

- **Warm profiles.** Each build keeps a browser profile of its own in `scripts/perf/out/profiles/`, warmed by one unmeasured cycle the first time. In a fresh profile the GPU compiles its shaders on first use (`GrShaderCache::store` in the GPU process): the first change to PlaySync dropped 33 frames cold and 7 warm. A visitor pays that once in their browser's life, not once a visit, so the counts are warm by default; `--cold` measures the other case. With warm profiles the product change went from 2 to 39 late frames a step to 5 to 8.
- **One process.** A frame from another site (YouTube inside PlaySync) has its own renderer and compositor; the count reads the page's process only, found by its main frame's id in the trace.
- **A late frame with an idle main thread.** When the page's frames are dropped while its main thread is idle, look at the GPU process (`CATEGORIES=gpu,viz`, `KEEP=1`) and at `DisplayDamageTracker::HasPendingSurfaces`: the page's frame can be waiting on a frame from another process.
- **Price before changing.** `INJECT=css:...` with `INJECT_ONLY=b` takes a cost away in one build: the rail's color transitions on a product change priced at nothing (p = 0.94), and a change of design was not made for them.

Fixed with it, 2026-11-02 (A/B, 10 cycles a step, warm):

- **PlaySync's YouTube frame waited for.** Shown as the app booted under its tape, the YouTube frame made the page's frames wait on its own first one while its process evaluated the player (70 ms): the change to PlaySync dropped 6.7 frames a step, 1.3 with the frame held unseen until the app goes live (p < 0.001); going live, 4x and the way back unchanged. (`scripts/apps/bridge.js`, `session.ts`.)
- **KnowGraph's video on every frame.** Its page checked the clock on every frame for as long as the preview was up (100 frames a second, a frame drawn for each), and kept playing off screen. On the bridge's clock events and the video's own progress instead: opening the window 17.4 to 11.0 late frames at 4x, closing 15.6 to 6.6, both p < 0.001 (normal speed 2.2 to 1.2 and 2.1 to 0.7). (`scripts/apps/knowgraph-video/`.)
- **Tried and dropped.** Flying the window as a scaled box (a transform) instead of the browser's width and height: opening got worse at 4x (17.6 to 22.5, p = 0.008).
- **The window's flight length** moved from a custom property on the root (which restyled the whole page each way) into CSS per direction: closing 4.1 to 3.0 late frames at 4x (p = 0.04).

What is left, normal speed, warm, 4 cycles each (`--cycle product` from each product): KatArch to KnowGraph 1, KnowGraph to PlaySync 1, PlaySync to LifeUI 4 to 5, LifeUI to LoL Impact 4 to 9 (30 the first time), LoL Impact to this site 8 to 11, this site to KatArch 5. Where it was looked at, it is the next product's app booting under its tape: LoL Impact's own script and layout (73 layouts, 39 ms), and this site booting inside itself (three first layouts of 21, 27 and 33 ms). When an app boots is a choice about what the visitor sees, so it is Felix's; at 4x CPU the change to PlaySync keeps about 28 late frames, most of them PlaySync's own code.

## Freezes, one by one

A count of late frames says how often the page stutters; a single freeze of 80 ms is what a visitor feels, and each has a cause of its own. `freezes.mjs` runs the same cycles (`window`, `product`, `scroll`, `theme`, `live`), finds every run of late frames of `--min` ms or more (30 by default) and writes a dossier for each, from one trace with everything in it:

- the stage that held the frames, and how many were dropped or drawn without the main thread's update;
- the page's main thread: each task over the freeze, split into script (its `src/` line through the build's source maps, or the first of the page's functions under a timer or an event), style (elements, and what invalidated them), layout (dirty and total objects, and who forced it), paint, GC, parsing; and V8's own CPU samples in the window, by function;
- other processes: a frame from another site busy, the display compositor waiting on its surface; the GPU process (shaders compiled, raster, composition, video);
- the page's marks around it (`live:<app>:<stage>`, `live:mount:...`);
- a verdict, and the trace saved in `scripts/perf/out/freezes/` to open in DevTools at the time given.

Then the freezes grouped by cause over the repetitions: a cause in 4 of 4 is the page's, one in 1 of 4 may be the machine.

```bash
SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps
node scripts/perf/freezes.mjs --cycles theme,product --n 4            # about 3 min a cycle
INJECT=freeze:120 node scripts/perf/freezes.mjs --cycles window --n 1  # a known freeze, to check it is found
```

The tracing it needs (stacks, V8 samples, invalidations) costs the page something: its milliseconds run a little high, the causes don't change (`--light` drops the invalidations). Checked on win, 2026-11-02: a 120 ms freeze injected 200 ms into each step is found in every step and named, `script TimerFire at injectedFreeze`, with V8's samples on `injectedFreeze`.

Found with it, 2026-11-02:

- **Theme switch and product change: `deck.ts` `glow()`.** It read the section's glow colors right after the theme or the product changed (a forced restyle of the whole page, about 650 elements) and wrote them as custom properties on the root, which restyled the whole page again: four full restyles in the theme switch's first frames. Written instead on the elements that draw with them (`[data-glow]`): the theme switch at 4x CPU, the way back 18.5 to 11.4 late frames (p = 0.003), and no freeze of 30 ms or more left in 4 theme cycles (6 before). Colors checked identical on the four elements, at load, product change, theme switch and on About.
- **Tried and dropped:** reading the toggle's position first in `switchTheme`, before its writes: no better, the way back a little worse (0.9 to 2.2 late frames, p = 0.04).
- **Its own artifact, removed.** Starting the trace starts V8's sampling profiler, a 25 ms task (`CpuProfiler::StartProfiling`) that showed as a freeze on the step's first frames. Each step now waits 300 ms after the trace starts and leaves a `perf:act` mark; frames before it don't count.

What is left, 2026-11-02, warm, 4 repetitions a step:

- **Normal speed:** 2 freezes in 36 steps, both 1 in 4: PlaySync's own code booting (50 ms) and a paint (30 ms). Scroll, theme, closing the window and going live have none.
- **4x CPU, freezes of 50 ms or more:** opening the window (3 of 3, 90 to 190 ms) is one restyle of the whole page, about 700 elements: `startViewTransition` itself restyles the whole document (653 elements with nothing named and nothing else changed, measured alone), so it stays while the window opens as a view transition. Its cost is not the selectors: Chrome's selector stats (`disabled-by-default-blink.debug`) put matching at 0.8 ms of a 20 ms restyle; the rest is computing ~650 styles. The theme switch restyles the whole page by nature (every color changes). Product changes: PlaySync's own code, and `glow()` reading the colors after the product changed (`deck:refresh`), now passed by Work from the slide's own style instead (normal speed, the change to PlaySync 1.2 to 0.2 late frames, p = 0.003; gone from the 4x freezes). Then, with the product cycle pointing and clicking as a hand does (the pointer over the rail item first, which prepares the slide):

- **The rail's count** changed its text on every product change, and a text change laid the page out again from the root (32 ms at 4x). Its numbers now sit on one another and only the current one shows: pixel for pixel the same.
- **The page went to the next section on its own.** A recording typing into PlaySync under its tape focused the field, and a field focused in a frame scrolls every scroller above it, the deck included: the page jumped to Experience while the visitor was on the showcase (3 of 3 runs). `focus({ preventScroll: true })` in `session.ts`: 0 of 3. The product cycle failing was how it showed.
- **A slide prepared in the middle of a scroll.** The rail's items pass under a resting pointer as the deck moves, and each one entered asked for its slide's preparation (it can mount the recording: a new document's first layout, 22 ms), in the first frames of the scroll. `preraster` and the sweep now wait while the deck moves: with the pointer on the rail, 2 preparations during 3 scrolls before, none after.
- **The whole-page restyles, made smaller.** `startViewTransition` restyles the whole page to capture it, and a theme change restyles it all by nature. On a desktop the deck shows one section at a time, so while a preview's window is open or the theme switches the other sections (a third of the elements) take `content-visibility: hidden`, and catch up after (never while the deck moves: `data-moving`). Theme switch at normal speed 2.1 to 1.0 late frames (p < 0.001), at 4x 17.5 to 14.7 (p = 0.002) and the way back 10.1 to 8.8 (p = 0.018); opening the window at 4x 12.5 to 9.0 in one A/B (p = 0.04), 11.0 to 9.7 in the next (p = 0.1), its freezes 90 to 190 ms before and 70 to 100 ms after; closing and scroll unchanged.
- **First visit only: the GPU's shaders.** In a fresh profile the first change to PlaySync froze 450 ms while the GPU compiled 39 shaders as PlaySync's app drew for the first time, and the first window opening 167 ms (10 shaders). Chrome keeps them on disk, so a visitor pays this once in their browser's life. Only drawing the app before the visitor reaches it would take it off the visit, which means booting it sooner: Felix's call.
- **The apps' own code, on the page's thread.** Each app's boot, the replay of its recorded actions (`session.ts` follow: one action a turn already, the time is the app answering it) and its first drawing run on the page's main thread, because the stages share the page's process (production has no `PUBLIC_STAGE_ORIGIN`). Measured with the stages in their own process (`HOST=127.0.0.1`, stages from localhost), 4x CPU, 4 repetitions: product change 12 freezes each way down to 6, the longest on the way there 140 ms down to 80; opening the window 8 down to 5. Against it, closing the window froze once for 1,370 ms: the display compositor held the page's frame (`kDrawThrottled`, 138 frames) waiting on the stage's new surface at the plate's size, which the stage, given 6 begin-frames in that time, didn't draw. Taking the stages out of the page's process needs a second origin in production and that stall understood first: Felix's call, with these numbers.
- **Tried and dropped:** preparing a slide in two turns (the slide, then its recording's document once idle): no better (p 0.17 to 0.83).
- **Tried and dropped:** `content-visibility: auto` on the sections not on show (no difference anywhere: the ones next to it are near enough to render anyway); the slides without `content-visibility: hidden` (much worse: 27 to 53 late frames a change at 4x, p < 0.001).

Left, all cycles at normal speed, 4 repetitions: 2 freezes of 30 ms in 36 steps, each 1 in 4 (the GPU compiling shaders on first use while the window opens, and the scroll's one above, since fixed). At 4x what is left is rendering that has to happen somewhere: the slide and its recording laid out when it is prepared or shown, each app's own code as it boots and replays, and the whole-page restyle `startViewTransition` makes.

Earlier candidate, measured: the new slide's layout on a product change (10 dirty objects of 829, 28 to 32 ms at 4x, every time): inactive slides are `content-visibility: hidden`, so each is laid out as it shows, a trade against the rest of a change's work.

## The work ledger: where the work goes

The ledger counts work, not late frames, and the two don't match: on 2026-11-02 it showed 80 frame callbacks and a third of the deck's forced styles gone, and the late frames didn't move, because that work sat in frames that were on time. Use it to find and rank work, and to hold the invariants; judge a change by `drops.mjs`.

Frame rates move with the machine's load, so they need a free machine, alternations and medians. The work behind them doesn't: styles recalculated and on how many elements, layout objects walked, paints, script time, style and layout forced from script, and the frames and timers the page asks for. `ledger.mjs` counts that per scene (load, to-work, idle-work, hover-live, use, next-product, theme, open-window, close-window, scroll, idle-live) from Chrome's own trace, takes a CPU profile, and maps the script back to `src/` through a build with source maps. Eleven scenes run in about half a minute, and a busy machine changes the milliseconds, not the counts (except the frames an animation asks for: see Invariants).

```bash
SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps     # a build whose scripts map to src/
node scripts/perf/ledger.mjs --tag before --repeat 3                 # table per scene + where the work goes
node scripts/perf/ledger.mjs --compare scripts/perf/out/ledger-before.json scripts/perf/out/ledger-after.json
```

- **What it prints.** Per scene: busy, script, style, layout and paint ms (this machine's), then the counts. Then the hottest functions and files over all scenes (native calls charged to the script that made them), the forced style and layout with the function that forced them, who asks for frames and timers, and the totals by document (the page, each stage, each app).
- **What repeats.** Scenes at rest or under a steady hand (idle-live, idle-work, scroll, hover-live, close-window) give the same counts run after run. Scenes that load something (to-work, next-product, theme, open-window) move with when a tape or an app finishes arriving: three runs, and the comparison takes each count's least, the work the scene can't do without. Read those as a range, not a verdict.
- **What it counts.** The page's own process: the page, its stages and their apps. A frame from another site (the YouTube player inside PlaySync) runs in a process of its own; it costs the page nothing and is left out.
- **Each scene checks itself.** A scene works on what the one before left, so one that did nothing (the arrow key went to the app the window left focused, the click missed a button the tilt had moved) would count another interaction. Each says what it must have done (the window open, the deck moved down and back, the theme changed) and the run fails if it didn't.
- **A/B.** Build each variant into its own folder (`DIST=` picks it), run each with `--repeat 3`, compare. A change of 10% or more is marked.
- **Then the frames.** The ledger finds and ranks the work; `drops.mjs` says whether the frames changed.

### Invariants

`scripts/perf/invariants.mjs` holds what the ledger must keep true: at rest a live preview paints and lays out nothing and only the cursor light asks for frames, the pace loop asks no frames for an app without endless animations, the deck forces one layout per frame at most, and ceilings on the scenes that load. `--check` runs the scenes twice, takes each count's least, prints a line per rule and exits 1 if one breaks. A broken rule names its scene and count; the full ledger (without `--check`) says who asked and who forced.

```bash
SOURCEMAP=1 npx astro build --outDir scripts/perf/out/dist-maps
node scripts/perf/ledger.mjs --check                                  # about 70 s
node scripts/perf/ledger.mjs --check scripts/perf/out/ledger-x.json   # the rules over a ledger already taken
```

Checked on win, 2026-11-02: three runs in a row hold at HEAD; with the pace loop's fix (5b45945) undone, 11 rules break. When a change lowers a count for good, lower its rule in the same commit.

What doesn't hold apart from the load: while something animates, the frames asked for follow the frames the machine draws (the same deck scroll asked 29 frames on the loaded laptop and 94 on the free one), and so does anything done once a frame. Rules on an animation count per frame asked, or who asks; only rules at rest count frames.

## One machine

The numbers here are win's (Felix's laptop), against `scripts/perf/baseline-win.md`; a number from another machine is never compared with them: the displays, GPUs and loads differ. (Until 2026-11-02 a second instance measured on a Mac with its own baseline.) `node scripts/perf/ceiling.mjs` shows what a blank page holds on a screen: set `DISPLAY_HZ` to it.

## Running the scripts

- **No window in the way.** Every script opens a real Chrome window (not headless: headless has its own compositor and timing), placed off every screen. Checked on win: a blank page and the site hold the panel's 100 fps off-screen, and the page reports itself visible. `SHOW=1` puts the window on screen; `HEADLESS=1` runs true headless, whose numbers are not comparable with the rest. On macOS a window may not be allowed fully off-screen: check that nothing shows, and that a blank page still holds the panel's rate (`ceiling.mjs`).
- **Look past the first second.** `switch.mjs` counts the second after a click by default. A preview's app boots 1.2 s after its slide arrives, and its recording keeps playing after that, so `WINDOW=3000` is the honest window for a product change: a change that only moves a cost out of the first second shows there.
- **A modest machine.** `THROTTLE=4` (switch.mjs, scroll.mjs, switchtrace.mjs) slows the CPU 4x. A 100 Hz panel and a fast CPU hide what a visitor on an ordinary laptop feels.

## Commands

```bash
node scripts/perf/switch.mjs base            # product change, `ROUNDS=2`; `BASE=` picks the origin
node scripts/perf/scroll.mjs                 # slow scroll down, fling up
DISPLAY_HZ=100 node scripts/perf/check.mjs --gate   # live previews, frame budgets
THEME=1 node scripts/perf/switchtrace.mjs    # the theme wash, by phase
FLING=1 node scripts/perf/switchtrace.mjs    # the fast scroll, by renderer
node scripts/perf/loadtrace.mjs              # the page load's long tasks
node scripts/perf/themeprof.mjs              # the theme toggle's CPU profile
```

## Baseline

Measured 2026-10-10, `dist` built from commit 1f72444, the laptop's 100 Hz panel active.

| Measurement | Same process as the page (`[::1]`) | Stages in their own process (`127.0.0.1`) |
|---|---|---|
| Product change, fps in the second after a click | 89–91 | 96–98 |
| Product change, share of the second in hitches | 17–18% | 3% |
| Scroll, slow down | 100 fps, 0% | 100 fps, 0% |
| Scroll, fast fling up | 98–101 fps, 0–3% | 99–100 fps, 0–2% |
| Gate, arrive | 96 fps, 5.5% hitches | 99 fps, 1.7% |
| Gate, hover | 93 fps, 10% | 100 fps, 0% |
| Gate, use, open, window, close | 100 fps, 0% | 100 fps, 0% |
| Gate, hover to live | 299 ms | 290 ms |
| Gate result | PASS | PASS |

Open, known costs in both: the first boot of a product's app (KatArch on the gate) blocks the page for about 1.7 s, and the theme wash's covered frame runs 100 ms or more under the veil. Neither is fixed.

Earlier reference, on the 240 Hz panel, before the containment: product change 36–43 fps with 71–80% of the second in hitches at HEAD; 100–160 fps with 20–30% after the containment (it is the same measure on a different panel, so compare it only with itself).

## Found by elimination (same-process origin, 2026-10-10)

Product change on `[::1]`, injected CSS, two alternations of two rounds each (switch.mjs). Median fps and share of the second in hitches:

| Variant | fps | hitches |
|---|---|---|
| base | 90 | 14–16% |
| `.stage-frame` hidden (`display: none`) | 100 | 0% |
| `.stage-frame` hidden (`visibility`) | 96 | 9% |
| `tape-player` hidden | 100 | 0% |
| `.plate` shadow off | 91 | 14% |
| `.slide-media` transition off | 90 | 15% |
| `.ambient` / cursor glow off | 88 | 19% |

So the cost of a product change in one process is the product's own stage: its tape playing and the app booting under it, both on the page's main thread (the trace attributes ~100 ms of JavaScript in the second, all in the app's bundle). The slide's CSS isn't it.

- **DWELL 300 instead of 600** (the app boots sooner): worse on the product change, 86–87 fps and 15–20% against 90–91 fps and 12–14%, three alternations each. Rejected. It would only shorten the hover to live by about 50 ms.
  The gate on the same origin, three alternations, IDS=lifeui: hover to live 299, 318, 362 ms at 600 against 318, 304, 358 ms at 300 (no median gain), and the hover phase's hitches 5.5–6.2% at 600 against 5.6–9.7% at 300. Rejected on both.
- **Window opening and scroll** show no cost on this 100 Hz panel: scroll holds 100 fps with 0% hitches at both origins, and the gate's window phases hold 100 fps with 0%. Nothing there to eliminate here.

Left for a decision, because each changes something visible: play the tape only after the app is booted, or boot the app later than the second after a click (a longer DWELL trades the hover to live for a calmer click).
