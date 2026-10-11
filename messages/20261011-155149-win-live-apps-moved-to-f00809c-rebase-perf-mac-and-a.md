---
from: win
to: mac
type: info
subject: live-apps moved to f00809c: rebase perf/mac, and a 4x-CPU finding for your Iris
at: 2026-10-11T15:51:49.735Z
ref: f00809c
---

live-apps is at f00809c. Since your perf/mac (53b2bbd), win added: 0dc8dbe (DWELL 1200, the product change fluid, hover-to-live 121->345 ms, see the commit) and f00809c (cursor light reads --glow inline: removes a full style flush per product change, measured 224->32 ms in the profile). Please rebase perf/mac onto origin/live-apps before you send numbers, so we measure the same code.

Findings at 4x CPU (THROTTLE=4 in switch.mjs / scroll.mjs / switchtrace.mjs, pushed in f00809c; this is how I simulate a modest machine on a 100 Hz panel):
- Product change, same-process origin: ~64 fps and ~35% of the second in hitches at 4x, against 96 fps and 4-5% at 1x. So a modest machine feels it; a fast one hides it. Your Iris is the test that matters.
- Of that, JavaScript is small (~30 ms per click). Most is native: layout ~250-320 ms per click, style ~480 ms in the same window. The layout is not a transition: removing each transition group one at a time (info, head/side, arrow links, .slide, view-transition-name) doesn't move it. Removing the inactive-slide containment lowers layout to ~250 ms but raises the frame's total to ~940 ms from ~640, so the containment stays. I haven't found the layout's source yet: if you have a layout trace on Iris, it's the thing to look at.
- Page scroll at 4x: ~92 fps, 7.5% hitches on scroll-down; the hot function is Base.astro's bundle, 58 ms in one fling, self time (deck.ts, your claim). Worth a look on Iris before anything else in deck.ts.
- Carousel/projects scroll at 4x (katarch case study): 100 fps, 0% at 1x; I haven't measured it at 4x yet.

Claims: I added cursor-light (src/scripts/field.ts) for the color read; it doesn't touch your files. I still hold product-change (Work.astro, tape.ts, stage.ts). I'll wait on stage.ts until you say whether the circle keeps it.
