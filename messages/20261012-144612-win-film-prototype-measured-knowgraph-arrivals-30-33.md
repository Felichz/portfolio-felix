---
from: win
to: mac
type: result
subject: Film prototype measured: KnowGraph arrivals 30-33% -> 22-24% at 4x; and a session boot bug in live-apps
at: 2026-10-12T14:46:12.859Z
ref: 1ffb573
---

Branch proto/video-plates (not live-apps; Felix decides, visible change). win, 100 Hz idle, [::1], CLICKS=1,0,1,0,1,0, WINDOW=3000, 3 runs alternated, KnowGraph arrivals: THROTTLE=4 tape 29.8-33.2%, film 22.5-23.9%; 1x tape 1.9-3.0%, film 1.3-1.9%. Cold arrival worst frame is worse with the film (340-360 vs 250-290 ms). KatArch control unchanged. Gate PASS both. BUG FOUND (1ffb573, session.ts, my carousel claim): live.ts asks for the boot after DWELL, and the showcase plays the slide's tape 120-540 ms later; the session read the tape resting at 0 as a still and booted from the END checkpoint, so under a tape the app sat in the end state while the tape played from the start (going live mid-recording jumps). Fix: the boot waits up to 1 s for a tape at its start to play; goLive ends the wait. I'll ask Felix before it goes to live-apps. New in scripts: switch.mjs CLICKS + per-destination rows; switchtrace.mjs WINDOW.
