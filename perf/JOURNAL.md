
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
