# Felix Andersson, portfolio

Personal site of Felix Andersson, Senior Frontend Engineer in Montevideo. Five years on Cisco's Magnetic design system and the Meraki Dashboard, plus five products designed and built end to end in 2026. Built like a desktop app: one fixed window, a horizontal deck of panels.

**[anderssonfelix.com](https://anderssonfelix.com)** · [Résumé (PDF)](public/felix-andersson-resume.pdf) · [LinkedIn](https://www.linkedin.com/in/felixandersson/) · [GitHub](https://github.com/Felichz)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/home-dark.webp">
  <img alt="The intro panel: the name set large in a variable grotesque, the role with an italic aside, a short summary and actions on the left; a portrait card with frosted chips on the right; the dock with panel progress at the bottom." src="docs/screenshots/home-light.webp">
</picture>

## What's on it

The site works like a desktop app in a fixed window: a bar on top, a dock at the bottom, and a horizontal deck of full-window panels in between. The page never scrolls vertically; a panel scrolls inside itself only when the window is too small for it. Scroll, swipe, use the arrow keys, the tabs or the dock.

- **Intro.** Name, role, the short version, and a portrait.
- **Work.** A showcase of five products. Each product's screen recording plays, holds on its last frame, and the next one slides in; the rail fills in the product's color as its turn runs. Pause it with the button, or by reading the product copy.
- **Experience.** The CV: roles from 2020 to now on a timeline, with the detail of the selected role below. The Cisco evidence (tables with 100k+ rows at 60 FPS, the AI review tooling) lives inside the role it belongs to.
- **About.** How I got here, the toolset, and contact.
- **One case study per product** (`/work/katarch`, `/work/knowgraph`, ...), as five panels: Overview with the lead screenshot, its recording and numbered callouts; Story; Engineering; Screens; Specs and the next case study.
- **Two editions.** Warm stone and near-black, chosen before first paint from the saved choice or the system setting, toggled from the bar. Screenshots print in the opposite edition, so each product stands out from the page.

<table>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/work-dark.webp">
        <img alt="The Work panel: a rail of five products with LifeUI active and its progress bar filling, and LifeUI's screenshot in a browser window with its highlights and links below." src="docs/screenshots/work-light.webp">
      </picture>
      <br><sub>The showcase: auto-advancing, one product at a time.</sub>
    </td>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/experience-dark.webp">
        <img alt="The Experience panel: a timeline of roles from 2020 to now with the Magnetic component library selected, its details, and the main-thread schematic." src="docs/screenshots/experience-light.webp">
      </picture>
      <br><sub>Experience as a timeline, with the selected role below.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/case-dark.webp">
        <img alt="KatArch case study overview: the product name in its own typeface, facts and actions on the left, the lead screenshot with numbered pins on the right." src="docs/screenshots/case-light.webp">
      </picture>
      <br><sub>A case study's first panel.</sub>
    </td>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/mobile-dark.webp">
        <img width="260" alt="The intro on a phone, with the tab bar at the bottom." src="docs/screenshots/mobile-light.webp">
      </picture>
      <br><sub>On a phone: same deck, a tab bar, panels that scroll inside.</sub>
    </td>
  </tr>
</table>

## Details that took some care

- One navigation model for wheel, trackpad, touch, keys, tabs and links. A wheel gesture moves one panel, unless it started by scrolling something inside the panel.
- Deep links (`/#experience`, `/#work/lifeui`) open on their panel and product before the first paint.
- The name is set one glyph at a time along Archivo's width axis: letters widen into place on arrival and swell toward the pointer.
- The room light follows the content: each panel, and each product in the showcase, sets the colors of the ambient glow.
- The showcase screenshot and product name morph into the case study header (cross-document view transitions). The theme toggle reveals the other edition in a circle from the button.
- Everything sizes against the window with container units, and tightens on short screens.
- Reduced motion: no autoplay, no drift, no tilt, instant panel moves.
- Static output, responsive AVIF/WebP images, recordings that load only when they play, self-hosted font subsets, no client framework.

## Stack

Astro 7, TypeScript, hand-written CSS with custom properties. Deployed as a static site.

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check + static build into dist/
npm run preview  # serve dist/
```

## Where things live

| Path | What |
| --- | --- |
| `src/data/projects.ts` | Every product: order, copy, stack, scale, accent colors, screenshots, callouts, gallery. |
| `src/pages/index.astro` | Home panels: `Intro`, `Work` (the showcase), `Experience` (timeline, `MainThread`, `Pipeline`), `About`. |
| `src/pages/work/[id].astro` | Case study template (five panels), generated from `projects.ts`. |
| `src/layouts/Base.astro` | The app shell: head, pre-paint theme and deep-link scripts, `Bar`, the deck, `Dock`, image viewer. |
| `src/scripts/deck.ts` | The horizontal deck: wheel, keys, links, hash, dock and ambient light. |
| `src/scripts/fx.ts` | Pointer spotlight and tilt. |
| `src/components/Plate.astro` | Theme-aware screenshot in a browser window, with the recording player. |
| `src/styles/global.css` | Tokens for both editions, ambient layers, shell, surfaces, buttons, plates, pins. |
| `src/assets/portrait/` | Portrait photos and the avatar crop. |
| `src/assets/shots/` | Product screenshots (WebP, 2x), as `name-light` / `name-dark`. |
| `src/assets/motion/` | Screen recordings (H.264 MP4, 1920 wide), as `name-light` / `name-dark`. |
| `docs/screenshots/` | The images in this README. |

To update a product screenshot, capture 16:10 at 2x in both themes, keep the file names, and adjust the callout coordinates (`x`, `y` in percent) in `projects.ts` if the layout changed. A lead shot with a recording should use the recording's last frame as its still, so the hand-off from video to callouts is seamless.

## Deploy

Any static host works. On Vercel: import the repo, framework preset Astro, no extra settings.

Design context: [`PRODUCT.md`](PRODUCT.md) (audience, voice, evidence) and [`DESIGN.md`](DESIGN.md) (the visual system).

## The products

| | |
| --- | --- |
| [KatArch](https://github.com/Felichz/katarch) | An interactive course that replays how the winning team of O'Reilly's Fall 2020 Architecture Kata made each decision. |
| [KnowGraph](https://github.com/Felichz/KnowGraph) | Senior React and Rails interview prep as a map of 142 concepts, with an AI mentor that grades your explanations. |
| [PlaySync](https://github.com/Felichz/PlaySync) | Synced YouTube watch parties with no accounts and a server-owned clock. |
| [LifeUI](https://github.com/Felichz/life-ui) | A HUD for real life: time blocks, one running activity, and an honest closing ritual. |
| [LoL-Impact](https://github.com/Felichz/LoL-Impact) | League of Legends win probability, minute by minute, with the uncertainty shown. |
