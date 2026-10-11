---
from: win
to: mac
type: handoff
subject: Welcome: where we are, the backlog and a proposed split
at: 2026-10-11T14:42:55.472Z
ref: 1c65adb
---

Welcome, mac. Read CLAUDE.md first (rules, protocol, your setup), then scripts/perf/MEASURING.md. `live-apps` is at 1c65adb. Production still serves `main` (5af4751), so none of this is deployed yet.

WHERE WE ARE (win, 100 Hz panel, every number is win's only)
- Product change, stage in its own process: 96-98 fps, 3% of the second in hitches. Stage in the page's process (what production gives today, no PUBLIC_STAGE_ORIGIN): 89-91 fps, 17-18%. Before this work it was 36-43 fps and 71-80% on a 240 Hz panel (not comparable, same measure).
- Done and merged: inactive slides skip style/layout (content-visibility), the room's light changes at once, the intro name animates opacity/position only, the dead pace chain is gone, the gate really opens the window now (it never did: it clicked the green light while the light was asleep).
- Rejected with numbers: DWELL 300 (worse on the click, no gain on the gate), an opacity crossfade of the glow, content-visibility on off-screen panels for load.

BACKLOG, by what a visitor feels
1. Production runs stages in the same process. Not code: Felix has to add a second *.vercel.app name and set PUBLIC_STAGE_ORIGIN. Worth 17-18% -> 3% hitches on the click.
2. In one process, the cost of a product change is the stage itself: hiding .stage-frame or tape-player takes the click to 100 fps / 0%. The trace shows ~100 ms of the app's own JavaScript (its boot) on the page's main thread in that second. Ideas: play the tape only once the app has booted; a cheaper tape. Both change what or when the visitor sees: Felix's call.
3. Window close is over budget on 3 of 5 products (playsync, lifeui, lolimpact: p99 20 ms, worst frame 50-60 ms). Window open has 15-31% late frames (transient). The morph is a view transition plus compositing: this is where the Mac's GPU will tell us something we can't see on win.
4. Intermittent freezes, seen once each and not reproduced after the gate fix: playsync window phase had a 3190 ms gap; lolimpact had 0 fps in four phases in one run. The machine was loaded both times.
5. Cold boot: the first boot of a product's app (KatArch on the gate) leaves a ~1.7 s gap with no frames, and the page load has a 363-650 ms gap (190 ms parse, ~200 ms first layout).
6. Theme wash: the covered frame costs 100 ms or more under the veil. Invisible, but it delays the lift.

PROPOSED SPLIT (Felix can reassign)
- mac: first, your baseline in scripts/perf/baseline-mac.md (switch.mjs, scroll.mjs, check.mjs --gate, both origins). Then item 3 (window open/close) and item 5 (cold boot): both are compositing-sensitive, so your numbers are the useful ones.
- win: items 2, 4 and 6, and the integration of whatever you push.
- Claim your areas with `claim` before editing: window-close, window-open, cold-boot.

HOW TO REACH ME: `result` when you have a measured change on perf/mac (rebased on live-apps), `question` if you need something, `blocker` if we disagree. I keep `watch` running here.
