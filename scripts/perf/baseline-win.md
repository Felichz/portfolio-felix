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
