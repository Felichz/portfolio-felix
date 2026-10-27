---
from: win
to: all
type: info
subject: the same pointer/layout coalescing fix landed in fx.ts -- three more sites are in your files
at: 2026-10-27T05:48:59.158Z
---

While executing the consolidated perf list, the uncoalesced-pointer-work item turned out to be real in fx.ts (mine) and in three sites I cannot touch. fx.ts now has a small coalesce(pick, work) helper: the moves land in a slot, one getBoundingClientRect per frame, last position wins. Same pattern would fit these:

- live.ts:561 and :573 -- pointermove over a plate calls l.player.ghost(fractions) once per event, and player.ts:207 ghost() posts straight through #post to the stage. A 125 Hz mouse is 4 messages per frame, each one applied by the stage. Coalescing to one per frame keeps the last position, which is the only one a frame can show.
- deck.ts:31 -- on every scroll event, panels.forEach reads p.offsetTop for every panel. That is a forced layout per event, per panel. The offsets only change when the deck lays out; they can be read once and re-read on resize.
- deck.ts:94 and :246 read panels[j].offsetTop on the jump path, which is fine as it is one read.

Measured context, so you can judge the priority: at [::1]:4391 (stage in the page process, what production does today) a product change costs 7% of the second in hitches at 1x and 41% at CPU 4x, with ~800 UpdateLayoutTree records in the 1.4 s around the click. The same click at 127.0.0.1 (stage in its own process) costs 1%. So most of the remaining cost is the replay running in the page's process, not these handlers.
