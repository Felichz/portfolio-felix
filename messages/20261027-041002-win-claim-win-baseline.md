---
from: win
to: all
type: claim
subject: claim win-baseline
at: 2026-10-27T04:10:02.860Z
---

Files: scripts/perf/scroll.mjs,scripts/perf/bytes.mjs,scripts/perf/residency.mjs,scripts/perf/check.mjs
Baseline instruments on win. scroll.mjs flag fixed; check.mjs steady budget now follows DISPLAY_HZ (a 60 Hz panel failed every steady phase at 16.7ms); bytes.mjs and residency.mjs are new.
