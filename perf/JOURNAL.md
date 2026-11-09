
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
- The automatic boot waiting while the hand is on the rail was judged after this, and integrated: see the next entry (b7d2200).

## 2026-11-05 21:44 · price · inconclusive

- **Hypothesis:** the load's 107 ms of GPU (raster 51) at +331 ms is the portrait's first raster, landing in the name's entrance
- **Change:** inject css:.portrait{visibility:hidden!important} on worktree
- **Result:** worktree with css:.portrait{visibility:hidden!important} injected, against without: inconclusive. A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less. mode: page on [::1]; frames from [::1] shared the page's process.
  - load/load@1x: inconclusive, -1 late frames a step [-2.2, 1.2] (first run p=0.024 did not survive the confirmation run)
- **Run:** 2026-11-05T21-38-09-a3d3 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-05 22:11 · compare · better

- **Hypothesis:** live.ts: a boot nobody asked for waits while the hand is on the rail (a product change is coming, which drops that app)
- **Change:** HEAD (9367ca8) → worktree
- **Result:** worktree against HEAD (9367ca8), 16 strata in 23.9 min. better: carousel/next@1x, carousel/back@1x. mode: page on [::1]; frames from [::1] shared the page's process.
  - carousel/next@1x: better, -3 late frames a step [-6.18, -0.82] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - carousel/back@1x: better, -4 late frames a step [-11.2, -2.82] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
- **Run:** 2026-11-05T21-46-13-64e1 on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Integrated, after the checks on the cells it could touch (run with --no-journal): projects/live@1x 2 to 2 and window/open@1x 27.5 to 27, inconclusive, none worse (run 2026-11-05T22-11-29-512c); carousel@4x better, next 64 to 55.5 (p = 0.003), back 77 to 40.5 (p < 0.001), back's episodes 31/32 to 23/32 (p = 0.013) (run 2026-11-05T22-37-05-e50c). Nothing a visitor sees changes: the preview shows its recording until it goes live, and a hover still asks for the app at once.

## 2026-11-05 23:54 · compare · better

- **Hypothesis:** live.ts: a pointer that only crosses a preview no longer asks for its app; one that rests 120 ms does (the ghost answers at once either way): the handoff ran under the next click (layout of 168 objects in /stage, light 10/12)
- **Change:** HEAD (f1dde1c) → worktree
- **Result:** worktree against HEAD (f1dde1c), 16 strata in 32.4 min. better: carousel/next@1x; inconclusive: carousel/back@1x, projects/live@1x. mode: frames from [::1] shared the page's process.
  - carousel/next@1x: better, -5 late frames a step [-9.2, -0.8] (confirmed on fresh repetitions (typical frames, p=0.002 after Holm))
  - carousel/back@1x: inconclusive, 0 late frames a step [-4.53, 8.04] (the interval [-4.53, 8.04] is wider than the margin of ±2)
  - projects/live@1x: inconclusive, +1 late frames a step [-1.53, 2.16] (the interval [-1.53, 2.16] is wider than the margin of ±2)
- **Run:** 2026-11-05T23-20-46-ce0e on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Integrated, after the checks (run with --no-journal): window@1x open 27 to 28 and close 20.5 to 19.5, inconclusive, none worse (run 2026-11-05T23-55-34-5f34); carousel@4x next 64 to 53.5, better (p < 0.001), back inconclusive (run 2026-11-06T13-50-40-0c83). The ghost still answers the pointer at once; the app takes its place 120 ms later behind it, and a click still asks at once.

## 2026-11-06 14:57 · compare · inconclusive

- **Hypothesis:** live.ts: warming a stage waits while the hand is on the rail (bisect: with no warming at all, carousel/next 11 to 8)
- **Change:** HEAD (b23d609) → worktree
- **Result:** worktree against HEAD (b23d609), 12 strata in 16.8 min. inconclusive: carousel/next@1x, carousel/back@1x. Not known: never read this as "no difference". mode: frames from [::1] shared the page's process.
  - carousel/next@1x: inconclusive, -2 late frames a step [-9.14, 2.83] (the interval [-9.14, 2.83] is wider than the margin of ±2)
  - carousel/back@1x: inconclusive, 0 late frames a step [-6.14, 5.83] (the interval [-6.14, 5.83] is wider than the margin of ±2)
- **Run:** 2026-11-06T14-39-43-4185 on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped, a bisection step. Step 1 (no warming at all, run 2026-11-06T14-12-16-410f, --no-journal): carousel/next 11 to 8 (better, p = 0.028) but its episodes 2/24 to 5/24, carousel/back 13 to 10.5 inconclusive: warming moves cost to a product's first showing, it doesn't remove it. Step 2, this run: the rail condition alone moves nothing. Warming stays as it was.

## 2026-11-06 · bisect · carousel/back, and the battery

- **Bisection, carousel/back@1x, all on [::1] against b23d609 (--no-journal):**
  1. No warming at all (run 2026-11-06T14-12-16-410f): back 13 to 10.5, inconclusive. Not it (see above).
  2. Warming waits for the hand to leave the rail (run 2026-11-06T14-39-43-4185): nothing moves. Not it.
  3. The product left behind is paused, not rewound, 500 ms after (run 2026-11-06T20-20-27-3a09): back 2 to 1, better (p < 0.001); counted layout objects on the way back 345 to 152. This is it: the rewind rebuilt the recording's document while its slide skipped rendering, and the whole of it was laid out on the way back. roll() already rewinds a recording as it comes back, before it shows (its plate is idle, the recording at opacity 0, until it plays).
- 4x check (run 2026-11-06T22-23-59-7bbd): next 67 to 62.5 and back 71.5 to 73, inconclusive, none worse; counted layout objects on the way back 441 to 202.
- A run between steps 2 and 3 (2026-11-06T19-55-00-fa62) was on battery: the base read 39 late frames a step against 10.5 an hour before, 2 an hour after, plugged in. Thrown away. frameproof now refuses frames on battery (5f5156a), and its drift note is what caught it.

## 2026-11-06 23:26 · price · better

- **Hypothesis:** bisect GPU freezes on scroll: ambient background, videos and stage frames off together
- **Change:** inject css:.ambient,video,iframe{display:none!important} on worktree
- **Result:** worktree with css:.ambient,video,iframe{display:none!important} injected, against without: better (scroll/down@1x -29, scroll/up@1x -11 late frames a step). A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: better, -29 late frames a step [-37.2, -10.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - scroll/up@1x: better, -11 late frames a step [-19.2, -3.3] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
- **Run:** 2026-11-06T23-16-56-c64c on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 00:15 · price · partial

- **Hypothesis:** bisect scroll GPU: ambient background off alone
- **Change:** inject css:.ambient{display:none!important} on worktree
- **Result:** partial: the browser went away twice: Connection closed.; what follows covers what was measured before. worktree with css:.ambient{display:none!important} injected, against without: partial. A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: inconclusive, -1.5 late frames a step [-14.2, 13.2] (the interval [-14.2, 13.2] is wider than the margin of ±2. the base read 20.5 here and 32.5 in 2026-11-06T23-16-56-c64c: numbers from separate runs don't compare, only the two builds within one run do)
  - scroll/up@1x: inconclusive, 0 late frames a step [-11.2, 7.2] (the interval [-11.2, 7.2] is wider than the margin of ±2)
- **Run:** 2026-11-07T00-06-33-b405 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 12:32 · bisect · not found

- **Hypothesis:** scroll at 1x: GPU busy outside raster and composite; resumed
- **Change:** take away hide:.ambient, hide:video, hide:iframe on worktree
- **Result:** the split candidates looked better on screening, but none held on confirmation: hide:iframe (2 split(s) priced, 1 taken from the resumed run, screened by frames). mode: frames from [::1] shared the page's process.
  - hide:iframe scroll/down@1x: inconclusive
  - hide:iframe scroll/up@1x: inconclusive
- **Run:** 2026-11-07T12-09-55-079c on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 17:46 · compare · worse

- **Hypothesis:** Work.astro: the recording starts once the deck stops moving, not as the section is reached (bisect: the stage frames, then roll() on deck:change)
- **Change:** HEAD (b67a8ee) → worktree
- **Result:** worktree against HEAD (b67a8ee), 16 strata in 30.3 min. worse: scroll/up@1x; inconclusive: scroll/down@1x, carousel/next@1x, carousel/back@1x. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: inconclusive, -3 late frames a step [-11.93, 2.18] (the interval [-11.93, 2.18] is wider than the margin of ±2)
  - scroll/up@1x: worse, +1 late frames a step [-0.18, 1.18] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm). the base read 0 here and 10 in 2026-11-07T16-45-59-8e96: numbers from separate runs don't compare, only the two builds within one run do)
  - carousel/next@1x: inconclusive, 0 late frames a step [-14.18, 11.18] (the interval [-14.18, 11.18] is wider than the margin of ±2)
  - carousel/back@1x: inconclusive, 0 late frames a step [-27.55, 16.93] (the interval [-27.55, 16.93] is wider than the margin of ±2)
- **Run:** 2026-11-07T17-14-41-8393 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 18:17 · compare · better

- **Hypothesis:** arrival at Work: the recording starts once the deck stops, and the automatic boot and warming wait until it has been still 1.2 s (KatArch booting and three stages mounting 0.8 to 1.3 s after the key)
- **Change:** HEAD (b67a8ee) → worktree
- **Result:** worktree against HEAD (b67a8ee), 12 strata in 28.4 min. better: scroll/down@1x; inconclusive: scroll/up@1x, carousel/next@1x, carousel/back@1x, projects/live@1x. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: better, -12 late frames a step [-20.2, -4.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - scroll/up@1x: inconclusive, +3 late frames a step [-3.2, 13.2] (the interval [-3.2, 13.2] is wider than the margin of ±2. the base read 12.5 here and 0 in 2026-11-07T17-14-41-8393: numbers from separate runs don't compare, only the two builds within one run do)
  - carousel/next@1x: inconclusive, -9.5 late frames a step [-22.71, 8.2] (the interval [-22.71, 8.2] is wider than the margin of ±2. the base read 46 here and 27 in 2026-11-07T17-14-41-8393: numbers from separate runs don't compare, only the two builds within one run do)
  - carousel/back@1x: inconclusive, -6 late frames a step [-28.46, 14.96] (the interval [-28.46, 14.96] is wider than the margin of ±2. the base read 37.5 here and 15.5 in 2026-11-07T17-14-41-8393: numbers from separate runs don't compare, only the two builds within one run do)
  - projects/live@1x: inconclusive, -3 late frames a step [-8.2, 5.2] (the interval [-8.2, 5.2] is wider than the margin of ±2)
- **Run:** 2026-11-07T17-47-14-cb1c on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 19:50 · compare · inconclusive

- **Hypothesis:** bisect: the recording starting once the deck stops, alone (boot and warming as they were)
- **Change:** HEAD (b67a8ee) → worktree
- **Result:** worktree against HEAD (b67a8ee), 28 strata in 36.7 min. inconclusive: scroll/down@1x, scroll/down@4x, scroll/up@1x, scroll/up@4x. Not known: never read this as "no difference". mode: frames from [::1] shared the page's process.
  - scroll/down@1x: inconclusive, -2.5 late frames a step [-9.2, 3.2] (first run p=0.004 did not survive the confirmation run)
  - scroll/down@4x: inconclusive, -4 late frames a step [-11.2, 2.2] (first run p=0.002 did not survive the confirmation run)
  - scroll/up@1x: inconclusive, +0.5 late frames a step [-8.18, 7.18] (the interval [-8.18, 7.18] is wider than the margin of ±2)
  - scroll/up@4x: inconclusive, +0.5 late frames a step [-7.18, 8.18] (the interval [-7.18, 8.18] is wider than the margin of ±2. the base read 18.5 here and 6 in 2026-11-07T18-34-31-5e55: numbers from separate runs don't compare, only the two builds within one run do)
- **Run:** 2026-11-07T19-13-16-027a on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 · bisect · the arrival at Work, on scroll/down

- `frameproof bisect -s scroll 'hide:.ambient' 'hide:video' 'hide:iframe'` (runs 2026-11-07T00-15-16-2d42, 2026-11-07T12-09-55-079c): all three away, scroll/down@1x 8 to 2; ambient and videos away, inconclusive; the stage frames away, 20.5 to 4.5, better. The stage frames hold the scroll's cost (the confirmation run was cut short by a machine at load average 43).
- One step finer, by hand: roll() left out as Work becomes active (run 2026-11-07T16-45-59-8e96), scroll/down@1x 24.5 to 4, better. But the timeline shows what runs there: the arriving product's app booting (live:katarch:boot about 810 ms after the key) and three neighbours' stages mounting, on the page's main thread.
- Tried and dropped:
  - The recording started once the deck stops, alone (run 2026-11-07T19-13-16-027a): inconclusive at 1x and 4x, nothing moves.
  - The same, with the automatic boot and the warming waiting 1.2 s after the deck stops (runs 2026-11-07T17-47-14-cb1c, 2026-11-07T18-34-31-5e55): scroll/down better (1x 23 to 11.5, episodes 8/24 to 1/24; 4x 29 to 17), but scroll/up@4x episodes 0/32 to 9/32 (p = 0.002): the boot lands in the next interaction. Not integrated.
- Where it stands: the cost is the stages' work in the page's process. Moving it in time moves it onto another interaction; the fix is the stages out of process (PUBLIC_STAGE_ORIGIN, approved 2026-11-03), whose gate is the window-close stall check below.

## 2026-11-07 · the PUBLIC_STAGE_ORIGIN gate, on the Mac

- `frameproof freezes -s window -n 8 --throttle 4`, served on 127.0.0.1 so the stages run from localhost in their own process (run 2026-11-07T19-51-23-2086): no long stall closing the window in 8 of 8; the longest freeze 283 ms (window close, 6/8 at 50 to 283 ms), against the 1,370 ms seen once on Windows on 2026-11-03.
- Those closes, and the "GPU busy, in nothing it names" freezes of 2026-11-06 in every scenario, are named now (frameproof d04a731): CALayerTreeCoordinator::ApplyBackpressure::Metal, Chrome's GPU waiting on macOS's window server, behind with everything else on screen (it ran at 45 to 57% CPU those nights). The screen's other drawing, not the page.

## 2026-11-07 20:35 · compare · better

- **Hypothesis:** what PUBLIC_STAGE_ORIGIN would bring: the same build with its stages in the page's process (::1) against their own (127.0.0.1)
- **Change:** HEAD (c7183d9) → HEAD (c7183d9)
- **Result:** HEAD (c7183d9) on 127.0.0.1 against HEAD (c7183d9) on ::1, 12 strata in 39.5 min. better: carousel/back@1x; inconclusive: scroll/down@1x, scroll/up@1x, carousel/next@1x, window/open@1x, window/close@1x. Served on purpose two ways: base on ::1, head on 127.0.0.1. mode: frames from localhost ran in their own process; frames from [::1] shared the page's process.
  - scroll/down@1x: inconclusive, +2 late frames a step [-13.2, 15.71] (the interval [-13.2, 15.71] is wider than the margin of ±2)
  - scroll/up@1x: inconclusive, 0 late frames a step [-13.2, 9.2] (the interval [-13.2, 9.2] is wider than the margin of ±2)
  - carousel/next@1x: inconclusive, +9 late frames a step [-21.96, 41.46] (the interval [-21.96, 41.46] is wider than the margin of ±2)
  - carousel/back@1x: better, -19.5 late frames a step [-32.2, 1.2] (confirmed on fresh repetitions (rare episodes, p<0.001 after Holm))
  - window/open@1x: inconclusive, -9 late frames a step [-27.96, 26.96] (the interval [-27.96, 26.96] is wider than the margin of ±2)
  - window/close@1x: inconclusive, +2 late frames a step [-8.2, 10.2] (first run p=0.026 did not survive the confirmation run)
- **Run:** 2026-11-07T19-56-05-db89 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-07 · what PUBLIC_STAGE_ORIGIN would bring, measured

- `frameproof compare --base HEAD --head HEAD --base-host ::1 --head-host 127.0.0.1 -s scroll,carousel,window` (run 2026-11-07T19-56-05-db89): the same build, its stages in the page's process (::1) against their own (127.0.0.1), alternated. carousel/back@1x better, 42.5 to 21.5 late frames, episodes 15/24 to 0/24; scroll, carousel/next and window inconclusive, none worse.
- A noisy night (window/open 51.5 late frames at 1x against about 27 on a quiet one, the window server at 56%), so the inconclusive cells say little. The one clear result is the carousel's way back.

## 2026-11-07 · where the Mac stands, final survey

- `frameproof freezes -s journey,load,scroll,carousel,projects,window,theme -n 4` on [::1] (run 2026-11-07T20-38-16-febc), with the tool naming the GPU's own time (frameproof d04a731) and checking against light runs:
  - Seven of the eight leading causes are the GPU waiting on the system's compositor (CALayerTreeCoordinator::ApplyBackpressure::Metal): carousel next and back, window open and close, theme, scroll down. The screen's other drawing (the window server at 45 to 57% these nights), not the page.
  - The eighth is the theme switch's raster (RasterDecoderImpl::DoBeginRasterCHROMIUM): the circle, kept by Felix's call.
  - The journey's long tasks are the page's first layout at load (111 objects, 107 to 120 ms): the work the page must do to show itself, the first time.
- Left in the page's code: nothing found that can be removed without changing what a visitor sees. Left outside it: the stages' work in the page's process, whose fix is PUBLIC_STAGE_ORIGIN (gate passed on the Mac, carousel/back's episodes 15/24 to 0/24 measured with it), waiting on the Vercel domain.

## 2026-11-08 11:55 · compare · worse

- **Hypothesis:** arrival at Work: no app boots on its own (hover asks), the recording starts once the deck stops, warming waits 3 s of a still deck
- **Change:** HEAD (3c30eb2) → worktree
- **Result:** worktree against HEAD (3c30eb2), 12 strata in 37 min. worse: scroll/up@1x; better: scroll/down@1x; inconclusive: window/open@1x; same: carousel/next@1x, carousel/back@1x, projects/live@1x, window/close@1x. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: better, -3 late frames a step [-4.2, -1.3] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - scroll/up@1x: worse, +2 late frames a step [0.8, 2.2] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - carousel/next@1x: same, 0 late frames a step [-1.2, 0.7] (first run p=0.017 did not survive the confirmation run, and the fresh interval sits inside the margin)
  - carousel/back@1x: same, 0 late frames a step [-1.25, 1.25] (the interval sits inside the margin of ±2)
  - projects/live@1x: same, 0 late frames a step [-0.25, 1.25] (the interval sits inside the margin of ±2)
  - window/open@1x: inconclusive, 0 late frames a step [-2.2, 1.2] (the interval [-2.2, 1.2] is wider than the margin of ±2)
  - window/close@1x: same, 0 late frames a step [-1.25, 1.25] (the interval sits inside the margin of ±2)
- **Run:** 2026-11-08T11-16-46-aac5 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-08 12:22 · compare · better

- **Hypothesis:** bisect: no auto boot and warming after 3 s still, without the recording waiting for the deck
- **Change:** HEAD (3c30eb2) → worktree
- **Result:** worktree against HEAD (3c30eb2), 20 strata in 24.4 min. better: scroll/down@1x; inconclusive: scroll/up@1x. mode: frames from [::1] shared the page's process.
  - scroll/down@1x: better, -5.5 late frames a step [-11.18, -1.81] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm). the base read 18.5 here and 5 in 2026-11-08T11-16-46-aac5: numbers from separate runs don't compare, only the two builds within one run do)
  - scroll/up@1x: inconclusive, -2 late frames a step [-8.14, 3.83] (the interval [-8.14, 3.83] is wider than the margin of ±2. the base read 7.5 here and 0 in 2026-11-08T11-16-46-aac5: numbers from separate runs don't compare, only the two builds within one run do)
- **Run:** 2026-11-08T11-56-47-18f5 on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Bisected (run 2026-11-08T11-56-47-18f5): the recording waiting for the deck was what cost scroll/up; without it, scroll/down@1x 18.5 to 13.5 late frames (better; its layout 965 to 143 objects, its main thread 585 to 154 ms) and scroll/up 7.5 to 5 (inconclusive, no longer worse).
  - Kept: no app boots on its own, and warming waits for a deck still 3 s. Why it is the smallest change: nothing on screen differs (the ghost still answers the pointer at once, the recording plays as before); the one difference is that a preview's app boots when the pointer rests on it, so its first takeover comes a moment later, behind the ghost. projects/live@1x read same (1 to 1) with it.
  - 4x check (run 2026-11-08T13-41-54-7804, --no-journal): nothing worse; scroll/up@4x better, 19 to 5.5 late frames, episodes 13/24 to 4/24 (p = 0.015). Integrated.

## 2026-11-08 14:32 · compare · same

- **Hypothesis:** Work.astro rail: the edges are first set by the ResizeObserver, not as the module runs (a forced first layout, 107 to 120 ms of the arrival)
- **Change:** HEAD (b10690b) → worktree
- **Result:** worktree against HEAD (b10690b), 16 strata in 15.4 min. same: load/load@1x, carousel/next@1x, carousel/back@1x. mode: page on [::1]; frames from [::1] shared the page's process.
  - load/load@1x: same, -0.5 late frames a step [-1.18, 1.18] (first run p=0.022 did not survive the confirmation run, and the fresh interval sits inside the margin)
  - carousel/next@1x: same, 0 late frames a step [-1.75, 1.25] (the interval sits inside the margin of ±2)
  - carousel/back@1x: same, 0 late frames a step [-0.25, 0.25] (the interval sits inside the margin of ±2)
- **Run:** 2026-11-08T14-16-23-2c9b on darwin-i5-1038ng7-8c-chrome156-95adeb
  - Dropped: same in every cell (load 4 to 3, inside the margin). The first layout only moved. load itself had 0 episodes in 32 repetitions on either build: the journey's first layout at load is not a freeze of the load step.

## 2026-11-08 15:16 · price · better

- **Hypothesis:** control: do the page's full-screen fixed layers (ambient background, cursor light) aggravate the GPU's wait on the system compositor?
- **Change:** inject css:.ambient,.cursor-light{display:none!important} on worktree
- **Result:** worktree with css:.ambient,.cursor-light{display:none!important} injected, against without: better (window/open@1x -7, window/close@1x -2.5, theme/back@1x -2 late frames a step). A price is an upper bound on what the change saves: the injection removes or adds exactly that, the real change may do less. mode: frames from [::1] shared the page's process.
  - window/open@1x: better, -7 late frames a step [-10.2, -3.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
  - window/close@1x: better, -2.5 late frames a step [-5.2, 0.2] (confirmed on fresh repetitions (typical frames, p=0.003 after Holm))
  - carousel/next@1x: same, 0 late frames a step [-1.25, 1.25] (the interval sits inside the margin of ±2)
  - carousel/back@1x: same, 0 late frames a step [-0.75, 0.25] (the interval sits inside the margin of ±2)
  - theme/switch@1x: inconclusive, -0.5 late frames a step [-4.2, 3.2] (first run p=0.008 did not survive the confirmation run)
  - theme/back@1x: better, -2 late frames a step [-4.2, -0.8] (confirmed on fresh repetitions (typical frames, p<0.001 after Holm))
- **Run:** 2026-11-08T14-49-36-36c7 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-08 · survey after the arrival fix, and the compositor control

- `freezes -n 4`, all scenarios, 1x on [::1] (run 2026-11-08T14-34-37-3694): no cause comes back in every repetition. scroll and carousel show none. Confirmed by light runs (2/8 or more): theme switch (the circle's raster, 50 to 83 ms; a wait on the system's compositor, 50 ms), theme back (incremental GC, 50 ms), window open (field.ts frame callback, 67 ms), window close (a restyle of 56 elements after .thaw-actions' animation, 50 ms), load (GPU raster, 50 ms). projects' two causes are in 1 of 8 light runs only.
- Control for the compositor waits (run 2026-11-08T14-49-36-36c7, price): with the page's full-screen fixed layers away (.ambient, .cursor-light), window/open@1x 15.5 to 9 late frames, window/close 11.5 to 9, theme/back -2, all better; carousel same. The page aggravates those waits, so they are the page's (the 2026-11-07 reading, "the screen's, not the page", was too quick). Bisecting which layer next.

## 2026-11-08 16:24 · bisect · found

- **Hypothesis:** which of the page's fixed layers aggravates the window's frames (the two together: window/open 15.5 to 9)
- **Change:** take away css:.ambient::before{display:none!important}, css:.ambient::after{display:none!important}, hide:.ambient-dots, hide:.cursor-light on worktree
- **Result:** hide:.cursor-light holds window's frames: confirmed on a 15-minute run (5 split(s) priced, screened by frames).
  - hide:.cursor-light window/open@1x: better
  - hide:.cursor-light window/close@1x: better
- **Run:** 2026-11-08T15-18-58-fc21 on darwin-i5-1038ng7-8c-chrome156-95adeb

## 2026-11-08 · why the Mac "locked" during runs

- Not the screen lock: macOS's window server stopped answering and was restarted by its watchdog (`WindowServer ... userspace_watchdog_timeout`, "25 induced crashes" in the last report), which drops the session to the login screen and takes the browser and the agent's app with it. Nine reports in two days (2026-11-06 23:28; 11-07 12:32, 17:04, 18:26, 20:55, 23:47, 23:49; 11-08 12:23, 12:54, 16:57), each at a run that stopped short. Its main thread was blocked over 5 s in the kernel, the shape of a wait on the GPU driver.
- Changed: the measuring viewport 1600 x 960 to 1280 x 800 (a third fewer pixels a frame on the Retina display; 5d65bad), two seconds between blocks on macOS, and no frames for ten minutes after a restart (frameproof 4b66b9f). Measurements before and after this don't compare.
- Also on the way: frameproof's cache (8.2 GB, 156,219 files) was being indexed by Spotlight as it was written; it now lives in .noindex folders and old builds are pruned (frameproof ae1466b).
- 2026-11-08 17:42: the window server was restarted again a minute into a run, at 1280 x 800 and with pauses between blocks. In all, 15 watchdog reports from 2026-11-04 19:31 (the first frame run on this Mac) to now, none before. Frame measurements on this Mac stop here: frameproof now refuses them after two restarts in 24 hours (frameproof commit "no frame runs on a Mac whose window server keeps being restarted"). The cursor light's change (field.ts, global.css) stays uncommitted, unmeasured.

## 2026-11-08 23:48 · compare · worse

- **Hypothesis:** headless: field.ts, the cursor light goes out at once as a window opens instead of fading through its frames; bisect: window/open 9 to 4 without it
- **Change:** HEAD (36313f8) → worktree
- **Result:** worktree against HEAD (36313f8), 16 strata in 43.8 min. worse: window/open@1x, theme/switch@1x; inconclusive: window/close@1x, carousel/next@1x, theme/back@1x; same: carousel/back@1x. mode: frames from [::1] shared the page's process. (measured headless: frames on Chrome's own clock, not the display's; compare only with headless runs)
  - window/open@1x: worse, +5 late frames a step [-0.2, 9.2] (confirmed on fresh repetitions (typical frames, p=0.016 after Holm))
  - window/close@1x: inconclusive, 0 late frames a step [-4.16, 3.79] (the interval [-4.16, 3.79] is wider than the margin of ±2)
  - carousel/next@1x: inconclusive, +2 late frames a step [-0.23, 5.2] (first run p=0.002 did not survive the confirmation run)
  - carousel/back@1x: same, 0 late frames a step [-1.25, 1.25] (the interval sits inside the margin of ±2)
  - theme/switch@1x: worse, +2 late frames a step [-3.7, 12.2] (confirmed on fresh repetitions (rare episodes, p=0.004; the typical frames, first run p=0.005, did not hold))
  - theme/back@1x: inconclusive, +1 late frames a step [-2.2, 3.2] (first run p=0.045 did not survive the confirmation run)
- **Run:** 2026-11-08T23-02-44-32c8 on darwin-i5-1038ng7-8c-chrome156-95adeb
- Headless, the way to measure frames without the window server (run 2026-11-08T23-02-44-32c8; watchdog reports stayed at 15 through 44 minutes): the cursor light going out at once was worse, window/open@1x 41 to 48 late frames (p = 0.016), theme/switch worse too. Not integrated, reverted. Headless frames read far higher than windowed ones (window/open 41 against 9 to 16) with more of them in the GPU and display compositor, the likely sign of compositing in software: headless can judge the main thread's work, not the GPU-bound freezes that are left (window, theme, the cursor light).
