---
from: win
to: mac
type: handoff
subject: win pauses: the ball is yours. live-apps 724142e, what I learned, your next steps, and you may integrate
at: 2026-10-11T16:12:52.041Z
ref: 724142e
---

win is pausing, at Felix's request; I'll come back later and read the channel first. The ball is yours.

WHERE live-apps IS: 724142e. Since your perf/mac base (53b2bbd), win added:
- 0dc8dbe perf: DWELL 1200 (an app boots 1.2 s after its slide arrives, not 0.6 s).
- f00809c perf: the cursor light reads --glow inline (it forced a full style flush on every product change: 224 -> 32 ms of getPropertyValue in a 4x profile).
- 05a8d10 perf(scripts): Chrome opens OFF-SCREEN (a real window, not headless), WINDOW=<ms> in switch.mjs, THROTTLE in switchtrace.mjs, page filters that follow BASE.
- 724142e docs(perf): MEASURING.md "Running the scripts", baseline-win.md past the first second, CLAUDE.md: never open visible windows on Felix's machines.
Rebase perf/mac onto origin/live-apps first.

WHAT I LEARNED TODAY (win's numbers; compare only with your own)
1. Read the product change over THREE seconds (WINDOW=3000). In the first second DWELL 1200 looked like 10-13% -> 4-6% of hitches; over three seconds it is 40-44% -> 35-37%. The boot had only moved past the window.
2. Over three seconds: stage in its own process (127.0.0.1) 14-16% hitches; stage in the page's process ([::1], production today without PUBLIC_STAGE_ORIGIN) 35-37%. The gap is the product's own stage running on the page's main thread: its recording playing, and its app booting and laying out (the trace's layout invalidations are KnowGraph's DOM and its fonts). The slide's CSS is not it: removing every transition group one at a time doesn't move the layout.
3. At 4x CPU (THROTTLE=4), [::1], first second: the product change at 64-67 fps and 31-40% hitches; the page spends 250-320 ms per click in layout, from the app's DOM. Page scroll at 4x: 92-94 fps, 7.5-9.3% hitches, 43-58 ms per fling of self time in Base.astro's bundle (deck.ts: your scroll claim).
4. Window opens/closes measured for real since the gate fix: only three closes over budget (playsync, lifeui, lolimpact: p99 20 ms, worst 50-60 ms).

YOUR NEXT STEPS, in Felix's priority order (scroll, carousel, projects; the circle is his choice)
1. baseline-mac.md with WINDOW=3000 for switch.mjs, both origins, and THROTTLE where it helps.
2. Scroll on the Iris: start with deck.ts's hot function above.
3. Carousel, one process: what stays after the first second. Untested yet: switch.mjs base,tapeOff with WINDOW=3000 on [::1], to see whether the recording or the app is the sustained part. Fixes that change nothing visible first. Changing what or when the visitor sees (e.g. playing the recording only after the boot) is Felix's call.
4. The circle (mac/circle). Felix confirmed it in MY session too (2026-10-11): the circle stands, even below 60 fps. stage.ts is free now: I released product-change.
5. The iframes-under-tape commit (PlaySync 30 -> 60 while it follows its tape).
6. Window work (perf/mac-window): after these, still per motion change for Felix.

INTEGRATING WHILE I'M AWAY: you may fast-forward live-apps yourself, with the rules in CLAUDE.md: A/B alternated, 3+ runs, median better, astro check 0 errors, the gate in PASS on the Mac (DISPLAY_HZ for its panel), nothing visible without Felix, never main, never a force-push. Send a `result` with --ref for each integration so I can review it when I'm back. If something of mine looks wrong, say so in a `blocker` and leave it: don't revert it.

OFF-SCREEN ON MACOS: macOS may keep part of a window on screen. If a window shows, try HEADLESS=1 only to compare, and say what you see: then we decide the Mac's default together.

Claims: I released product-change and cursor-light. I hold nothing now.
