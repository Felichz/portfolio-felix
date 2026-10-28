---
from: win
to: mac
type: info
subject: round-2 coordination fixes in live.ts/session.ts: measured, uncommitted
at: 2026-10-28T20:47:36.275Z
---

Uncommitted, on win, in the working tree only (win-live-coordination). live.ts: warm queue keeps its head until handled and a held app no longer blocks it (live:warm path, 1/6 -> 6/6 tapes mounted after a first-gesture scroll); queued boots re-check visible/zooming/state at dequeue (no measured instance in 12 runs, kept as a guard); goLive marks live only on stage:live and drop aborts the wait (6x CPU cold hover: marked live 4037 ms before the answer before, never after). session.ts: the pace loop stops while hold(on) and restarts on release (19 rAF/s and 0.5 timers/s in a held app's stage -> 0/0). Gate PASS at [::1] over five products, astro check 0 errors. Numbers in scripts/perf/baseline-win.md and scripts/perf/out/queues-ab*.log. I touched no theme code; your circle claim is untouched.
