---
name: Felix Andersson
description: A specimen book of interfaces. White stock, near-black ink, one variable grotesque, and color borrowed only from the products on show.
colors:
  paper: "#ffffff"
  plate: "#f3f3f1"
  ink: "#0d0d0f"
  ink-2: "#55555c"
  rule: "#e3e3e0"
  night: "#0d0d0f"
  night-2: "#151518"
  night-ink: "#f2f2ee"
  night-muted: "#a3a3aa"
  night-rule: "#2a2a30"
  plate-night: "#141417"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(3.25rem, 0.9rem + 8.2vw, 6rem)"
    fontWeight: 820
    lineHeight: 0.9
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 112"
  address:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.75rem, 0.6rem + 4.6vw, 5rem)"
    fontWeight: 760
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 104"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.25rem, 1.2rem + 3.6vw, 4.25rem)"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 94"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem)"
    fontWeight: 720
    lineHeight: 1.08
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 96"
  title-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 94"
  specimen-name:
    fontSize: "clamp(3rem, 1rem + 7vw, 6rem)"
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  lede:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.125rem, 1rem + 0.45vw, 1.375rem)"
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
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 82"
  control:
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.975rem"
    fontWeight: 600
    lineHeight: 1.2
    fontVariation: "'wdth' 92"
rounded:
  focus: "4px"
  swatch: "6px"
  control: "8px"
  plate: "10px"
  device-screen: "22px"
  device: "28px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 48px)"
  section: "clamp(88px, 11vw, 168px)"
  block: "clamp(56px, 7vw, 96px)"
  sheet: "clamp(48px, 6vw, 80px)"
  stage: "clamp(40px, 5vw, 72px)"
  column: "clamp(32px, 5vw, 80px)"
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
  icon-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "44px"
  nav-link:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "40px"
  nav-resume:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  plate:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.plate}"
  plate-night:
    backgroundColor: "{colors.plate-night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.plate}"
  palette-chip:
    rounded: "{rounded.swatch}"
    height: "44px"
  callout-pin:
    rounded: "{rounded.pill}"
    size: "28px"
---

# Design System: Felix Andersson

## Overview

**Creative North Star: "The Interface Specimen"**

The site is a foundry's specimen book, and the faces on show are interfaces. A type foundry proves a font by setting it in use; this system proves each product by showing its real screens, in its real typeface, on its real palette. The house itself is deliberately neutral stock: white paper, near-black ink, hairline rules, printer's crop marks around framed plates, and a single variable grotesque (Archivo) that carries every house voice by moving along its width and weight axes.

Color never belongs to the house. Every painted section declares its surface through eight `--s-*` slots, and each product spread overrides those slots with the product's own ground, ink, muted, rule and accent, so the page repaints as you scroll from one product to the next. The sticky nav copies the surface of whatever section sits under it. The one reversed surface the house owns is the night back cover (Contact); the only other dark full-bleed grounds are products whose own interfaces are dark.

Density is editorial rather than dashboard: generous section air (88–168px), wide 12-column fractional splits, hairline-divided columns instead of boxes, and screenshots at full measure. Motion is spent in one place, the hero panel's repaint, and everything else is quiet state feedback. The build refuses the dark developer hero, card grids, skill badges, eyebrow kickers, section numbers, gradient text and decorative grid backgrounds.

**Key Characteristics:**
- White specimen stock and near-black ink; no house accent color at all.
- One variable grotesque (Archivo, wdth 62–125, wght 100–900) used across its widths as the whole house hierarchy.
- Product names and type samples set in each product's own face; product palettes painted through the `--s-*` surface contract.
- Framed plates with a 1px ink ring, a soft offset shadow and printer's crop marks; numbered callout pins keyed to a legend.
- Hairline rules as the only structural dividers; ink rules open a sheet, grey rules divide it.
- One authored motion moment on an exponential ease-out.

## Colors

A monochrome house (paper, ink and three grays, plus a matching night set) that lends the page to borrowed product palettes.

### Primary
- **Specimen Ink** (`ink`): the house's only "color". Body text, headings, the solid button, the nav résumé pill, ink rules that open the highlights row and the toolset, and the default `--s-accent` on house surfaces. Selection inverts it against the ground.

### Neutral
- **Specimen Stock** (`paper`): the house ground for the hero, Experience, the products intro and About. Also the text color on solid ink buttons.
- **Plate Stock** (`plate`): the default `--s-surface`, the fill behind a framed screenshot before it loads.
- **Pencil Gray** (`ink-2`): the default `--s-muted`. Ledes in secondary position, role bodies, labels, callout legend text, strip captions. 7.4:1 on paper.
- **Hairline** (`rule`): the default `--s-rule`. Row dividers, sheet cell borders, the nav's bottom border, folio rules.
- **Night** (`night`), **Night Raised** (`night-2`), **Night Ink** (`night-ink`), **Night Muted** (`night-muted`), **Night Rule** (`night-rule`): the reversed set, applied as a whole through the night surface. Used for the Contact back cover only.
- **Exhibit Black** (`plate-night`): the ground of a night plate, a dark exhibit framed on a light page (the 100k-row demo and the AI review pipeline diagram). It shares its value with the rows demo's own ground so the demo sits seamlessly in its frame.

### Borrowed (product) palettes
Product colors are data, not house tokens. Each product in `src/data/projects.ts` carries a `theme` (scheme, ground, surface, ink, muted, rule, accent, accentText, onAccent) and a `palette` of named swatches. The theme is written onto its spread as `--s-*` custom properties; the palette is shown as chips on the spec sheet and as five small swatches in the hero caption. The full per-product values are recorded in `.impeccable/design.json` under `extensions.surfaces`.

### Named Rules
**The Borrowed Color Rule.** The house owns no hue. Any saturated color on the page belongs to a product and appears only inside that product's spread, its hero panel, its tab timer, or its swatches. Adding a house accent breaks the premise.

**The Declared Surface Rule.** Every painted section declares its surface through the eight slots `--s-ground`, `--s-surface`, `--s-ink`, `--s-muted`, `--s-rule`, `--s-accent`, `--s-accent-text`, `--s-on-accent`, and marks itself `data-paint`. Components read only `--s-*` (and `color-mix` derivatives of it), never the house tokens directly, so any spread can repaint them. `--s-accent-text` is the AA-safe text version of the accent; every spread declares it, and it is reserved for accent-colored text.

**The Night Is Rare Rule.** The Contact back cover is the only reversed house surface. A dark exhibit on a light page is framed as a night plate, never run as a full-bleed dark band.

## Typography

**Display Font:** Archivo, self-hosted variable (wdth 62–125%, wght 100–900), with ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif
**Body Font:** Archivo (same file)
**Product faces (guests, not house):** Martian Mono (400, 700), Newsreader (500), Geist (400), Inter (400, 600), Bricolage Grotesque (700), Figtree (400), JetBrains Mono (500), each self-hosted as a single woff2 per weight.

**Character:** One grotesque plays every house role by changing width: expanded and heavy to announce, near-normal to explain, condensed and semibold to label and operate. The guest faces are the exhibits, and the neutrality of the house face is what lets them read as specimens.

### Hierarchy
- **Display** (820, wdth 112, `clamp(3.25rem, 0.9rem + 8.2vw, 6rem)`, line-height 0.9, -0.04em): the name, once, at the top of the first viewport.
- **Address** (760, wdth 104, `clamp(1.75rem, 0.6rem + 4.6vw, 5rem)`, line-height 1, -0.04em): the email on the back cover, the second expanded-heavy moment. Underline draws in on hover.
- **Headline** (780, wdth 94, `clamp(2.25rem, 1.2rem + 3.6vw, 4.25rem)`, line-height 1, -0.035em): section heads (Experience, Products, About). The Contact question uses the same voice slightly smaller (760, `clamp(2rem, 1.1rem + 3.2vw, 3.75rem)`, max 18ch).
- **Specimen name** (the product's own face, `clamp(3rem, 1rem + 7vw, 6rem)`, line-height 0.95, -0.03em): the head of each spread. Martian Mono runs smaller (`clamp(2.5rem, 0.8rem + 6vw, 5.25rem)`); wordmarks that mix weights (LOL + IMPACT) keep the split.
- **Title** (720, wdth 96, `clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem)`, line-height 1.08, -0.025em): sub-blocks inside a section (the rows demo, the review pipeline).
- **Title small** (700–720, wdth 94, 1.1875–1.25rem, line-height 1.25, -0.01em): role titles and spread highlight heads. The hero role line sits one step up (700, wdth 92, `clamp(1.25rem, 1.05rem + 0.7vw, 1.625rem)`).
- **Lede** (400, `clamp(1.125rem, 1rem + 0.45vw, 1.375rem)`, line-height 1.5): opening paragraphs, max 40–52ch.
- **Body** (400, wdth 100, 1.0625rem, line-height 1.6): running prose, max 64ch; secondary paragraphs in muted.
- **Label** (600, wdth 82, 0.8125rem, line-height 1.35, +0.01em, sentence case, muted): data names on the spec sheet and toolset, dates, location meta, notes, and the folio. Never used as a kicker over a headline.
- **Control** (600, wdth 92, 0.975rem): buttons and arrow links. Nav links run 560 / wdth 90 / 0.9375rem; the nav name 760 / wdth 88.

### Named Rules
**The One Family Rule.** The house speaks only Archivo. Hierarchy is made with width and weight on one family: expanded (104–112%) for the name and the address, about 94% for heads, 82–92% for labels, controls and nav. Never add a second house face.

**The Own Face Rule.** A product's name, hero tab, "Aa" samples and face names are set in that product's real typeface, and a product face never appears outside its product's context. Inter and Geist are on the page because LifeUI, KatArch, LoLImpact and KnowGraph use them; that is product truth, not a house choice.

**The Tabular Figures Rule.** Any number that is compared or scanned (dates, scale figures, hex values, pin numerals, the copyright line) uses tabular figures.

## Layout

A single centered column capped at 1360px plus gutters (`clamp(16px, 4vw, 48px)`), with sections stacked full-bleed so each can paint its own ground. Inside the wrap, content is placed on fractional 12-column splits rather than a visible grid: 4/8 (hero copy against the work panel; block copy against its exhibit), 7/5 (section head against its intro; spread story against the callout legend; spread name and tagline against the links), 5/7 (About), and 3/4/5 (experience rows: dates, title, body).

Vertical rhythm is set by a small clamp ladder: sections pad `clamp(88px, 11vw, 168px)`; major blocks inside a section are separated by `clamp(56px, 7vw, 96px)`; the spec sheet and folio by `clamp(48px, 6vw, 80px)`; a spread's stage drops `clamp(40px, 5vw, 72px)` below its head. Column gaps run `clamp(32px, 5vw, 80px)`. Controls sit in rows with a 10px gap.

Multi-column content is divided by hairline rules, never by boxes: experience rows are ruled top and bottom; the three spread highlights sit under a 1px ink rule with grey rules between them; the spec sheet is a 12-column ruled table (Role, Stack, Scale, Typefaces at 3 columns each, then Palette across the full width); the toolset is a ruled definition list.

Responsive behavior: at 1100px the spread head, story and experience head collapse to one column and the spec sheet goes to two cells per row; at 1000px the hero stacks and its work panel goes full-bleed; at 900px About and the products intro stack; at 760px everything is single-column, the overlapping second plate drops below the main one with a negative overlap, highlights stack, the strip goes to two columns, pins shrink to 22px, and the nav keeps only Contact beside the résumé pill; below 380px the nav keeps only the name and the pill. The hero plate is sized to the viewport height (`min(100%, (100svh - 330px) * 1.6)`) so the whole 16:10 screenshot fits the first viewport on desktop.

## Elevation & Depth

The page is flat. Sections, text, rules and controls carry no shadow; depth is conveyed by painted grounds changing from section to section. Shadows belong only to exhibits: plates (framed screenshots and dark demos), phone frames, the callout pins that sit on top of plates, and the full-size image viewer. Every shadow is soft and offset downward with negative spread, paired with a 1px ring that does the actual edge work.

### Shadow Vocabulary
- **Plate** (`box-shadow: 0 0 0 1px color-mix(in srgb, var(--s-ink) 12%, transparent), 0 18px 40px -18px rgb(0 0 0 / 0.35), 0 4px 10px -4px rgb(0 0 0 / 0.12)`): every framed screenshot. The ring takes the surface ink, so it adapts to each spread.
- **Night plate** (`box-shadow: 0 0 0 1px #000, 0 24px 50px -24px rgb(0 0 0 / 0.55), 0 4px 10px -4px rgb(0 0 0 / 0.2)`): dark exhibits on a light page.
- **Device** (`box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08), 0 0 0 1px color-mix(in srgb, var(--s-ink) 14%, transparent), 0 30px 50px -20px rgb(0 0 0 / 0.55)`): the phone frame around a mobile screenshot.
- **Pin** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--s-accent) 30%, transparent), 0 4px 10px -2px rgb(0 0 0 / 0.35)`): a callout pin sitting on a plate. Legend pins are flat.
- **Swatch ring** (`box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--s-ink) 16%, transparent)`): palette chips, so a chip that matches its ground still reads.

### Named Rules
**The Plate Rule.** Only exhibits cast shadows. If it is not a screenshot, a demo, a device or a pin on one, it is flat.

## Shapes

Two corner families. Exhibits are gently rounded like a screen (10px on plates and diagram nodes, 8px on controls inside the demo, 6px on palette chips, 28px outer and 22px inner on phone frames). Everything the visitor presses is a full pill (999px): buttons, nav links, the résumé pill, icon links, the copy button, worker tags in the pipeline diagram. Pins are circles.

Printer's crop marks are the house's signature geometry: eight 9×1px ticks drawn 14px outside each plate's corners in ink at 45%, on the hero plate, every spread's main plate, and both night plates. Rules are always 1px. Icons are one stroke family (24px grid, 1.6 stroke, round caps and joins) drawn inline, colored by `currentColor`.

## Components

### Buttons
Quiet, pill-shaped and ink-driven; they inherit the surface they sit on.
- **Shape:** full pill (999px), minimum height 44px, 18px side padding, Archivo 600 at wdth 92, icons 16px with a 0.5em gap.
- **Solid:** ink ground, stock text. The primary action once per context (Email me in the hero). Hover mixes 14% ground into the ink.
- **Outline:** transparent with a 1px ink line and ink text. Hover lays a 7% ink wash. On spreads the line softens to ink at 30%.
- **Accent:** only inside a product spread (Open the live app): the product's accent as ground and `--s-on-accent` text. Hover mixes 12% ink into the accent.
- **Press:** 1px downward nudge. **Focus:** 2px solid `currentColor` outline, 3px offset, 4px radius, everywhere.
- **Icon link:** a 44px circle with a 1px `--s-rule` line and an 18px icon; the line turns ink on hover.
- **Arrow link:** Archivo 600 at wdth 92 with a 1px underline drawn as a border and a 14px arrow that nudges 2px up and right on hover.

### Navigation
A sticky 56px bar that takes the color of the page under it. Name on the left (760, wdth 88), four section links as pills (560, wdth 90, 40px tall, 8% ink wash on hover), and the résumé as an ink pill with a file icon. A scroll listener finds the painted section crossing the line under the bar and copies its `--s-ground`, `--s-ink` and `--s-rule` onto the bar (and into the `theme-color` meta); the change transitions over 0.5s. Below 760px only Contact stays beside the pill; below 380px only the name and the pill.

### Plates
The framed exhibit, the house's main object. A 10px-radius frame on `--s-surface` with the plate shadow and crop marks. Spread screenshots are buttons (`zoom-in` cursor) and open a full-screen night viewer with the alt text as its caption. Night plates hold the live 100k-row demo and the review pipeline diagram. Strip plates (three per row, two on phones) lift 3px on hover with a muted caption beneath.

### Hero work panel (signature)
The first viewport's right side is a panel painted in the active product's ground that bleeds off the right edge and down to the section floor. Product tabs sit on it, each set in its product's own face, above a 16:10 plate and a caption line (five palette swatches, the product's one-line index, its stack, and a "See the specimen" arrow link). Tabs are real ARIA tabs driven by click and keyboard (arrows, Home, End), never hover. An accent-colored 2px timer bar under the active tab runs for 6s and advances to the next product; it pauses on hover, on focus inside the panel, when the hero is off screen or the tab is hidden, stops for good once the visitor takes control, and never starts under reduced motion.

This is the system's one authored motion: on change, the panel ground transitions over 0.7s and the incoming screenshot wipes in left to right with `clip-path: inset(0 100% 0 0)` to `inset(0)` over 0.9s, both on the house ease-out `cubic-bezier(0.16, 1, 0.3, 1)`. Reduced motion removes both.

### Specimen spread (signature)
One product per full-bleed section, painted in the product's theme. In order: the name in the product's face at specimen size, tagline and the Live / Source buttons; the stage, a main plate with numbered callout pins in the product accent and, where it exists, a second plate (phone frame or second screen) overlapping its lower right; the story (max 64ch) beside the numbered legend, where hovering a legend line enlarges its pin by 1.25; three highlights under an ink rule; the spec sheet (Role, Stack, Scale, Typefaces with "Aa" samples in each face, Palette chips with names and hex); a strip of further screens; and the folio.

### Folio
The running foot that closes every spread, set as a label under a hairline: product name in ink, then "Set in [faces]", the ground hex, and the interface language, separated by space rather than punctuation.

### Palette chip
A 44px-tall swatch (6px radius, inset ring) with the color's name in 600 / wdth 92 and its hex in tabular muted figures. Six per row on desktop, three below 1100px.

### Back cover (Contact)
The night surface: the hiring question in headline voice, the email as the address type with a copy button, arrow links to LinkedIn, GitHub and the résumé, location as a label, and a colophon that names the typefaces.

## Do's and Don'ts

### Do:
- **Do** declare every new painted section's surface through all eight `--s-*` slots and mark it `data-paint`, so the nav and every component repaint with it.
- **Do** style components from `--s-*` and `color-mix()` derivatives of it, never from `--paper` or `--ink` directly, unless the component is the house itself.
- **Do** set a new product's name, tab and type samples in that product's real, self-hosted typeface, and give it a full `theme` with an AA-safe `accentText` and `onAccent`.
- **Do** build hierarchy with Archivo's width axis: 104–112% to announce, about 94% for heads, 82–92% for labels, controls and nav.
- **Do** frame every screenshot or live exhibit as a plate with the 1px ink ring, the soft offset shadow and crop marks; use a night plate for a dark exhibit on a light page.
- **Do** key details in a screenshot with numbered accent pins and a matching legend, and close every spread with a folio.
- **Do** divide columns and rows with 1px hairlines (an ink rule to open a set, grey rules within it).
- **Do** use `cubic-bezier(0.16, 1, 0.3, 1)` for every transition, keep state feedback between 0.2s and 0.45s, and remove authored motion under `prefers-reduced-motion`.
- **Do** make every interactive target at least 44px (40px in the nav bar) with the 2px `currentColor` focus ring.

### Don't:
- **Don't** introduce a house accent color; color comes only from the products.
- **Don't** add a second house typeface, or use a product's face outside that product's context.
- **Don't** put eyebrow or kicker labels above headlines; labels name data (sheet cells, dates, notes, folios) and nothing else.
- **Don't** number sections; numerals belong to callout pins and data.
- **Don't** set content in bordered, rounded, shadowed card grids; the only framed objects are plates.
- **Don't** use gradient text or decorative grid or pattern backgrounds.
- **Don't** add dark full-bleed bands beyond the Contact back cover and products whose own grounds are dark.
- **Don't** gate content behind hover: product previews are tabs reachable by click, touch and keyboard.
- **Don't** add a second authored animation; the hero repaint and the nav color change are the moment.
- **Don't** use em-dashes in copy.
