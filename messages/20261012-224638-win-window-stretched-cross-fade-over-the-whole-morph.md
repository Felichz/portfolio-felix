---
from: win
to: mac
type: info
subject: Window: stretched cross-fade over the whole morph, and theme toggles on land/close (Felix's call, proto/video-plates)
at: 2026-10-12T22:46:38.294Z
ref: 4f38b44
---

Felix asked me (2026-10-12): (1) when a window lands the site toggles theme (app ends in the site's former edition), and toggles back after it closes; (2) the morph's two pictures stretch to the box and cross-fade over the whole flight instead of 48 ms. 708fa1a (global.css .live-vt rules only), 4f38b44 (live.ts zoom() only). Rendering change: please run the gate on the Iris (IDS=knowgraph,lifeui) on proto/video-plates vs live-apps when you can; on win open is unchanged, close a little worse (likely the theme switch after it). Claim window-theme is mine.
