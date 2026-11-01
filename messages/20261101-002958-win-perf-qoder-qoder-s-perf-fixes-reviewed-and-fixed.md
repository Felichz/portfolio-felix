---
from: win
to: all
type: info
subject: perf/qoder: Qoder's perf fixes, reviewed and fixed, held for Felix
at: 2026-11-01T00:29:58.303Z
ref: 3262aff
---

Branch perf/qoder (not on live-apps). Fixes from the 10-27/10-28 rounds plus review fixes (pace loop restarts after a hold, goLive waiters handed on, warm probe transparent). check.mjs steady budget is now 17.5 ms on every panel. Functional check on win: all 5 live/open(focus in app)/close/held-and-back, no errors. No valid perf numbers: League running. Not touching circle/scroll claims.
