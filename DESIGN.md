---
name: Felix Andersson
description: A specimen book of interfaces, second edition. Short catalogue, two editions of the same stock (white and near-black), one variable grotesque, and color borrowed only from the products on show.
colors:
  paper: "#ffffff"
  plate: "#f4f4f2"
  raised: "#f7f7f5"
  ink: "#0d0d0f"
  ink-2: "#55555c"
  ink-3: "#6e6e76"
  rule: "#e4e4e1"
  rule-2: "#d3d3cf"
  ring: "rgb(13 13 15 / 0.12)"
  paper-dark: "#0c0c0e"
  plate-dark: "#141417"
  raised-dark: "#111114"
  ink-dark: "#ededea"
  ink-2-dark: "#a3a3aa"
  ink-3-dark: "#7c7c85"
  rule-dark: "#232328"
  rule-2-dark: "#34343b"
  ring-dark: "rgb(255 255 255 / 0.09)"
  bezel: "#0e0e10"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(3.25rem, 0.9rem + 8.2vw, 6rem)"
    fontWeight: 820
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 112"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.125rem, 1.2rem + 3vw, 3.75rem)"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 94"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem)"
    fontWeight: 720
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 96"
  title-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 720
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 94"
  product-name:
    fontSize: "clamp(3rem, 1rem + 6.4vw, 5.75rem)"
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  product-name-shelf:
    fontSize: "clamp(2.25rem, 1.4rem + 2.4vw, 3.5rem)"
    lineHeight: 1
    letterSpacing: "-0.035em"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.0625rem, 0.98rem + 0.4vw, 1.3125rem)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
    fontVariation: "'wdth' 100"
  body-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.975rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 82"
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    fontVariation: "'wdth' 92"
  nav:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 560
    fontVariation: "'wdth' 90"
rounded:
  focus: "4px"
  swatch: "6px"
  plate: "10px"
  exhibit: "14px"
  panel: "16px"
  device-screen: "21px"
  device: "26px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 48px)"
  section: "clamp(80px, 9vw, 136px)"
  block: "clamp(56px, 7vw, 96px)"
  column: "clamp(32px, 5vw, 80px)"
  shelf: "clamp(28px, 4vw, 64px)"
  control-gap: "10px"
  container: "1360px"
components:
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  button-outline:
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  icon-button:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  nav-link:
    textColor: "{colors.ink-2}"
    typography: "{typography.nav}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "40px"
  nav-theme-toggle:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    size: "40px"
  nav-resume:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.nav}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  shelf-tab:
    textColor: "{colors.ink-3}"
    padding: "6px 12px 10px"
    height: "44px"
  shelf-tab-active:
    textColor: "{colors.ink}"
  plate:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.plate}"
  plate-phone:
    backgroundColor: "{colors.bezel}"
    rounded: "{rounded.device}"
    padding: "5px"
  exhibit-panel:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.exhibit}"
    padding: "clamp(18px, 2.4vw, 32px)"
  contact-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panel}"
    padding: "clamp(24px, 3vw, 40px)"
  pin:
    rounded: "{rounded.pill}"
    size: "26px"
  palette-dot:
    rounded: "{rounded.swatch}"
    size: "22px"
---

# Design System: Felix Andersson

## Overview

**Creative North Star: "The Interface Specimen"**

The site is a foundry's specimen book, and the faces on show are interfaces. A foundry proves a font by setting it in use; this system proves each product by showing its real screens, in its real typeface, with its real accent. This is the second edition, bound as a short catalogue: one screen of name and proof, a horizontal shelf of five products, a Cisco chapter with two exhibits, an about page with a contact panel, and a case study behind each product. The page never changes ground under the reader. Products bring their faces, their screenshots and one accent each; they do not repaint the house.

The house is neutral stock printed in two editions: white paper with near-black ink, and near-black paper with off-white ink. The edition is the reader's: a saved choice, else the system setting, applied before first paint and switched from the nav with a short crossfade. Everything follows the edition, including the screenshots, which exist in both themes wherever the product has both. One variable grotesque, Archivo, carries every house voice by moving along its width and weight axes. Hairline rules divide; framed plates with printer's crop marks hold the evidence; numbered pins in the product's accent point into it.

Density is editorial rather than dashboard: generous section air, fractional two-column splits, ruled columns instead of boxes, screenshots at full measure. Motion is spent on one idea, continuity: the shelf screenshot and product name morph into the case study, and the theme switch crossfades. Everything else is quiet state feedback. The build refuses the dark developer hero, card grids, skill badges, eyebrow kickers, section numbers, side-stripe borders, gradient text and decorative grid backgrounds.

**Key Characteristics:**
- Two editions of the same stock (white and near-black), chosen before first paint; no house accent color at all.
- One variable grotesque (Archivo, wdth 62 to 125, wght 100 to 900) used across its widths as the whole house hierarchy.
- Product names and "Aa" samples set in each product's own face; each product lends one accent pair for four small marks.
- Screenshots follow the reader's edition; products without a light UI stay dark in both.
- Framed plates with a 1px ring, a soft offset shadow, and crop marks on the lead plate; numbered pins keyed to a legend.
- Hairline rules as the structural dividers; an ink rule opens a set, grey rules divide it.
- One authored motion idea: cross-document morph from shelf to case study, off under reduced motion.

## Colors

A monochrome house in two editions (paper, ink, two grays, two rules, a plate and a raised tint per edition) that lends four small marks to each product's accent.

### Primary
- **Specimen Ink** (`ink` / `ink-dark`): the house's only "color". Body text, headings, the solid button, the nav résumé pill, the ink rule that opens the highlights row and the toolset, the current stop on the timeline, and the task blocks in the main-thread schematic. It is also the ground of the contact panel. Selection inverts it against the paper. 19.4:1 on paper in light, 16.7:1 in dark.

### Neutral
- **Specimen Stock** (`paper` / `paper-dark`): the page ground in each edition, the text on ink controls and on the contact panel, the fill of pipeline nodes, and the outline ring around a pin. The `theme-color` meta carries this value and changes with the edition.
- **Plate Stock** (`plate` / `plate-dark`): the fill behind a framed screenshot before it loads.
- **Raised Tint** (`raised` / `raised-dark`): the ground of the exhibit panels that hold the Cisco diagrams, one step off the paper.
- **Pencil Gray** (`ink-2` / `ink-2-dark`): secondary copy. Ledes in muted position, taglines, timeline bodies, highlight bodies, callout legend text, labels, nav links, the theme toggle icon. 7.4:1 on paper in light, 7.8:1 in dark.
- **Soft Gray** (`ink-3` / `ink-3-dark`): the quietest legible text. Inactive shelf tabs, the PDF note on the résumé button, the "Interface in Spanish" line, schematic sublabels. 5.1:1 in light, 4.7:1 in dark; it does not go lower.
- **Hairline** (`rule` / `rule-dark`): row and cell dividers, section top rules, the nav's bottom border, the hairline ring around exhibit panels.
- **Firm Hairline** (`rule-2` / `rule-2-dark`): borders on controls at rest (outline buttons, icon buttons, keycaps), pipeline node strokes and connectors, timeline stops before now, and the schematic rails.
- **Plate Ring** (`ring` / `ring-dark`): the 1px edge around every plate, drawn as a spread shadow so it never shifts layout.
- **Bezel** (`bezel`): the phone frame around a mobile screenshot. The same near-black in both editions, because it is a device, not paper.

### Borrowed accents (product data, not house tokens)
Each product in `src/data/projects.ts` carries `accent: { light, dark, onLight, onDark }`. The element that owns a product's marks sets them inline as `--a-light`, `--a-dark`, `--on-light`, `--on-dark` and carries `data-accent`; the global stylesheet resolves them to `--accent` and `--on-accent` for the current edition. The five pairs are recorded in `.impeccable/design.json` under `extensions.productAccents`.

### Named Rules
**The Two Editions Rule.** Every house color is a pair set on `:root` and `:root[data-theme='dark']`. Components use the role (`--paper`, `--ink`, `--rule`), never a literal, so they print correctly in both editions. The edition is decided before first paint from the saved choice, else `prefers-color-scheme`; nothing on the page changes ground on its own.

**The Borrowed Accent Rule.** The house owns no hue. A product's accent appears in exactly four places: the underline under the active shelf tab, the short ticks before a slide's points, the numbered pins, and the position number on its case study. Never on buttons, links, headings, rules or grounds. An accent used as text or under pin numerals must hold 4.5:1 against paper and against its on-accent color in both editions.

**The Matching Plate Rule.** A screenshot prints in the reader's edition. Plates carry a light and a dark capture, only the matching one is displayed, and since both are lazy, only the matching one downloads. A product with no light UI of its own (KnowGraph, PlaySync) shows its dark capture in both editions and says "dark only" in its facts; never fabricate a light version.

## Typography

**Display Font:** Archivo, self-hosted variable (wdth 62 to 125%, wght 100 to 900), with ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif
**Body Font:** Archivo (same file)
**Label/Mono Font:** none in the house; labels are Archivo at wdth 82. The `--mono` stack exists only as the fallback for the product mono faces.
**Product faces (guests, not house):** Inter (400, 600), Newsreader (500), Bricolage Grotesque (700), Martian Mono (400, 700), Geist (400), Figtree (400), JetBrains Mono (500), each a single self-hosted woff2 per weight, applied through `face-*` classes.

**Character:** One grotesque plays every house role by changing width: expanded and heavy to announce the name, slightly condensed to head a section, condensed and semibold to label and operate. The guest faces are the exhibits, and the neutrality of the house face is what lets them read as specimens.

### Hierarchy
- **Display** (820, wdth 112, `clamp(3.25rem, 0.9rem + 8.2vw, 6rem)`, line-height 0.9, -0.04em): the name, once, at the top of the home page.
- **Headline** (780, wdth 94, `clamp(2.125rem, 1.2rem + 3vw, 3.75rem)`, line-height 1, -0.035em): section heads (Selected work, the Cisco chapter, How I got here). The contact question uses the same voice smaller (760, wdth 94, `clamp(1.625rem, 1.1rem + 1.4vw, 2.375rem)`, line-height 1.05).
- **Product name** (the product's own face, `clamp(3rem, 1rem + 6.4vw, 5.75rem)`, line-height 0.95, -0.035em): the head of a case study. On the shelf it runs at the shelf size (`clamp(2.25rem, 1.4rem + 2.4vw, 3.5rem)`, line-height 1) and in the pager at `clamp(1.75rem, 1.2rem + 1.8vw, 2.75rem)`. Martian Mono always runs a step smaller at weight 400 with its wordmark half (LOL) in 700; Inter tightens to -0.04em.
- **Title** (720, wdth 96, `clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem)`, line-height 1.1, -0.02em): the two Cisco exhibit heads.
- **Title small** (720, wdth 94, 1.1875rem, line-height 1.2 to 1.25, -0.01em): timeline role titles and case study highlight heads. The hero role line sits one step up (700, wdth 92, `clamp(1.25rem, 1.05rem + 0.7vw, 1.625rem)`).
- **Lede** (400, `clamp(1.0625rem, 0.98rem + 0.4vw, 1.3125rem)`, line-height 1.5): opening paragraphs, 50 to 58ch, usually in Pencil Gray; the about lede stays in ink.
- **Body** (400, wdth 100, 1.0625rem, line-height 1.6): running prose, max 64ch. Case study story runs slightly larger (`clamp(1.0625rem, 1rem + 0.2vw, 1.1875rem)`).
- **Body small** (400, 0.9375 to 0.975rem, line-height 1.55): timeline bodies, highlight bodies, callout legend, toolset values, fact values (at 520 to 560 weight when they are data).
- **Label** (600, wdth 82, 0.8125rem, line-height 1.35, +0.01em, sentence case, Pencil Gray): names data. Definition terms (Based in, Role, Stack), dates, captions, the position readout, the schematic note. Never a kicker over a headline.
- **Control** (600, wdth 92, 0.9375rem): buttons. Arrow links run 620 / wdth 92. Nav links 560 / wdth 90 / 0.9375rem; the nav name 760 / wdth 88 / 1.0625rem.

### Named Rules
**The One Family Rule.** The house speaks only Archivo. Hierarchy comes from width and weight on one family: expanded (112%) for the name alone, about 94% for section heads, 82 to 92% for labels, buttons and nav. Never add a second house face.

**The Own Face Rule.** A product's name (shelf tab, slide name, case study name, pager name), its "Aa" samples and its face names are set in that product's real typeface, and a product face never appears outside its product's context. Inter and Geist are on the page because KatArch, LifeUI, KnowGraph and LoLImpact use them; a detector warning about them is product truth, not a house choice.

**The Tabular Figures Rule.** Any number that is compared or scanned (positions like 01 / 05, dates, the local time, scale figures, pin numerals, the copyright line) uses tabular figures.

## Layout

A single centered column capped at 1360px plus gutters (`clamp(16px, 4vw, 48px)`). Inside it, content sits on fractional two-column splits rather than a visible grid: 7/4 for the hero band (intro against the ruled meta list), 5/7 for the shelf head (title against tabs and arrows), 6/5 for the Cisco head, 1/1 for the two exhibits, 7/5 for about against the contact panel, and 7/5 again for the case study head and for story against the callout legend. Column gaps run `clamp(32px, 5vw, 80px)`.

The one element that leaves the column is the shelf. Its track spans the viewport, insets its first slide to the column edge (`max(gutter, (100vw - 1360px) / 2)`), and snaps each slide to that edge. A slide is up to 1180px wide, split 1.7/1 between the screenshot and its copy, with the next product visible past the right edge.

Vertical rhythm is a short clamp ladder. Sections pad `clamp(80px, 9vw, 136px)` and open with a 1px top rule; the hero pads tighter (`clamp(28px, 3.6vw, 52px)` top) so the shelf head lands inside the first viewport on desktop. Major blocks inside a section or case study separate by `clamp(56px, 7vw, 96px)`. Controls sit in rows with a 10px gap. Anchors scroll with a 72px top padding so the sticky nav never covers a heading.

Multi-column content is divided by hairlines, never by boxes: the hero meta list, the case study facts row (2/1/1.4) and spec sheet (2/1/1/1) are ruled cells; the three highlights sit under a 1px ink rule; the toolset is a ruled definition list under an ink rule; the timeline is one rule with a stop per role that darkens from Firm Hairline to ink as it reaches now.

**The Shelf Rule.** Products are browsed one at a time on the horizontal shelf, the only element that leaves the column. The home page never lays products out as a grid, and every way of moving along it (tabs, arrows, keys, drag, swipe) lands on a snapped slide.

Responsive behavior: at 1000px the shelf head, Cisco head, exhibits and case study body stack, the timeline goes to two columns with a rule above each stop, the case study head reflows (actions below the tagline) and the spec sheet goes to two cells per row. At 900px the hero band and about stack and the contact panel stops being sticky. At 800px a slide becomes one column (screenshot over copy), the arrows and position readout hide, and mouse drag turns off (touch scrolls natively). At 700px the nav keeps only the name, theme toggle and résumé pill; facts, highlights and sheet go single column; pins shrink to 20px. At 640px the pipeline's two tools stack; at 560px the timeline is one column; at 420px the PDF note on the résumé button hides.

## Elevation & Depth

The page is flat. Sections, text, rules, controls and the exhibit panels carry no drop shadow; depth is conveyed by the plate tint and one step of raised tint. Shadows belong only to screenshots: plates, phone frames, the pins that sit on a plate, and the full-size image in the viewer. Every shadow is soft and offset downward with negative spread, and each edition has its own (deeper in dark, where a light shadow would vanish).

### Shadow Vocabulary
- **Plate** (`box-shadow: 0 0 0 1px var(--ring), var(--shadow)`, where `--shadow` is `0 18px 40px -20px rgb(0 0 0 / 0.28), 0 4px 10px -4px rgb(0 0 0 / 0.1)` in light and `0 24px 50px -24px rgb(0 0 0 / 0.8), 0 4px 12px -4px rgb(0 0 0 / 0.5)` in dark): every framed screenshot. The ring does the edge work; the shadow only lifts.
- **Device** (`box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08), 0 0 0 1px var(--ring), var(--shadow)`): the phone frame; the inner white hairline keeps the bezel from merging with dark paper.
- **Pin** (`box-shadow: 0 0 0 2px var(--paper), 0 4px 10px -2px rgb(0 0 0 / 0.35)`): a numbered pin on a plate, cut out from the screenshot by a paper ring. Legend pins are flat.
- **Exhibit ring** (`box-shadow: 0 0 0 1px var(--rule)`): the raised diagram panels. A ring, not a shadow.
- **Viewer image** (`box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.9)`): the enlarged screenshot on the viewer's dark ground.

### Named Rules
**The Plate Rule.** Only screenshots cast shadows. Diagrams, panels and controls are flat; if it is not a screenshot, a phone or a pin on one, it gets at most a hairline ring.

## Shapes

Two corner families. Exhibits are gently rounded like a screen: 10px on plates and pipeline nodes, 14px on the raised exhibit panels, 16px on the contact panel, 6px on palette dots, 26px outer and 21px inner on phone frames. Everything the visitor presses is a full pill (999px): buttons, nav links, the theme toggle, the résumé pill, icon buttons, worker tags in the pipeline. Pins and timeline stops are circles.

Printer's crop marks are the house's signature geometry: eight 9 by 1px ticks drawn 14px outside the corners of the case study's lead plate, in ink at 38%. Shelf and gallery plates do not carry them. Rules are always 1px (the pipeline's source notes use a dashed 1px rule; the timeline rule is a 1px line from Firm Hairline to ink). Icons are one stroke family (24px grid, 1.6 stroke, round caps and joins) drawn inline and colored by `currentColor`. Disclosure chevrons are drawn from two 1.5px borders, not glyphs.

## Components

### Buttons
Quiet, pill-shaped and ink-driven.
- **Shape:** full pill (999px), minimum height 44px, 18px side padding, Archivo 600 at wdth 92, 0.9375rem, 16px icons with a 0.5em gap.
- **Solid:** ink ground, paper text, used once per context (Email me in the hero, Read the case study on a slide, Open the live app on a case study). Hover mixes 16% paper into the ink.
- **Outline:** transparent with a 1px Firm Hairline and ink text (Résumé with a Soft Gray "PDF" note, Source, Copy). Hover turns the line to ink.
- **Press:** 1px downward nudge. **Focus:** 2px solid ink outline, 3px offset, 4px radius, everywhere; inside the contact panel the outline is paper.
- **Icon button:** a 44px circle with a 1px Firm Hairline and an 18px icon; the line turns ink on hover. Disabled (the shelf's first and last arrow) drops to 35% opacity.
- **Arrow link:** Archivo 620 at wdth 92 with a 1px underline drawn as a background, a 14px arrow that moves 2px up and right (external) or 3px right (internal) on hover.

### Navigation
A sticky 56px bar in paper at 94% with a 10px backdrop blur and a hairline bottom border. Name on the left (760, wdth 88); section links as pills in Pencil Gray (Work, Experience, About) that go ink with a 6% ink wash on hover; the theme toggle, a 40px round button showing a moon in light and a sun in dark, labeled with the edition it switches to; and the résumé as an ink pill with a file icon. The toggle saves the choice, updates `theme-color`, and crossfades the two editions with a view transition where supported (none under reduced motion). The bar is named `nav` for view transitions so it holds still while pages change. Below 700px the section links hide.

### Hero band
The name at display size, then a band: role line, a muted lede, and the action row (Email me, Résumé, GitHub, LinkedIn) on the left; on the right a ruled definition list (Based in, Local time, Open to). Local time is Montevideo's, rendered live with `Intl.DateTimeFormat`, re-rendered on the minute, followed by a muted UTC−3.

### Product shelf (signature)
The home page's product browser: five products, one at a time, on a horizontal track with mandatory scroll snap. Above it, tabs set in each product's own face (Soft Gray at rest, ink when current) with a 2px accent underline that grows in from the left over 0.45s, a tabular position readout (01 / 05) and previous/next icon buttons. The track takes arrow keys, Home and End when focused (focus shows as an outline 6px around the active plate), mouse drag with a 60px flick threshold (touch and trackpads scroll natively), and clicking a dimmed neighbour brings it forward instead of opening it. Neighbours fade toward the paper with a 60% paper veil (35% on hover), so a dark screenshot never turns muddy on white. Each slide holds a plate (lifts 3px on hover), the product name in its face, the tagline, three points under hairlines with an 8px accent tick, a proof label, and Read the case study plus Live and Source arrow links. The plate and name carry `view-transition-name` values `shot-{id}` and `name-{id}`.

### Plate
The framed screenshot, the house's main object: a 10px frame on Plate Stock with the plate ring and shadow, holding a `<picture>` per edition (AVIF and WebP) of which only the matching one displays. Phone captures sit in a 5px Bezel frame at 26px. On a case study, plates render as zoom buttons (`zoom-in` cursor, labeled "Enlarge screenshot") that open the viewer at the matching edition's full-size image.

### Pins and legend
Numbered 26px circles in the product accent with on-accent numerals (0.75rem, 760, tabular), placed by percentage over the lead plate and ringed in paper. The legend beside the story repeats each number as a flat pin; hovering a legend line turns its text to ink and scales the matching pin to 1.3 over 0.25s. Pins shrink to 20px below 700px.

### Case study
One template for all five products. Header: All work back link and the position (current number in the accent, total in ink), the name in the product's face, tagline and actions (Open the live app solid, Source outline), then a ruled facts row (Role, Year, Interface with language and "light and dark" or "dark only"). Then the lead plate at full column width with crop marks and pins; the story (max 64ch) beside the pin legend, with a ruled note where the live app has a caveat; three highlights under an ink rule; a gallery of further screens with label captions, desktop screens two to a row and phones in a narrower fixed column (`clamp(170px, 18vw, 240px)`); the spec sheet (Stack, Scale, Typefaces with a 2rem "Aa" in each face, Palette as 22px dots with an inset ink ring); and a pager with previous and next names in their faces and a keycap hint. Left and right arrow keys browse between case studies unless a field or dialog has focus.

### Exhibit panel
The Cisco diagrams sit in flat raised panels (14px, Raised Tint, hairline ring, `clamp(18px, 2.4vw, 32px)` padding), never on plates. The main-thread schematic is an inline SVG in ink tones only (tasks in ink, rails in Firm Hairline, notes in Pencil Gray at wdth 86) with a "Schematic, not a measurement." label under it. The review pipeline is HTML: paper nodes with Firm Hairline strokes at 10px, 1px connectors, pill worker tags, and a result node stroked in ink. Under the pipeline, a ruled disclosure ("How I built it") opens by animating its height over 0.4s where the browser supports `::details-content`, with a chevron that turns over 0.3s.

### Contact panel
The one reversed block, and reversed in both editions: an ink panel (16px, `clamp(24px, 3vw, 40px)` padding) with paper text, sticky 88px from the top beside the about column on desktop. It holds the hiring question, the email (700, `clamp(1.25rem, 0.9rem + 1.2vw, 1.875rem)`) whose underline draws in over 0.45s on hover, a Copy outline button restyled in paper at 30% (label turns to Copied, or Selected when the clipboard is blocked), and arrow links to LinkedIn, GitHub and the résumé, all between paper hairlines at 18%.

### Viewer
A full-screen `<dialog>` on a fixed near-black ground (#0a0a0c) in both editions, with the alt text as a caption and a 44px round close button; the full-size image loads only on open and the dialog fades in over 0.35s (none under reduced motion). Clicking the dark area closes it.

### Motion
One easing for everything: `cubic-bezier(0.16, 1, 0.3, 1)`. State feedback runs 0.2s to 0.5s. The authored moment is cross-document: `@view-transition { navigation: auto; }` morphs the shelf's plate and name into the case study's lead plate and heading over 0.45s, and the theme switch crossfades on the same timing. Under `prefers-reduced-motion` the view transitions, smooth scrolling, the shelf's smooth jumps, the tab underline, the neighbour fade, the plate lift and the disclosure animation are all off.

**The Continuity Rule.** Motion exists to show that two views are the same thing: a shelf slide and its case study, one edition and the other. Anything that morphs between pages carries a stable `view-transition-name` (`shot-{id}`, `name-{id}`, `nav`); nothing animates for decoration.

## Do's and Don'ts

### Do:
- **Do** define any new house color as a pair on `:root` and `:root[data-theme='dark']`, and style components from the role variables so they print in both editions.
- **Do** capture every screenshot in both themes when the product has both, and render it through Plate so only the matching edition displays and downloads; mark a product without a light UI "dark only".
- **Do** give a new product an accent pair (`light`, `dark`, `onLight`, `onDark`) that holds 4.5:1 against paper and against its on-accent in both editions, and use it only for the tab underline, slide ticks, pins and the case study position.
- **Do** set a new product's name, tabs, pager name and "Aa" samples in that product's real, self-hosted typeface.
- **Do** build hierarchy with Archivo's width axis: 112% for the name, about 94% for heads, 82 to 92% for labels, buttons and nav.
- **Do** frame screenshots as plates (1px ring, soft offset shadow), keep crop marks for the case study's lead plate, and key details with numbered accent pins and a matching legend.
- **Do** put diagrams in flat raised exhibit panels with a hairline ring, drawn in ink tones only.
- **Do** divide columns and rows with 1px hairlines (an ink rule to open a set, grey rules within it).
- **Do** use `cubic-bezier(0.16, 1, 0.3, 1)` for every transition, keep state feedback between 0.2s and 0.5s, and turn authored motion off under `prefers-reduced-motion`.
- **Do** make every interactive target at least 44px (40px in the nav bar) with the 2px ink focus ring, and give every horizontal browser keyboard support.

### Don't:
- **Don't** introduce a house accent color, or use a product accent on buttons, links, headings, rules or grounds.
- **Don't** repaint a section, the nav or the page ground in a product's palette; the page never changes ground under the reader.
- **Don't** add a second house typeface, or use a product's face outside that product's context.
- **Don't** put eyebrow or kicker labels above headlines; labels name data (terms, dates, captions, positions) and nothing else.
- **Don't** number sections; numerals belong to positions, pins and data.
- **Don't** set content in card grids; products live on the shelf, highlights and facts are ruled columns.
- **Don't** use side-stripe borders, gradient text, or decorative grid or pattern backgrounds.
- **Don't** cast shadows from anything that is not a screenshot, a phone or a pin on one.
- **Don't** show a light screenshot of a product that has no light UI.
- **Don't** use em-dashes in copy.
