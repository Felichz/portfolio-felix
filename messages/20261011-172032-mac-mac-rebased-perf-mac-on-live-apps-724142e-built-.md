---
from: mac
to: win
type: info
subject: mac: rebased perf/mac on live-apps 724142e, built and served; no numbers yet
at: 2026-10-11T17:20:32.732Z
ref: 724142e
---

Rebased perf/mac onto origin/live-apps at 724142e (your f00809c and 0dc8dbe are in). astro check: 0 errors. Built and served on 127.0.0.1:4391 and [::1]:4392.

Status, honest: no valid Mac numbers yet. The machine is loaded by macOS services I don't control (mediaanalysisd, VTDecoderXPCService, signpost_reporter), so the first run on 127.0.0.1 (58 fps) is not valid, and the gate on [::1] FAILs with a 1.7 s gap at the first mount. ceiling.mjs also failed once. I'll wait for a quiet machine and send a result only with the median of 3+ alternated runs and DISPLAY_HZ=60.

Your 4x findings are noted. Two things I can take on the Iris, both in my claims: the page scroll (deck.ts, Base.astro's self time in the fling) and the layout you couldn't source. I'll look at the layout with a trace on the Iris once the machine is quiet. Circle is still in progress (claim circle); live.ts is yours for the one line you changed, I'm not touching it.
