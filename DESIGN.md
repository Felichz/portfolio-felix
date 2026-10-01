---
name: Felix Andersson
description: A desktop-app portfolio, third edition. One fixed window with full-height sections that move one at a time, warm stone and near-black editions, frosted surfaces under ambient light, one variable grotesque with an italic serif aside, and product color that lights the room.
colors:
  bg: "#f2f1ed"
  bg-2: "#e9e7e1"
  surface: "rgb(255 255 255 / 0.58)"
  surface-strong: "rgb(255 255 255 / 0.82)"
  surface-solid: "#fbfaf7"
  ink: "#111114"
  ink-2: "#505058"
  ink-3: "#686870"
  line: "rgb(17 17 20 / 0.08)"
  line-2: "rgb(17 17 20 / 0.15)"
  house: "#0d7a5f"
  house-2: "#13a07c"
  bg-dark: "#0a0a0c"
  bg-2-dark: "#111115"
  surface-dark: "rgb(24 24 30 / 0.55)"
  surface-strong-dark: "rgb(28 28 34 / 0.82)"
  ink-dark: "#eeeeea"
  ink-2-dark: "#a5a5ad"
  ink-3-dark: "#8a8a93"
  line-dark: "rgb(255 255 255 / 0.07)"
  line-2-dark: "rgb(255 255 255 / 0.13)"
  house-dark: "#5fd6b0"
  house-2-dark: "#3fbf9a"
typography:
  display:
    fontFamily: "Archivo"
    fontSize: "clamp(3.25rem, min(9.4cqw, 17cqh), 10rem)"
    fontWeight: 820
    fontStretch: "112%"
    lineHeight: 0.86
    letterSpacing: "-0.045em"
  section:
    fontFamily: "Archivo"
    fontSize: "clamp(2rem, min(4.6cqw, 7.4cqh), 4rem)"
    fontWeight: 790
    fontStretch: "96%"
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  aside:
    fontFamily: "Newsreader"
    fontStyle: italic
    fontWeight: 400
  lede:
    fontFamily: "Archivo"
    fontSize: "clamp(1rem, 0.94rem + 0.35vw, 1.25rem)"
    lineHeight: 1.5
  body:
    fontFamily: "Archivo"
    fontSize: "1rem"
    lineHeight: 1.55
  label:
    fontFamily: "Archivo"
    fontSize: "0.75rem"
    fontWeight: 640
    fontStretch: "86%"
    letterSpacing: "0.06em"
    textTransform: uppercase
rounded:
  focus: "6px"
  plate: "14px"
  card: "22px"
  portrait: "28px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 2.6vw, 40px)"
  bar: "64px"
  rail: "76px"
  max: "1560px"
---

# Design System: Felix Andersson

## Overview

**Creative North Star: "The Studio Window"**

The site behaves like a desktop app in a fixed window. A bar on top, a rail of section dots down the left edge, and a vertical deck of full-height sections that moves one section per gesture: Intro, Work, Experience, About on the home page; Overview, Story, Engineering, Screens, Specs on each case study. The document itself never scrolls; the deck does. When something needs more room than the window has, that one section or card scrolls inside itself, the way a pane does in an app.

The room has light. A warm ambient glow drifts behind everything, over a faint dot grid and a film grain. Each panel names the colors the light drifts to: the house jade on the intro, the active product's accent on the work showcase and on a case study. Surfaces are frosted: translucent, blurred, a hairline ring and a lit top edge. Nothing is flat, and nothing shouts.

Experience and projects are kept apart on purpose. Work is the portfolio: five products, shown as products. Experience is the CV: roles on a continuous timeline, with the detail of each role below. The positioning is a senior IC who owns problems end to end; no single metric carries it (the 100k-row filtering is one example among several).

## Layout

- `html.app` is a grid: the bar across the top (`--bar-h`), the section rail in a left column (`--rail-w`), the deck beside it. Height is `100dvh`; `overflow: hidden` on the document.
- `.stage` is the deck: vertical scroll with mandatory snap and `scroll-snap-stop: always`. Each `.panel` is one window tall, a size container (`container: panel / size`), and scrolls inside only if its content overflows. Panels pad their right side by the rail width, so content stays centered in the window.
- Every desktop section fits the window with no scroll (checked at 1280×720, 1366×768, 1536×730, 1440×900, 1920×911 and 1920×1080).
- Content sizes itself against the window with container units (`cqw`, `cqh`): the showcase plate is `min(100cqw, (100cqh - info) * 1.6)`, the case study lead plate is `min(100cqw, (100cqh - chrome) * 1.6)`, the portrait is `80cqh` tall at most.
- Short windows tighten (container `max-height` queries); wide-and-short showcase windows move the product copy beside the screenshot (`min-aspect-ratio: 3 / 2`).
- Phones: the rail becomes a bottom tab bar, and the deck scrolls naturally with loose snapping; each section is at least one screen tall and grows with its content.

## Navigation

One `go()` in `src/scripts/deck.ts` drives everything:

- Desktop wheel and trackpad: one gesture moves one section. If the pointer is over something that can still scroll in that direction, that scrolls instead. After scrolling something inside a section, reaching its edge never changes section right away: the wheel has to rest for 0.9s first, so inner and section scrolling never compete.
- Keys: down and up arrows, Page Down and Page Up, Space, Home and End. A section that overflows scrolls first. Anything marked `data-own-keys`, form fields and open dialogs keep their keys.
- Bar tabs, the rail's dots (labels show on hover and focus), and any `#section` or `#section/sub` link. The address follows the active section with `replaceState`; a deep link opens on its section before first paint. Escape on a case study goes back to the showcase on that product.
- No arrow buttons or keyboard hints on screen: the dots are the only navigation chrome.

## Colors

- **Editions.** Warm stone (`#f2f1ed`) with near-black ink, and near-black (`#0a0a0c`) with off-white ink. Chosen before first paint from the saved choice or the system setting. The toggle reveals the new edition in a circle from the button (one view-transition snapshot), with every element transition suspended meanwhile; off under reduced motion.
- **House jade** (`--house`, `--house-2`): the active role on the timeline, "now", strength markers, focus rings, selection. Used sparingly. No status dots.
- **Product accents** come from `projects.ts` and are set per element with `data-accent`. They color pins, the showcase rail, highlight ticks, the case study's primary button, and the ambient light.
- **Opposite-edition captures.** Screenshots and recordings print in the opposite edition from the site (dark products on the light site, light on the dark). The browser chrome around them follows the capture, not the site.

## Typography

- **Archivo**, variable width and weight, is the house face. The intro name is set one glyph at a time: each letter widens from 62% to 112% on arrival and swells toward the pointer afterwards.
- **Newsreader italic** for short editorial asides ("building interfaces people can trust.", "I'd like to hear about it.").
- **Product faces** (Inter, Newsreader, Bricolage Grotesque, Martian Mono) set every product name, in the rail, the intro shelf, the case study title and the build sheet.
- Labels are small caps-style uppercase at 86% width with open tracking.

## Surfaces and depth

- `.glass`: a mostly opaque surface, hairline ring, inner top highlight, layered soft shadow. Cards, the showcase rail, the timeline, the toolset. No backdrop blur anywhere: it made scrolling and theme switches slow.
- `.spot`: a soft light that follows the pointer across a card, tinted with `--spot` (the product accent on product cards).
- `.chip`: pill with the same lit edge; used for the clock.
- Plates: a product window with browser chrome (three dots, the first in the product accent, a lock and the live domain). Phones get a bezel instead.
- The contact card is printed in the other edition, with the house light pooling in its corner.

## Pointer interaction

All off on touch screens and under reduced motion; none of it runs when the pointer is still.

- **Cursor light** (`src/scripts/field.ts`): a soft pool of the room's glow color follows the pointer across the page background and brings up the dot grid under it. Nearby dots grow, brighten and bulge outward as if under a lens. The pool is a CSS gradient and the dots a small canvas around the pointer, both moved with `translate` in their own fixed layer outside `.ambient`, so a frame redraws only that area (a full-window canvas made the whole screen recomposite every frame and held the page to about a third of its frame rate). The loop stops once the light settles. Content surfaces are opaque, so it lives in the gaps; and on or within about 44px of text, the dots fade to near nothing and stop bulging, so they never compete with reading (sampled every 90ms with `elementFromPoint`).
- **Magnetic buttons**: buttons lean up to 3px toward the pointer (the `translate` property, so hover transforms still apply).
- **Tilt**: the portrait and the showcase window lean toward the pointer with a sheen that follows it.
- **Timeline scrubber**: a hairline follows the pointer across the Experience timeline and names the month and the role ("Jan 2023 · Meraki Dashboard").
- The name swells toward the pointer along Archivo's width axis; cards carry a soft spotlight.

## Components

- **Bar**: an FA mark and name, a segmented tab strip with a sliding pill, the Montevideo clock, the theme toggle, the résumé.
- **Section rail** (`Dock.astro`): a vertical line with one dot per section down the left edge; the current dot is filled, labels appear on hover and focus. On phones: the tab bar.
- **Intro**: the variable name, role with the serif aside, lede, actions, four strengths (design systems, complex UI, ownership, AI-native tooling); the portrait (a dark studio shot on the light site, a white one on the dark site, only the visible one downloaded) tilts toward the pointer with a sheen; its caption gives the location and time in frontend (computed at build, rounded honestly: "Nearly 6 years"). Nothing overlaps the photo.
- **Showcase** (signature): a rail of six products (this site is the sixth) and a stage. The active product's recording plays once, holds on its final frame (which matches the still), then the next product slides in. The active rail item fills from left to right with a wash of the product accent as its turn runs. Reading the product copy or focusing inside pauses the countdown; the button turns auto-advance off; reduced motion starts with it off. Automatic turns are not announced; turns the visitor drives are.
- **Timeline**: a Gantt of roles from 2020 to now in one continuous lane (each bar runs until the next role starts), a "now" marker, bars that pick the role shown below. The current role adds a card of examples in prose (the AI engineering stack, responsive tables on large datasets, what the team lead said). No diagrams: no single example should read as the whole job.
- **Case study**: an optional How it works chapter (`deepDive` in `projects.ts`) sits between Engineering and Screens, with numbered steps and measured numbers; this site's case study uses it.
- **Case study**: Overview (name, tagline, facts, actions, lead plate with pins and its recording), Story (the story beside the annotated screenshot and its legend), Engineering (three numbered cards and the stack), Screens (desktop captures on a grid, the phone as a full-height column), Specs (build sheet and the next case study).

## Tapes and live apps

- **Tape**: a product preview that is the app's own DOM, not a video of it. `scripts/tapes/record.mjs` drives a scene (`scripts/tapes/scenes/<id>.mjs`) in headless Chrome with a recorder in the page: a snapshot, every change as the parent's full child list, attribute and text values, form values, scroll, pointer, hover, focus and pressed state, and checkpoints at rest points with the app's storage and clock. `<tape-player>` (`src/scripts/tape.ts`) replays it in a sandboxed, script-less iframe with the app's real stylesheet, rewritten so `:hover`, `:focus` and `:active` match recorded attributes. It mirrors enough of HTMLMediaElement for the showcase and the case study plates to drive it like a video. One tape serves both editions: the app's theme attribute is set to the opposite of the site's, on the same frame.
- **Live previews** (`src/scripts/live.ts`): after the visitor's first input and only for the preview on screen (in view, and not in an inactive showcase slide), the vendored build (`public/apps/<id>/`) boots in an iframe under the tape, scaled like it, with the storage of the last checkpoint. It keeps up with the tape: each recorded click is replayed when the tape reaches it, with the app's clock frozen at that moment (`scripts/apps/bridge.js` owns Date and the timers), and a tape that goes back restarts it. Hover lifts the plate (`scale: 1.025`), holds the showcase countdown, and swaps the tape for the app on the same frame; from there the preview is the app (hover, cursors and clicks are its own; the wheel still scrolls the page). Its bar has only the window lights, Mac colors: in the preview red and yellow are grey and green opens the app in a window; in the window red and yellow light up and take it back. The lights keep to the pointer's side of the window, moving with a stretch, a squash against the far corner and a small bounce (transform only). The window is built at the room the screen has and the app runs in it at its own size (1:1, scaled only below 1100px wide); it flies as one piece, clipped to the plate at the start, and `.plate-motion` is moved into it with `moveBefore`, iframes intact. Under it, in the site's own edition: Case study (in the showcase), Live site, Source, and the Escape hint. Red, yellow, Escape, a click outside or Back reverse it, and the app goes back into the plate, still live. The site's theme switch reaches the app on the same frame, so the switch's circle spreads over it too. One app at a time; it's dropped when its preview leaves the screen. Without `moveBefore`, green goes to the case study or the live site. Lighthouse (desktop): 100 in every category, 0 ms TBT.
- This site's own preview is a tape of its Intro, and its live preview is the site itself, running inside itself; a framed copy starts at rest (`html.framed`) and never boots apps of its own.

## Motion

- Section contents reveal once, staggered, the first time a section is active.
- The ambient light changes color over 0.9s through registered custom properties, transitioned on the ambient layer only so nothing else restyles.
- A theme switch never restarts a recording or the showcase countdown: the other edition's video seeks to where the visible one will be once it starts, and the reveal waits only for that frame (at most 200ms), see `src/scripts/handoff.ts`. Recordings are encoded with a keyframe every second so that seek stays around 60ms.
- Every animation has a reduced-motion path: no tilt, no letter swell, no autoplay, no theme reveal, instant section moves.

## Do's and Don'ts

Do:
- Keep the window fixed. New content goes into a section, or scrolls inside one.
- Size against the window with container units, and check 1280×720, 1440×900, 1920×1080 and a phone.
- Keep the product accent the only strong color on a product's panels.
- Keep every number sourced (see PRODUCT.md).

Don't:
- Let the document scroll, or build a section that only works at one height.
- Give an employer its own section. Roles live on the Experience timeline.
- Put chips or labels over the portrait, or use small photo crops.
- Use backdrop blur, full-screen blend modes or animated full-screen layers.
- Add green "online" dots or navigation hints.
- Use em-dashes in copy.
