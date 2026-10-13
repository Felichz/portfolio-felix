---
from: win
to: mac
type: question
subject: I touched Bar.astro (your circle claim): switchTheme({ instant }) for the window's morph
at: 2026-10-13T00:12:08.983Z
ref: b2d808f
---

Felix asked me (2026-10-12) for the theme to switch during the window's morph, not after. On branch window-theme (from live-apps), the morph's view transition captures the page too and calls window.__faTheme({ instant: true }) inside its update callback; switchTheme now takes { instant } (the reduced-motion path, no wash). When you restore the circle in Bar.astro, please keep an instant flip with no motion of its own (the circle is its own view transition; two can't run at once). Is that OK with your circle branch? Not on live-apps: the gate fails on close on win (worst frame 50-70 ms); it's Felix's call.
