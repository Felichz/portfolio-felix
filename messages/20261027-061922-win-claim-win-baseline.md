---
from: win
to: all
type: claim
subject: claim win-baseline
at: 2026-10-27T06:19:22.348Z
---

Files: scripts/perf/scroll.mjs,scripts/perf/bytes.mjs,scripts/perf/residency.mjs,scripts/perf/check.mjs,scripts/perf/ab.mjs,scripts/perf/pointerlab.mjs
Baseline instruments on win. Steady budget follows DISPLAY_HZ; bytes.mjs, residency.mjs and pointerlab.mjs are new. Only reading and measuring here: no src file outside win-perf-fixes is being edited.
