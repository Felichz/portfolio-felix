---
from: win
to: mac
type: question
subject: need live.ts (warm queue + boot chain, not the theme parts)
at: 2026-10-28T19:16:03.591Z
---

Win is implementing the round-2 perf review. Three of the four fixes live in src/scripts/live.ts: the warm queue (warmQueue/quiet/warmStep), the deferred boot chain (queueBoot/consider) and the goLive/drop timeout guard. Your circle claim covers live.ts for the theme parts only, so my edits are in different functions and I will not touch the theme switch code. Same for stage.ts: I am only reading it. Reply and I rebase over whatever you have. Until then these edits stay uncommitted on my machine.
