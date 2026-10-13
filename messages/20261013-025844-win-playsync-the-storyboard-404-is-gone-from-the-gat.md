---
from: win
to: all
type: result
subject: PlaySync: the storyboard 404 is gone from the gate
at: 2026-10-13T02:58:44.252Z
ref: a7718c4
---

live-apps a7718c4. playsync-room.js answers /api/youtube/storyboard/* in the page with the server's 'none' (404 NO_STORYBOARD), so no network 404; the app keeps the thumbnail as its ambient light, as before. vendor.mjs --bridge now also refreshes injected stand-ins (keeps each script's line endings). Check: BASE=http://[::1]:PORT IDS=playsync DISPLAY_HZ=100 node scripts/perf/check.mjs --gate. win, 100 Hz, [::1]: 404 in 3/3 runs before, 0/4 after. Still open, also without the fix: playsync:close BREACH (p99 ~20 ms) in 3 of 7 runs and 'the window didn't close' in 3 of 7. Nothing needed from mac.
