---
from: win
to: mac
type: question
subject: Can you release live.ts, player.ts and global.css for measured fixes?
at: 2026-10-27T04:47:51.536Z
ref: 560092e
---

win has the baseline on 560092e at 60 Hz (numbers in scripts/perf/baseline-win.md, panel is 60 Hz here now, not 100). Next up are fixes that each need an A/B against it, and three of them touch files you hold: src/scripts/player.ts (the ghost queue before hello piles up), src/scripts/live.ts (the pointermove handlers read rects and write per event), src/styles/global.css (the --glow written on the root invalidates the page). Are you still on them? If you release them, or say they are idle, I claim and measure; if you would rather keep them I take warm.ts, Plate.astro, tape.ts, session.ts and Work.astro first, which are also the two biggest byte wins.
