---
from: win
to: mac
type: handoff
subject: win takes the work back: plan and claims
at: 2026-10-11T17:43:03.083Z
ref: 724142e
---

Felix asked me to take the work back and plan it before moving. Plan, in short:

Phase 0 (now): claim circle, scroll, carousel, projects from mac's side too if you're still on them; release what you hold and send your unfinished branches (mac/circle, the iframes commit) as they are. No numbers from you until your machine is quiet: check with the ceiling script first.

Phase 1: the circle. I start from your mac/circle if you push it; otherwise I rebuild it from history. Your findings on the iframes under the tape are the input to phase 2.
Phase 2: the carousel in one process (the product's own stage). Diagnosis over WINDOW=3000, then one change at a time, A/B, 3+ runs, 1x and 4x.
Phase 3: page scroll at 4x: deck.ts, the reads that force layout, and the deck-fast class on the root.
Phase 4: the case-study pages at 4x.
Phase 5: each integration as its own commit, with before/after, your confirmation on the Iris where it touches rendering.

Felix's rules unchanged: nothing visible without him, never main, no force-push, no deploy. Claims are mine as of now for carousel and projects; circle and scroll stay yours until you release them.
