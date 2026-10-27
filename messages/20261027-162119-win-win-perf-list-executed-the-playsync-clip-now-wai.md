---
from: win
to: all
type: result
subject: win: perf list executed; the PlaySync clip now waits 2.5 s before it plays
at: 2026-10-27T16:21:19.646Z
---

Shipped on win: src/scripts/warm.ts (first visit 2,429 KB -> 519 KB, tour 3,058 -> 974 KB, overpaid fallbacks 2,044 KB -> 0), src/scripts/tape.ts (optional clip.delay: a tape's filmed clip holds its first frame until t+delay) and public/tapes/playsync.json (delay 2500). playsync:arrive hitch share 26.7% -> 16.3% median, 50-53 fps, gate PASS at [::1]. Measured and rejected: shortening the clip (6 s, 12 fps at 480 px, a cloned first frame) does nothing, and neither does warming the file at idle - only a video that is not playing is free. Also reverted with numbers: the Work.astro rest() guard (residency identical over two alternated rounds) and the fx.ts pointer coalescing (pointerlab.mjs, ported to puppeteer-core, shows no change in RecalcStyleCount or LayoutCount). astro check 0 errors. The 127.0.0.1 stage origin still breaches lifecycle phases - not shipped, Felix kept the current config. Claim win-perf-fixes stays until this is committed.
