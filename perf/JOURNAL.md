
## 2026-11-04: the 3D phone's shader link moved to a worker

Hypothesis: linking the phone's shaders on the page's thread blocks the showcase as the visitor arrives.
Change: the phone is built and drawn in a worker (b6329dd). Ledger, idle-work: script 860 to 25 ms.
Not yet measured with frameproof. Judged by drops.mjs at the time: no difference in carousel or scroll.

## 2026-11-05 13:18 · compare · inconclusive

- **Hypothesis:** deck: data-moving set after the frame's scrollTop read, not in the scroll event (deck.ts:122 forced style+layout)
- **Change:** HEAD (b26ac52) → worktree
- **Result:** worktree against HEAD (b26ac52), 12 strata in 20.3 min. inconclusive: scroll/down@4x, scroll/up@4x. Not known: never read this as "no difference".
  - scroll/down@4x: inconclusive, +1 late frames a step [-3.83, 6.99] (the interval [-3.83, 6.99] is wider than the margin of ±1.5)
  - scroll/up@4x: inconclusive, 0 late frames a step [-3.99, 4.83] (the interval [-3.99, 4.83] is wider than the margin of ±2)
- **Run:** 2026-11-05T12-57-29-88bf on win32-i7-11800h-16c-chrome156-7581e6

## 2026-11-05 16:16 · compare · inconclusive

- **Hypothesis:** deck.ts: tab boxes cached and glow colors cached and written only when they change, so a section change no longer forces style and layout in the scroll's frame (pill 36 ms, glow 19 ms at 4x)
- **Change:** HEAD (bea03a4) → worktree
- **Result:** worktree against HEAD (bea03a4), 14 strata in 51.3 min. inconclusive: scroll/down@1x, scroll/down@4x, scroll/up@1x, scroll/up@4x, carousel/next@1x, carousel/next@4x, carousel/back@1x, carousel/back@4x, theme/switch@1x, theme/switch@4x, theme/back@1x, theme/back@4x. Not known: never read this as "no difference".
  - scroll/down@1x: inconclusive, +2 late frames a step [-1.25, 8.25] (the interval [-1.25, 8.25] is wider than the margin of ±2)
  - scroll/down@4x: inconclusive, -0.5 late frames a step [-3.25, 1.75] (the interval [-3.25, 1.75] is wider than the margin of ±2)
  - scroll/up@1x: inconclusive, -1 late frames a step [-2.25, 2.25] (the interval [-2.25, 2.25] is wider than the margin of ±2)
  - scroll/up@4x: inconclusive, 0 late frames a step [-2.25, 3.25] (the interval [-2.25, 3.25] is wider than the margin of ±2)
  - carousel/next@1x: inconclusive, +1 late frames a step [-2.2, 2.7] (first run p=0.037 did not survive the confirmation run)
  - carousel/next@4x: inconclusive, -2 late frames a step [-8.25, 6.25] (the interval [-8.25, 6.25] is wider than the margin of ±2)
  - carousel/back@1x: inconclusive, 0 late frames a step [-2.25, 4.75] (the interval [-2.25, 4.75] is wider than the margin of ±2)
  - carousel/back@4x: inconclusive, +1 late frames a step [-2.25, 3.25] (the interval [-2.25, 3.25] is wider than the margin of ±2)
- **Run:** 2026-11-05T15-25-10-f256 on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped, not integrated: no cell moved. In this run's light traces scroll had no episode at 4x on either build (0/16), while `freezes` had put 83 to 217 ms on `deck.ts:120` in 3 of 3: its heavy tracing (stacks, invalidations) inflates small forced restyles into freezes. The visitor's scroll on this Mac has no freeze to fix. What does freeze here: `carousel/next@4x` (14/16 episodes) and the theme switch at 4x (14/16 each way).

## 2026-11-05 16:48 · compare · inconclusive

- **Hypothesis:** Work.astro rail: overflow and box kept from the last measure, so pointermove no longer forces a restyle and layout right after a product change's click (132 elements, 97 layout objects at 4x)
- **Change:** HEAD (bea03a4) → worktree
- **Result:** worktree against HEAD (bea03a4), 16 strata in 26.2 min. inconclusive: carousel/next@1x, carousel/next@4x, carousel/back@1x, carousel/back@4x. Not known: never read this as "no difference".
  - carousel/next@1x: inconclusive, +1 late frames a step [-1.93, 4.18] (the interval [-1.93, 4.18] is wider than the margin of ±2)
  - carousel/next@4x: inconclusive, -3.5 late frames a step [-13.18, 9.18] (the interval [-13.18, 9.18] is wider than the margin of ±2)
  - carousel/back@1x: inconclusive, 0 late frames a step [-5.18, 7.68] (the interval [-5.18, 7.68] is wider than the margin of ±2)
  - carousel/back@4x: inconclusive, 0 late frames a step [-6.93, 7.68] (the interval [-6.93, 7.68] is wider than the margin of ±2)
- **Run:** 2026-11-05T16-21-54-5131 on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped: no cell moved. The forced read moved, it didn't go away: the rail scrolls itself into view on a product change, which measured the box again.

## 2026-11-05 17:16 · compare · inconclusive

- **Hypothesis:** frame.ts: the pointer effects (spot, tilt, preview lights, cursor light) read in one shared frame before any writes, and the lights' animations are kept instead of asked for (getAnimations forced a restyle); up to five forced style passes in a pointer frame before
- **Change:** HEAD (bea03a4) → worktree
- **Result:** worktree against HEAD (bea03a4), 8 strata in 22.2 min. inconclusive: carousel/next@1x, carousel/next@4x, carousel/back@4x, projects/live@1x, projects/live@4x; same: carousel/back@1x. Not known: never read this as "no difference".
  - carousel/next@1x: inconclusive, 0 late frames a step [-2.25, 3.25] (the interval [-2.25, 3.25] is wider than the margin of ±2)
  - carousel/next@4x: inconclusive, +0.5 late frames a step [-3.75, 6.25] (the interval [-3.75, 6.25] is wider than the margin of ±2)
  - carousel/back@1x: same, 0 late frames a step [-1.25, 1.25] (the interval sits inside the margin of ±2)
  - carousel/back@4x: inconclusive, 0 late frames a step [-2.75, 2.25] (the interval [-2.75, 2.25] is wider than the margin of ±2)
  - projects/live@1x: inconclusive, -0.5 late frames a step [-3.25, 2.25] (the interval [-3.25, 2.25] is wider than the margin of ±2)
  - projects/live@4x: inconclusive, -1 late frames a step [-6.25, 3.25] (the interval [-6.25, 3.25] is wider than the margin of ±2)
- **Run:** 2026-11-05T16-54-22-ce4b on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped: typical frames identical on both builds. Note: every run up to here served the build on 127.0.0.1, where the stages load from localhost and run in their own process; production runs them in the page's process. The two prices below ran on 127.0.0.1 too; from 17:46 on the config serves on [::1].

## 2026-11-05 17:30 · price · better

- **Hypothesis:** (none given: pass --note next time)
- **Change:** inject css:[data-field],[data-light],.ambient-light{display:none!important} on worktree
- **Result:** worktree with css:[data-field],[data-light],.ambient-light{display:none!important} injected, against without: better (carousel/next@4x -4, carousel/back@4x -3 late frames a step). A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less.
  - carousel/next@4x: better, -4 late frames a step [-7.7, 0.2] (confirmed on fresh repetitions (typical frames, p=0.005 after Holm))
  - carousel/back@4x: better, -3 late frames a step [-5.72, -0.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
- **Run:** 2026-11-05T17-18-05-e3f8 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-05 17:43 · price · better

- **Hypothesis:** (none given: pass --note next time)
- **Change:** inject css:tape-player,iframe{visibility:hidden!important} on worktree
- **Result:** worktree with css:tape-player,iframe{visibility:hidden!important} injected, against without: better (carousel/next@4x -9, carousel/back@4x -4 late frames a step). A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less.
  - carousel/next@4x: better, -9 late frames a step [-12.7, -4.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - carousel/back@4x: better, -4 late frames a step [-5.2, -2.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
- **Run:** 2026-11-05T17-31-32-2ea3 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-05 18:18 · price · inconclusive

- **Hypothesis:** (none given: pass --note next time)
- **Change:** inject css:@property --panel-glow{syntax:'*';inherits:false}@property --panel-glow-2{syntax:'*';inherits:false} on worktree
- **Result:** worktree with css:@property --panel-glow{syntax:'*';inherits:false}@property --panel-glow-2{syntax:'*';inherits:false} injected, against without: inconclusive. A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less.
  - carousel/next@4x: inconclusive, -2 late frames a step [-6.2, 1.7] (first run p=0.044 did not survive the confirmation run)
  - carousel/back@4x: inconclusive, +2 late frames a step [-8.83, 9.14] (the interval [-8.83, 9.14] is wider than the margin of ±2)
- **Run:** 2026-11-05T17-50-30-af8a on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-05 20:34 · compare · better

- **Hypothesis:** tape.ts: a recording's Latin font faces load before its first layout, so their arrival doesn't lay the recording out again a few hundred ms into a product change (162 of 171 objects, 55 ms at 1x, 4/4)
- **Change:** HEAD (7c82602) → worktree
- **Result:** worktree against HEAD (7c82602), 24 strata in 40.3 min. better: carousel/next@1x, carousel/next@4x; inconclusive: carousel/back@1x, carousel/back@4x. mode: page on [::1]:63309, [::1]:64387, [::1]:49580, [::1]:50038, [::1]:51007, [::1]:51450, [::1]:52419, [::1]:52828, [::1]:53798, [::1]:54270, [::1]:62988, [::1]:63152, [::1]:64547, [::1]:64704, [::1]:49735, [::1]:49889, [::1]:51304, [::1]:52690, [::1]:53978, [::1]:54130; frames from [::1]:62796, [::1]:63309, [::1]:63475, [::1]:64177, [::1]:64387, [::1]:64880, [::1]:65110, [::1]:49374, [::1]:49580, [::1]:50038, [::1]:50203, [::1]:50805, [::1]:51007, [::1]:51450, [::1]:51614, [::1]:52212, [::1]:52419, [::1]:52828, [::1]:52978, [::1]:53575, [::1]:53798, [::1]:54270, [::1]:54420, [::1]:55052, [::1]:62988, [::1]:63152, [::1]:63681, [::1]:63958, [::1]:64547, [::1]:64704, [::1]:65315, [::1]:65519, [::1]:49735, [::1]:49889, [::1]:50402, [::1]:50602, [::1]:51166, [::1]:51304, [::1]:51822, [::1]:52009, [::1]:52566, [::1]:52690, [::1]:53188, [::1]:53379, [::1]:53978, [::1]:54130, [::1]:54623, [::1]:54851 shared the page's process.
  - carousel/next@1x: better, -3 late frames a step [-4.2, 0.2] (confirmed on fresh repetitions (typical frames, p=0.011 after Holm))
  - carousel/next@4x: better, -7.5 late frames a step [-13.2, -2.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - carousel/back@1x: inconclusive, 0 late frames a step [-2.2, 4.2] (the interval [-2.2, 4.2] is wider than the margin of ±2)
  - carousel/back@4x: inconclusive, +6 late frames a step [-5.22, 21.2] (the interval [-5.22, 21.2] is wider than the margin of ±2)
- **Run:** 2026-11-05T19-37-56-f47d on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Integrated. Aimed at the 1x freeze `freezes` named on 2026-11-05 (run 2026-11-05T18-45-51-95e1, f3: layout of 162 of 171 objects after "Fonts changed", 67 to 133 ms, in 4 of 4). No visible change: `play()` already waited for `fonts.ready` before the recording started, so it starts when it did; the fonts now arrive before its first layout, not after. `astro check` 0 errors, `ledger.mjs --check` all hold.

## 2026-11-05 21:35 · compare · inconclusive

- **Hypothesis:** catchup.ts: after the theme's circle or the window, the sections out of sight catch up one at a time in idle time instead of all in one frame (151 ms of unexplained GPU after the circle, 4/4, light 8/8 at 1x)
- **Change:** HEAD (d388f4c) → worktree
- **Result:** worktree against HEAD (d388f4c), 20 strata in 35.9 min. inconclusive: theme/switch@1x, theme/switch@4x, theme/back@1x, theme/back@4x, window/open@1x, window/open@4x, window/close@1x, window/close@4x. Not known: never read this as "no difference".
  - theme/switch@1x: inconclusive, +3 late frames a step [-7.26, 11.75] (the interval [-7.26, 11.75] is wider than the margin of ±2)
  - theme/switch@4x: inconclusive, +0.5 late frames a step [-7.25, 7.75] (the interval [-7.25, 7.75] is wider than the margin of ±2)
  - theme/back@1x: inconclusive, +0.5 late frames a step [-2.2, 3.2] (first run p=0.034 did not survive the confirmation run)
  - theme/back@4x: inconclusive, -1 late frames a step [-5.25, 3.75] (the interval [-5.25, 3.75] is wider than the margin of ±2)
  - window/open@1x: inconclusive, +4 late frames a step [-11.75, 11.25] (the interval [-11.75, 11.25] is wider than the margin of ±2)
  - window/open@4x: inconclusive, +1 late frames a step [-9.75, 12.25] (the interval [-9.75, 12.25] is wider than the margin of ±2)
  - window/close@1x: inconclusive, +7 late frames a step [-10.25, 16.25] (the interval [-10.25, 16.25] is wider than the margin of ±2)
  - window/close@4x: inconclusive, 0 late frames a step [-3.2, 3.2] (first run p=0.022 did not survive the confirmation run)
- **Run:** 2026-11-05T20-58-23-315e on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped: every cell inconclusive, typical frames the same (theme/back@1x 20 to 19.5, @4x 25 to 25). The ~150 ms of GPU at the circle's end is the view transition ending, not the sections catching up. The circle stays (Felix's call), so this one is left.

## 2026-11-05 · where the Mac stands at normal speed

- `freezes -s journey,scroll,carousel,projects,window,theme -n 4` on [::1] after d388f4c (run 2026-11-05T20-37-21-19a6), checked against light runs:
  - scroll: no freeze.
  - carousel: 50 to 83 ms in 2 of 4 (a recording's own CSS animations starting, and GPU raster), under the 100 ms episode line; compare saw 0/24 episodes at 1x (run 2026-11-05T19-37-56-f47d).
  - projects: 67 to 83 ms in 2 of 4, 1 of 8 light runs: KnowGraph's own stage code.
  - load: 67 to 100 ms in 2 of 4 (run 2026-11-05T20-54-04-3166), the page's first frame.
  - window: 50 to 67 ms, the view transition, accepted.
  - theme: 50 to 167 ms at the circle's end, GPU, 4 of 4: the circle, accepted.
- Not pursued: the automatic boot waiting while the hand is on the rail (written on 2026-11-05, never judged to the end). It aimed at a freeze seen at 4x; at normal speed the carousel has no episode left.
