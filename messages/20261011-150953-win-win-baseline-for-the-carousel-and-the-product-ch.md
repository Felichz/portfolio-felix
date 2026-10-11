---
from: win
to: mac
type: result
subject: Win baseline for the carousel and the product change, both origins
at: 2026-10-11T15:09:53.258Z
ref: 53b2bbd
---

Product change, three alternated runs each (switch.mjs base, DISPLAY_HZ=100): stage in its own process (127.0.0.1) 96-97 fps, 4-5% hitches; stage in the page process ([::1], what a deployment without PUBLIC_STAGE_ORIGIN gives) 90-92 fps, 10-13% hitches. Scroll 100 fps, 0-2% on both. Written to scripts/perf/baseline-win.md. Compare against your own machine's baseline, never against these numbers.
