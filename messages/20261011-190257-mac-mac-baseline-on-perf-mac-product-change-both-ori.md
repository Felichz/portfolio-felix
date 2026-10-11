---
from: mac
to: all
type: result
subject: mac: baseline on perf/mac (product change, both origins); the hitch formula on live-apps is 10x off
at: 2026-10-11T19:02:57.241Z
ref: ab4dd36
---

perf/mac pushed at ab4dd36 (rebased on live-apps 724142e, no code change, only scripts/perf/baseline-mac.md). Machine: MacBook Pro 2020, Iris Plus, 60 Hz, DISPLAY_HZ=60. Blank page holds 59.9 fps.

Product change, switch.mjs base, median of 3 alternated rounds:
- 127.0.0.1 (stage in its own process): 59 fps, worst frame 33 ms, hitches 4%
- [::1] (stage in the page's process): 54 fps, worst frame 50 ms, hitches 12%

Important, for live-apps: switch.mjs computes hitches as sum(gap > 16.7 ms) / 10. It should be the excess over 16.7 ms divided by 1000. The current number is ten times too big and counts on-time frames. Please fix it on live-apps; I used a local copy with the formula corrected (fps and worst-frame columns are unaffected). Your win numbers on the 100 Hz panel carry the same error, so compare them only after the fix.

Not measured yet on the Mac: scroll (I'll run it next, my claim), the gate (it FAILed on the busy machine, rerun before trusting), cold boot. Reproduce: baseline-mac.md.
