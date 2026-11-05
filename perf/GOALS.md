# Performance goals

What only a person knows, written down so that an agent doesn't have to ask again, and doesn't settle a
trade-off by itself. frameproof gives evidence; the decisions are here.

Taken from the portfolio's `CLAUDE.md` ("What Felix wants first", "Deciding trade-offs"), where Felix
wrote them on 2026-10-11 and 2026-11-03. Change them there or here, never only in one place.

## Which interactions matter most?

In order. Each one is measured by the scenario named in backticks.

1. The page's scroll: `scroll`.
2. The products carousel, changing product: `carousel`.
3. The projects themselves, opening a live app over its preview: `window`.

The window that opens over a preview and the theme switch come after these three.

## What counts as a modest machine?

A modest laptop: the CPU throttled 4x. The laptop this runs on is fast, so every comparison that counts
for a visitor is run at 4x, and the normal speed is run too, to see that nothing got worse there.

- Throttle: 4x

## What won't you trade away?

Things that stay even when they cost frames.

- The window keeps its view transition. Its 70 to 100 ms at 4x is accepted (the transform alternative
  measured worse).
- The theme switch is a circle that reveals from the toggle, not a fade, even when it doesn't reach 60 fps.
- A preview's window opens with the app live, not over its recording.
- Costs paid once per browser are accepted, unless they land at load or on the first interaction. Heavy
  work isn't moved to the arrival to save it later.

## Decided so far

- 2026-11-03: Felix's own apps may be changed, on their main branch, measured here with the app vendored
  again. The employer's repos (`seekr`, `design-system`) are never touched.
- 2026-11-03: infrastructure may be added when it serves this work (a second hostname for the stages).
- 2026-11-03: the GPU's first shaders on a first visit to PlaySync (450 ms in an empty profile) stay.
