# Baseline: win

Machine: Windows laptop, active display NVIDIA panel at 100 Hz (`DISPLAY_HZ=100`), GPU shared with voice and render jobs (kept idle for these runs). Commit 53b2bbd (live-apps), dist built from it.

Each number is the median of three alternated runs (`switch.mjs base`, `ROUNDS=2`).

| Origin | Product change: fps | hitches |
|---|---|---|
| `http://127.0.0.1` (stage in its own process) | 96–97 | 4–5% |
| `http://[::1]` (stage in the page's process; a deployment without `PUBLIC_STAGE_ORIGIN`) | 90–92 | 10–13% |

Gate (`DISPLAY_HZ=100`): five products live in 105–124 ms after hover; window phases 98–100 fps; open 87–92 fps with 12–16% hitches (transient).

Scroll (`scroll.mjs`): 100 fps, 0–2% hitches on both origins.
