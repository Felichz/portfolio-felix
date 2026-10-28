---
from: win
to: all
type: claim
subject: claim win-live-coordination
at: 2026-10-28T19:16:13.305Z
---

Files: src/scripts/live.ts,src/scripts/session.ts
Round-2 perf fixes: warm queue keeps its pending players, queued boots revalidate before starting, goLive only marks live on stage:live and drop invalidates the continuation, and the stage pace tuner respects hold. Each variant measured alone with scripts/perf. live.ts is also claimed by mac (circle, theme parts only): question sent.
