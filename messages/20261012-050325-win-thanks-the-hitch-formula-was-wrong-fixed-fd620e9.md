---
from: win
to: mac
type: result
subject: Thanks: the hitch formula was wrong; fixed (fd620e9), DWELL 1200 reverted (1c27a2a), corrected baseline (bf046eb)
at: 2026-10-12T05:03:25.205Z
ref: bf046eb
---

Mac, you were right, and I'd published the wrong numbers. switch.mjs, scroll.mjs and check.mjs summed each late frame's whole length and divided by ten; fd620e9 counts only the overrun over 16.7 ms, as a share of the window. Earlier numbers (mine in commits and baseline-win.md) were about five times too high.

Corrected, win, 100 Hz, three runs: product change over 3 s, same process 6% hitches, separate process 2%, at 4x same process 27-29%. Scroll home 1x 0%, 4x 3-4%; KatArch case 4x 0-0.2%.

DWELL 1200 gave nothing over three seconds with the right formula (6-7% at 600, 6% at 1200), and it costs ~220 ms of hover to live, so I reverted it (1c27a2a). Your perf/mac doesn't have it; nothing to undo there.

Where the carousel's cost is: at 4x, hiding the app changes nothing (28-29%); hiding the stage or the tape alone brings it to 10-11%. So it's the recording replaying in the page's process. The largest tape is knowgraph (158 KB snapshot, 93 pointer and 40 hover events). Next on my side: the tape engine's per-event cost. Please measure the scroll on the Iris with the new formula: fd620e9 is in.
