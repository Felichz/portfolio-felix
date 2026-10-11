---
from: win
to: mac
type: handoff
subject: Felix confirmed here: circle stands, goLive in, priority is scroll + carousel + projects. Work split inside.
at: 2026-10-11T14:59:02.506Z
ref: d8d760e
---

Felix answered me in MY session, so these are confirmed here. Your two answers stand, and he added a priority.

DECIDED BY FELIX (2026-10-11, to win)
1. The theme switch is the CIRCLE. The fade/wash is ugly to him, and he prefers the circle even if it doesn't reach 60 fps.
2. The goLive fix goes back in: he wants the window to open with the app live.
3. PRIORITY: the common things, fluid. Scroll on the page, the interaction with the projects carousel, and the projects themselves. Window open/close is now second.

DONE ON live-apps (d8d760e): the goLive fix is in (git revert of 5af4751, identical to 00129bf's goLive part). Drop your a7ce706 and b0a84ad. Rebase perf/mac on origin/live-apps. astro check is 0 errors; the five-product check is running.

THE CIRCLE IS NOT A CLEAN REVERT. The wash is not only in e61dd29: 00129bf (13 files: Bar, player, live, handoff, stage, stage-protocol, global.css, how-its-built, projects.ts) already carries most of the conversion. So your b38d515 is the right starting point, made on the same base. Please:
- cherry-pick it onto the latest origin/live-apps as its own commit, on a branch `mac/circle`, and push it;
- keep what d97a2b6 and 6b82ffd fixed: a preview takes the new theme as the circle reaches it (not all at once), and an app's own theme switch takes its window's bar along. Those were the glitches Felix reported before;
- check it with scripts/perf/themeflash.mjs and themeorder.mjs, and by hand: the toggle on the page, the toggle inside an app, in a window and in a preview;
- the docs that say "wash" (README, DESIGN, how-its-built.astro, projects.ts line ~399, comments in Bar.astro) must say circle again: grep for wash/fade;
- measure it, but don't trade the circle for numbers: it's his choice.
I'll review it and integrate. You don't need to wait for me to start.

WHAT TO WORK ON IN PARALLEL (non-overlapping)
mac (Intel Iris, 60 Hz: a modest GPU like many visitors'; your numbers are the ones that matter for "fluid for everyone"):
 1. baseline-mac.md first (scripts/perf/MEASURING.md), both origins.
 2. circle (above). Claim `circle`: Bar.astro, player.ts, handoff.ts, stage.ts, stage-protocol.ts, live.ts theme parts.
 3. PAGE SCROLL: wheel and deck sections, the intro, About, Experience, the section rail. Claim `scroll`: src/scripts/deck.ts, src/components/{Intro,About,Experience,Dock}.astro, global.css (deck/reveal parts). Run scripts/perf/scroll.mjs on the Mac, find the costs by elimination (injected CSS, A/B alternated, 3+ runs), fix what costs the most. On win scroll is already ~100 fps at 100 Hz; on your Iris it may not be: that's the point.
 4. The iframes-under-tape commit (PlaySync 30 -> 60 fps while it follows the tape): it is the projects' own fluidity, keep it, in session.ts #rest. You hold live.ts/session.ts for it; I'm not touching them.
 5. Window open/close (perf/mac-window): parked until 1-4 are done. Still on its own branch, still Felix's call per motion change.
win:
 - the PROJECTS CAROUSEL and the projects: rail clicks, auto-advance, hover on a plate, a product change, the live preview following its tape, in both origins. Claim `product-change` (already mine: Work.astro, tape.ts, stage.ts) and I add `carousel`.
 - integrating your branches, in this order: mac/circle, then perf/mac (goLive-independent parts, the iframes fix), then scroll results.

RULES THAT STAY: A/B alternated, one machine, 3+ runs, median; visible changes are Felix's call; no merge to main. When something of yours is ready: `result` with --ref and the numbers. I keep `watch` running.
