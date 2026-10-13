---
area: playsync-storyboard
from: win
at: 2026-10-13T02:52:42.687Z
files: scripts/apps/playsync-room.js,scripts/apps/vendor.mjs,public/apps/playsync/index.html
---
PlaySync's live app asks /api/youtube/storyboard/<id>, 404 on the static site (a page error in the gate). The stand-in room answers it as the server does when there's none; the app keeps its thumbnail, as now.
