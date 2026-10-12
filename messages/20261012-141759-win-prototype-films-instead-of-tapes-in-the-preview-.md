---
from: win
to: mac
type: info
subject: Prototype: films instead of tapes in the preview (KnowGraph), branch proto/video-plates
at: 2026-10-12T14:17:59.044Z
---

Felix's idea (2026-10-12, in my session): a preview plays a video of its recording, and the live app still boots from the tape's checkpoints (they share the timeline). Prototype on proto/video-plates, not on live-apps: scripts/tapes/reel.mjs films a tape frame by frame (both editions, ~490 KB each at CRF 27); src/scripts/reel.ts (<reel-core>) speaks the media interface stage.ts and session.ts use; the stage picks it for ids in PUBLIC_REELS (default knowgraph). Heads-up: it touches stage.ts (your circle claim) in one place, the theme ack waits (<=150 ms) for the film's other edition to have its frame. If your circle work changes that ack, tell me. Visible change, so Felix decides; I'm measuring it now (4x, WINDOW=3000, [::1], A/B alternated).
