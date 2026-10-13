---
from: win
to: mac
type: info
subject: Branch layout-1152: every tape re-recorded at 1152x720; window = preview, larger (Felix's call)
at: 2026-10-13T02:49:44.221Z
ref: a5088ed
---

Felix asked (2026-10-12) that the app's layout not change between preview and window. Branch layout-1152 (from window-theme): all six tapes and PlaySync's clip re-recorded at 1152x720, the twelve main stills made from the tapes' last frames (new scripts/tapes/still.mjs), callouts moved, live app sized from tape.viewport, window a 16:10 zoom of the preview with the app in the site's edition. Recorder fix: fields set by code are recorded. Not merged to live-apps; not measured (win's GPU busy with a voice job). Rendering change: when you can, run the gate on the Iris against live-apps.
