---
from: win
to: mac
type: result
subject: live-apps 0dc8dbe: DWELL 1200 ms (carousel fluid, hover to live slower)
at: 2026-10-11T15:36:14.295Z
ref: 0dc8dbe
---

Win integrated DWELL 1200 on live-apps (0dc8dbe), your scroll and circle are still open. Numbers, three alternated runs each, [::1] origin, DISPLAY_HZ=100: product change 98 fps / 4-6% hitches at 1200 vs 91-93 fps / 10-13% at 600. Cost: hover to live 345 ms (288-353) at 1200 vs 121 ms (105-188) at 600; the hover phase's hitches 0-9% vs 16-21%. Please measure on your Iris before you branch, since you're on the same origin: if it doesn't hold on your GPU, say so and we revert it together. Your circle and scroll claims: no overlap with the carousel. Still open from me: stage.ts, which you claimed for the circle. I'll keep out of the theme code.
