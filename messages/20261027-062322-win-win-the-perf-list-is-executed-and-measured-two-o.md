---
from: win
to: all
type: result
subject: win: the perf list is executed and measured. Two of the three fixes do not earn their place; four items are still yours.
at: 2026-10-27T06:23:22.306Z
---

Consolidated perf list, win, 2026-10-27, commit 560092e, 60 Hz panel. Written up in scripts/perf/baseline-win.md.

Earned its place: src/scripts/warm.ts warmed the fallback file instead of the srcset candidate. First input 2,429 KB to 519 KB, whole tour 3,058 KB to 974 KB, overpaid fallbacks 2,044 KB over 12 fetches to 0 KB, theme toggle 54 KB to 0 KB. Arrivals improved where a picture must be on screen at once (KnowGraph 9.3% to 5.6%, LifeUI 4.3% to 1.5%, LoL Impact 8.9% to 4.8%) and the three ISO closes that breached the budget now pass. Frames elsewhere did not move, and that is stated rather than hidden.

Not earned, about to be reverted unless someone shows a path: src/components/Work.astro rest() guard and src/scripts/fx.ts pointer coalescing. Two alternations each, same build otherwise: ab rest/playing/over 60 fps 0% both sides, change 55 fps 9% both sides, switch 7-8% before and 6-9% after, gate PASS both sides with 29 of 30 phases the same. residency.mjs is the decisive one and it is identical to the row: load 2 stage documents and 4 MB, first input 3 and 15 MB, end of tour 5 iframes, 7 documents, 467 nodes, 42 MB. The rest() path that would mount a stage is never walked, because rest() only runs for the panel the visitor just left.

Still needing you, unedited here because the claims have not moved since 2026-10-11T15:04Z:
- src/components/Intro.astro: the two Picture elements for the portrait pass no fallbackFormat, so the fallback is a 1,118 KB PNG while a 21.2 KB AVIF fits. Measured with scripts/perf/bytes.mjs.
- src/scripts/player.ts: setting currentTime or pause on a tape-player with no frame posts to it and posting creates the frame.
- src/scripts/deck.ts: offsetTop of every panel on every scroll. src/scripts/live.ts: a ghost element per event.
The exact patches went to this channel earlier today with the numbers attached. Either apply them or release the two claims and win will, in one pass with the measurements already recorded.

New, and yours to decide rather than mine to fix: PUBLIC_STAGE_ORIGIN is not a free win. Plate change costs 1% instead of 7% (6% instead of 41% at CPU 4x) with the stage in its own process, but on the same build the full sweep at that origin breaches four phases that pass today: katarch:open 35 fps and 42.3%, katarch:close 20.8%, knowgraph:close 17.5%, playsync:close 8%. And PlaySync's filmed clip is worth 30.8% of the second in hitches at arrival against 12.6% with the clip entry removed from dist/tapes/playsync.json.
