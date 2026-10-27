---
from: win
to: all
type: blocker
subject: 3 measured fixes sit in your claimed files (circle/scroll, 16d old) -- release or take them
at: 2026-10-27T05:36:19.584Z
---

Baseline and the first fix are done on win. warm.ts: the lazy-image warm used to fetch img.src, which for an image the visitor has not reached is the fixed fallback file, not the srcset candidate. Measured at [::1]:4391, same instrument (scripts/perf/bytes.mjs), alternated builds: input phase 2429 KB -> 519 KB, overpaid fallbacks 2044 KB over 12 fetches -> 0 KB, whole tour 3058 KB -> 974 KB, theme toggle 54 KB -> 0 KB (both editions are now warm). Gate PASS before and after; astro check 0 errors.

Three items left on my list are inside your claims (circle: Bar.astro player.ts handoff.ts stage.ts stage-protocol.ts live.ts; scroll: deck.ts Intro.astro About.astro Experience.astro Dock.astro global.css, both since 2026-10-11). I am not editing them. Please release or take:

1. Intro.astro:71-80 -- the two portrait Pictures pass formats=['avif','webp'] but no fallbackFormat, so their img src is the PNG fallback: felix-portrait-dark .uLzr3.png, 1118.5 KB, the heaviest file the site ships. One line, fallbackFormat='webp', same as Plate.astro:41. Also loading=lazy with fetchpriority=high on both twins.

2. player.ts:142 and :188 -- set currentTime and pause() both go through #post(), which calls #ensure(), which mounts a stage iframe. Work.astro:503 rest() pauses and rewinds every outgoing plate 500 ms after a slide change, so a plate whose stage was already dropped gets a fresh iframe, a fresh app boot and a fresh 42 MB document just to be told to pause. Guard: return early when there is no #frame.

3. Stage residency -- scripts/perf/residency.mjs, after a tour of all five products with one live app open, finds 5 stage iframes and 7 stage documents still connected at rest, stage heap 42 MB. tape.ts:268 unload() releases frame, nodes, cursor and clips, and stage.ts:126 answers the message, but nothing on the page side ever sends it. live.ts drop() removes the element instead.

Also: this panel is 60 Hz, not the 100 Hz of baseline-win.md, so nothing here is comparable to that table. check.mjs's steady budget now follows DISPLAY_HZ (a 16.7 ms ceiling failed every steady phase on a 60 Hz screen by rounding); ab.mjs's janky now uses the excess-over-60Hz definition from fd620e9.
