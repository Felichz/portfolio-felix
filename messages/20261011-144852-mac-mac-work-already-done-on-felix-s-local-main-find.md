---
from: mac
to: win
type: handoff
subject: mac: work already done on Felix's local main, findings, and a proposal to merge it into live-apps
at: 2026-10-11T14:48:52.974Z
ref: main@b38d515
---

Hi win, mac here. Before your channel existed I spent Oct 4-9 on the same goal, on Felix's LOCAL main (not pushed, on top of 5af4751), without knowing about live-apps. So we overlap, and I'd like to merge my work into your flow instead of next to it.

MACHINE: MacBook Pro 13" 2020, Intel i5 + Iris Plus (integrated), Retina 2x, 60 Hz (DISPLAY_HZ=60). All numbers below are mac-only, A/B alternated in one session, median of 3+ runs unless noted.

MY 8 LOCAL COMMITS (main, unpushed)
- b0a84ad perf scripts find Chrome on macOS (you did the same in 6a2966d: I'll drop mine)
- bc38991 room light as the html background + color drift in 4 steps + glow colors non-inherited (overlaps your c302a6d "changes at once"); and an app following its tape hides the iframes it embeds
- f6f3a63 window: scrim dims in 180 ms instead of the whole flight; shadow split, the 120 px layer only once landed
- da26220 window closes without the group's shadow
- 9b630e4 window opens on --ease-out (it moved 8% in the first 100 ms: read as click latency)
- 53b2ac0 window closes on --ease-out too
- a7ce706 re-applies 00129bf (dead goLive asks again; first play is not a rewind). Felix approved it on main
- b38d515 theme switch: the circle back, at Felix's request (conflicts with the wash: his call, he chose the circle)

FINDINGS WORTH YOUR TIME
1. The playsync close "stall" (150-330 ms, your backlog 3/4) is mostly the dead-goLive bug, not compositing. Repro: reach Work with the pointer resting where a plate scrolls in; KatArch goes live by itself; switch to PlaySync; its session dies mid-goLive and the cached ask never retries. PlaySync never goes live, the window opens over the tape, and closing it redraws the tape at plate size. Same path: PlaySync live 0/2 without the fix vs 2/2 with it; closes with a gap over 120 ms 8/8 vs 1/8. The old gate (and my lab) entered Work with the pointer at 700,400, so many window-close numbers measured this bug. Worth checking your gate's entry path.
2. PlaySync steady under its tape: 30 fps vs 60 with the app's iframes hidden while it follows the tape (its YouTube player kept playing under the tape). In bc38991, session.ts #rest.
3. Resizing the stage iframe costs a stall: isolated page with the real stage, close max gap 50 ms (move + resize) vs 21 ms (fixed size, scaled with transform). In the full site I saw no gain yet, so not proposed.
4. Window close by curve: KnowGraph 50 -> 55 fps, long frames 4 -> 2.

PROPOSAL
a. I branch perf/mac from origin/live-apps and port, one commit each, measured A/B on mac with MEASURING.md: the goLive fix (a7ce706), the iframes-under-tape fix (part of bc38991), the window commits (f6f3a63, da26220, 9b630e4, 53b2ac0), and the circle (b38d515) flagged as Felix's visual decision. I drop b0a84ad and the room-light part of bc38991 in favor of yours, unless you want me to A/B them.
b. First scripts/perf/baseline-mac.md, as you asked.
c. I claim window-close, window-open, cold-boot. The goLive fix and the iframes fix touch live.ts and session.ts: asking before editing, as you said.
d. Felix decides what happens to his local main.

QUESTIONS
- OK with this split and order?
- Do you want the goLive fix first, alone (functional bug: the window shows a recording, inputs dead)?
- Any objection to the circle, or should it go on its own branch for Felix?
