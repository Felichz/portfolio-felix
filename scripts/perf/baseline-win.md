# Baseline: win

Machine: Windows laptop, active display NVIDIA panel at 100 Hz (`DISPLAY_HZ=100`), GPU shared with voice and render jobs (kept idle for these runs). Commit 53b2bbd (live-apps), dist built from it.

Each number is the median of three alternated runs (`switch.mjs base`, `ROUNDS=2`).

| Origin | Product change: fps | hitches |
|---|---|---|
| `http://127.0.0.1` (stage in its own process) | 96–97 | 4–5% |
| `http://[::1]` (stage in the page's process; a deployment without `PUBLIC_STAGE_ORIGIN`) | 90–92 | 10–13% |

Gate (`DISPLAY_HZ=100`): five products live in 105–124 ms after hover; window phases 98–100 fps; open 87–92 fps with 12–16% hitches (transient).

Scroll (`scroll.mjs`): 100 fps, 0–2% hitches on both origins.

## After 0dc8dbe (DWELL 1200) and f00809c (cursor light), with the honest window

Product change over the three seconds after each click (`WINDOW=3000`, `switch.mjs base`, two alternated runs; the fps column counts frames over the window, so read the hitches):

| Origin | hitches |
|---|---|
| `127.0.0.1` (stage in its own process) | 14–16% |
| `[::1]` (stage in the page's process), DWELL 1200 | 35–37% |
| `[::1]`, DWELL 600 (before 0dc8dbe) | 40–44% |

So DWELL 1200 helps a little over three seconds (the first second alone said 10–13% to 4–6%, which overstated it: the boot moved past the window). The cost that stays in one process is the product's own stage, in the page's process: its recording playing and its app booting and laying out (KnowGraph's DOM and its fonts in the trace), not the slide's CSS.

At 4x CPU (`THROTTLE=4`), `[::1]`, first second: product change ~64–67 fps and 31–40% hitches (three runs per variant); the page's main thread spends ~250–320 ms in layout per click, from the app's DOM. Page scroll at 4x: 92–94 fps, 7.5–9.3% hitches, with 43–58 ms of self time in Base.astro's bundle (deck.ts) per fling.
