---
name: Felix Andersson
description: A desktop-app portfolio, third edition. One fixed window with a horizontal deck of panels, warm stone and near-black editions, frosted surfaces under ambient light, one variable grotesque with an italic serif aside, and product color that lights the room.
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
  dock: "60px"
  max: "1560px"
---

# Design System: Felix Andersson

## Overview

**Creative North Star: "The Studio Window"**

The site behaves like a desktop app in a fixed window. A bar on top, a dock at the bottom, and between them a horizontal deck of full-window panels: Intro, Work, Experience, About on the home page; Overview, Story, Engineering, Screens, Specs on each case study. The page never scrolls vertically. When something needs more room than the window has, that one panel or card scrolls inside itself, the way a pane does in an app.

The room has light. A warm ambient glow drifts behind everything, over a faint dot grid and a film grain. Each panel names the colors the light drifts to: the house jade on the intro, the active product's accent on the work showcase and on a case study. Surfaces are frosted: translucent, blurred, a hairline ring and a lit top edge. Nothing is flat, and nothing shouts.

Experience and projects are kept apart on purpose. Work is the portfolio: five products, shown as products. Experience is the CV: roles on a timeline, with the Cisco evidence (100k rows at 60 FPS, the AI review tooling) inside the role it belongs to rather than a chapter of its own.

## Layout

- `html.app` is a three-row grid: `--bar-h`, the deck, `--dock-h`. Height is `100dvh`; `overflow: hidden` on the document.
- `.stage` is the deck: horizontal scroll with mandatory snap and `scroll-snap-stop: always`. Each `.panel` is 100% wide, a size container (`container: panel / size`), and scrolls on the y axis only if its content overflows.
- Panel content sizes itself against the window with container units (`cqw`, `cqh`): the showcase plate is `min(100cqw, (100cqh - info) * 1.6)`, the case study lead plate is `min(100cqw, (100cqh - chrome) * 1.6)`, the portrait is `84cqh` tall at most.
- Short windows tighten (container `max-height` queries); wide-and-short showcase windows move the product copy beside the screenshot (`min-aspect-ratio: 3 / 2`).
- Phones keep the same deck. The dock becomes a tab bar with icons; each panel scrolls inside itself; the showcase rail becomes a row of chips.

## Navigation

One `go()` in `src/scripts/deck.ts` drives everything:

- Vertical wheel: one gesture moves one panel. If the pointer is over something that can still scroll in that direction, that thing scrolls instead, and a gesture that started scrolling inside never flips the page halfway.
- Horizontal trackpad and touch swipes scroll natively with snapping.
- Keys: left and right arrows, Page Up and Page Down, Home and End. Anything marked `data-own-keys`, form fields and open dialogs keep their keys.
- Bar tabs, dock ticks, the dock's previous and next buttons, and any `#panel` or `#panel/sub` link. The address follows the active panel with `replaceState`; a deep link opens on its panel before first paint.
- From the last panel the dock's next button leads on: back to the start at home, to the next case study on a case study. Escape on a case study goes back to the showcase on that product.

## Colors

- **Editions.** Warm stone (`#f2f1ed`) with near-black ink, and near-black (`#0a0a0c`) with off-white ink. Chosen before first paint from the saved choice or the system setting. The toggle reveals the new edition in a circle from the button (view transition), off under reduced motion.
- **House jade** (`--house`, `--house-2`): availability, the active role on the timeline, "now", focus rings, selection. Used sparingly.
- **Product accents** come from `projects.ts` and are set per element with `data-accent`. They color pins, the showcase rail, highlight ticks, the case study's primary button, and the ambient light.
- **Opposite-edition captures.** Screenshots and recordings print in the opposite edition from the site (dark products on the light site, light on the dark). The browser chrome around them follows the capture, not the site.

## Typography

- **Archivo**, variable width and weight, is the house face. The intro name is set one glyph at a time: each letter widens from 62% to 112% on arrival and swells toward the pointer afterwards.
- **Newsreader italic** for short editorial asides ("building interfaces people can trust.", "I'd like to hear about it.").
- **Product faces** (Inter, Newsreader, Bricolage Grotesque, Martian Mono) set every product name, in the rail, the intro shelf, the case study title and the build sheet.
- Labels are small caps-style uppercase at 86% width with open tracking.

## Surfaces and depth

- `.glass`: translucent surface, 18px backdrop blur, hairline ring, inner top highlight, layered soft shadow. Cards, the rail, the timeline, the toolset.
- `.spot`: a soft light that follows the pointer across a card, tinted with `--spot` (the product accent on product cards).
- `.chip`: pill with the same lit edge; used for status and the clock.
- Plates: a product window with browser chrome (three dots, the first in the product accent, a lock and the live domain). Phones get a bezel instead.
- The contact card is printed in the other edition, with the house light pooling in its corner.

## Components

- **Bar**: avatar and name, a segmented tab strip with a sliding pill, the Montevideo clock, the theme toggle, the résumé.
- **Dock**: panel number and name, a progress track fed by the deck's scroll, keyboard hint, previous and next with the next panel's name. On phones: the tab bar.
- **Intro**: status chip, the variable name, role with the serif aside, lede, actions, a shelf of product names in their faces; the portrait card tilts toward the pointer with a sheen, and three frosted chips float on the wall and the shirt, never over the face.
- **Showcase** (signature): a rail of five products and a stage. The active product's recording plays once, holds on its final frame (which matches the still), then the next product slides in. The rail item fills with the product accent as its turn runs. Reading the product copy or focusing inside pauses the countdown; the button turns auto-advance off; reduced motion starts with it off. Automatic turns are not announced; turns the visitor drives are.
- **Timeline**: a Gantt of roles from 2020 to now in two lanes (client work, own products), a "now" marker, bars that pick the role shown below. The current role's closer look has tabs: the main-thread schematic and the AI review pipeline.
- **Case study**: Overview (name, tagline, facts, actions, lead plate with pins and its recording), Story (the story beside the annotated screenshot and its legend), Engineering (three numbered cards and the stack), Screens (desktop captures on a grid, the phone as a full-height column), Specs (build sheet and the next case study).

## Motion

- Panels ease in and out with the deck's scroll (a `view(x)` timeline), and their contents reveal once, staggered, the first time a panel is active.
- The ambient light drifts slowly and changes color over 1.4s through registered custom properties.
- Every animation has a reduced-motion path: no drift, no tilt, no letter swell, no autoplay, instant panel moves.

## Do's and Don'ts

Do:
- Keep the window fixed. New content goes into a panel, or scrolls inside one.
- Size against the window with container units, and check 1280×720, 1440×900, 1920×1080 and a phone.
- Keep the product accent the only strong color on a product's panels.
- Keep every number sourced (see PRODUCT.md).

Don't:
- Add a page-level vertical scroll, or a panel that only works at one height.
- Give an employer its own section. Roles live on the Experience timeline.
- Put chips or labels over the face in the portrait.
- Use em-dashes in copy.
