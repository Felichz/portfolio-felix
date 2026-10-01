# Felix Andersson, portfolio

Personal site of Felix Andersson, Senior Frontend Engineer in Montevideo. Five years on Cisco's Magnetic design system and the Meraki Dashboard, plus products of my own, designed and built end to end. Built like a desktop app: one fixed window, full-height sections that move one at a time.

**[portfolio-felix-teal.vercel.app](https://portfolio-felix-teal.vercel.app/)** · [Résumé (PDF)](public/felix-andersson-resume.pdf) · [LinkedIn](https://www.linkedin.com/in/felixandersson/) · [GitHub](https://github.com/Felichz)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/home-dark.webp">
  <img alt="The intro: the name set large in a variable grotesque, the role with an italic aside, a short summary, actions and four strengths on the left; a portrait on the right; section dots down the left edge." src="docs/screenshots/home-light.webp">
</picture>

## What's on it

The site works like a desktop app in a fixed window: a bar on top, a rail of section dots down the left edge, and full-height sections that move one at a time. A scroll gesture jumps to the next section; a section scrolls inside itself only when the window is too small for it. On phones the sections scroll naturally and the rail becomes a tab bar.

- **Intro.** Name, role, the short version, what I bring, and a portrait.
- **Work.** A showcase of six products, this site included. Each product's screen recording plays, holds on its last frame, and the next one slides in; the rail fills in the product's color as its turn runs. Pause it with the button, or by reading the product copy.
- **Experience.** The CV: roles from 2020 to now on a continuous timeline, with the detail of the selected role below and a few concrete examples in prose.
- **About.** How I got here, the toolset, and contact.
- **One case study per product** (`/work/katarch`, `/work/knowgraph`, ...), as five sections: Overview with the lead screenshot, its recording and numbered callouts; Story; Engineering; Screens; Specs and the next case study.
- **Two editions.** Warm stone and near-black, chosen before first paint from the saved choice or the system setting, toggled from the bar. Screenshots print in the opposite edition, so each product stands out from the page.

<table>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/work-dark.webp">
        <img alt="The Work section: a rail of five products with LifeUI active and its progress bar filling, and LifeUI's screenshot in a browser window with its highlights and links below." src="docs/screenshots/work-light.webp">
      </picture>
      <br><sub>The showcase: auto-advancing, one product at a time.</sub>
    </td>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/experience-dark.webp">
        <img alt="The Experience section: a continuous timeline of roles from 2020 to now with the Magnetic component library selected, its details, and a card of examples." src="docs/screenshots/experience-light.webp">
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
      <br><sub>A case study's first section.</sub>
    </td>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/mobile-dark.webp">
        <img width="260" alt="The intro on a phone, with the tab bar at the bottom." src="docs/screenshots/mobile-light.webp">
      </picture>
      <br><sub>On a phone: sections scroll naturally, with a tab bar.</sub>
    </td>
  </tr>
</table>

## Details that took some care

- **Tapes instead of videos.** LifeUI's preview, and this site's own, are tapes: the app's DOM recorded while a scripted scene drives it in headless Chrome, then replayed by a `<tape-player>` element in a script-less iframe with the app's real stylesheet. One 40 KB file replaces two 1.2 MB videos, plays in either theme, and stays sharp at any size.
- **Live, in place.** Live doesn't leave the site: the camera flies into the product's window while a copy of the tape reaches the next recorded checkpoint, and the app's own build, vendored under `/apps/<id>/`, boots under it with that checkpoint's storage and clock, then fades in once it has painted. On this site's own slide, Live opens the site inside itself.

- One navigation model for wheel, trackpad, touch, keys, tabs and links. A wheel gesture moves one section, unless it started by scrolling something inside the section.
- Deep links (`/#experience`, `/#work/lifeui`) open on their section and product before the first paint.
- The name is set one glyph at a time along Archivo's width axis: letters widen into place on arrival and swell toward the pointer.
- A cursor light: a soft pool of color follows the pointer and brings up the dot grid under it, with a lens bulge. Buttons are magnetic, the portrait and the showcase window tilt toward the pointer, and a scrubber on the Experience timeline names the month and role under the cursor.
- The room light follows the content: each section, and each product in the showcase, sets the colors of the ambient glow.
- The showcase screenshot and product name morph into the case study header (cross-document view transitions).
- Kept cheap to render: no backdrop blur, static ambient layers. The theme toggle reveals the other edition in a circle from the button, from a single snapshot with transitions suspended.
- Everything sizes against the window with container units, and tightens on short screens.
- Reduced motion: no autoplay, no tilt, instant section moves.
- Static output, responsive AVIF/WebP images, recordings that load only when they play, self-hosted font subsets, no client framework.

## Stack

Astro 7, TypeScript, hand-written CSS with custom properties. Deployed as a static site.

## Tapes and live apps

```bash
node scripts/apps/vendor.mjs lifeui      # build LifeUI for /apps/lifeui/ (needs ../life-ui-embed)
node scripts/tapes/record.mjs lifeui     # record public/tapes/lifeui.json from its scene
node scripts/tapes/record.mjs portfolio  # this site's Intro, from dist/ (build first)
```

Scenes live in `scripts/tapes/scenes/`. The player is `src/scripts/tape.ts`, the flight and handoff `src/scripts/thaw.ts`, and the clock bridge inlined into vendored apps `scripts/apps/bridge.js`.

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
| `src/pages/index.astro` | Home sections: `Intro`, `Work` (the showcase), `Experience` (the timeline), `About`. |
| `src/data/career.ts` | Time in frontend, computed at build time. |
| `src/pages/work/[id].astro` | Case study template (five sections), generated from `projects.ts`. |
| `src/layouts/Base.astro` | The app shell: head, pre-paint theme and deep-link scripts, `Bar`, the section rail (`Dock`), the deck, image viewer. |
| `src/scripts/deck.ts` | The vertical deck: wheel, keys, links, hash, section rail and ambient light. |
| `src/scripts/fx.ts` | Pointer spotlight and tilt. |
| `src/components/Plate.astro` | Theme-aware screenshot in a browser window, with the recording player. |
| `src/styles/global.css` | Tokens for both editions, ambient layers, shell, surfaces, buttons, plates, pins. |
| `src/assets/portrait/` | The portrait, a dark and a white studio shot (the site shows the opposite one). |
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
