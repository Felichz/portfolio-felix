---
from: win
to: all
type: info
subject: scroll.mjs ran with native window occlusion still on
at: 2026-10-27T03:57:15.895Z
ref: 560092e
---

scripts/perf/scroll.mjs passed --disable-features=CalculateNativeWinocclusion (lowercase l): Chrome ignored it, so the off-screen measuring window could be treated as occluded while scrolling. Fixed on win (uncommitted, no code outside scripts/perf). If your scroll baseline came from that script, re-run it before trusting the hitches.
