# Felix Andersson, portfolio

Personal site of Felix Andersson, Senior Frontend Engineer in Montevideo. Five years on Cisco's Magnetic design system and the Meraki Dashboard, plus five products designed and built end to end in 2026.

**[anderssonfelix.com](https://anderssonfelix.com)** · [Résumé (PDF)](public/felix-andersson-resume.pdf) · [LinkedIn](https://www.linkedin.com/in/felixandersson/) · [GitHub](https://github.com/Felichz)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/home-dark.webp">
  <img alt="Home page: the name Felix Andersson set large, the role and a short summary on the left, location, local time and availability on the right, and the start of the Selected work gallery below." src="docs/screenshots/home-light.webp">
</picture>

## What's on it

- **A short home.** Name and proof in the first screen, then a horizontal shelf of five products, the Cisco chapter, and about plus contact. About four screens on desktop.
- **One case study per product** (`/work/katarch`, `/work/knowgraph`, ...): the lead screenshot with numbered callouts that show a tooltip on hover or focus, the story, three engineering highlights, a gallery, the stack, and previous/next navigation. Left and right arrow keys move between case studies.
- **Two editions.** Light and dark, chosen before first paint from the saved choice or the system setting, toggled from the nav. Every screenshot follows the theme; KnowGraph and PlaySync only have a dark UI, so they stay dark.

<table>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/work-dark.webp">
        <img alt="The Selected work shelf: product tabs set in each product's own typeface, arrows with a 01 / 05 position readout, and the KatArch slide with its screenshot, summary and case study link." src="docs/screenshots/work-light.webp">
      </picture>
      <br><sub>The product shelf: scroll-snap, arrows, keyboard, mouse drag.</sub>
    </td>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/case-dark.webp">
        <img alt="KatArch case study: the lead screenshot of an architecture diagram with numbered pins, one of them showing its tooltip." src="docs/screenshots/case-light.webp">
      </picture>
      <br><sub>A case study, with a callout tooltip open.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/experience-dark.webp">
        <img alt="The Cisco chapter: a main-thread schematic comparing one long filtering task with short slices, and the AI review pipeline diagram." src="docs/screenshots/experience-light.webp">
      </picture>
      <br><sub>The Cisco chapter: main-thread schematic and the AI review pipeline.</sub>
    </td>
    <td width="50%" align="center">
      <picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/mobile-dark.webp">
        <img width="260" alt="The home page on a phone." src="docs/screenshots/mobile-light.webp">
      </picture>
      <br><sub>On a phone.</sub>
    </td>
  </tr>
</table>

## Details that took some care

- The shelf screenshot and product name morph into the case study header (cross-document view transitions, off under reduced motion).
- Screenshots render a light and a dark variant; only the one that matches the theme is displayed, so the other is never downloaded.
- Product names and type samples are set in each product's real typeface; the house face is Archivo, used across its width axis.
- Montevideo local time in the header, so a remote team can see the overlap.
- Static output, responsive AVIF/WebP images, self-hosted font subsets, no client framework on the home page.

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
| `src/pages/index.astro` | Home: `Hero`, `Work` (the shelf), `Experience` (timeline, `MainThread`, `Pipeline`), `Closing`. |
| `src/pages/work/[id].astro` | Case study template, generated from `projects.ts`. |
| `src/components/Plate.astro` | Framed, theme-aware screenshot. |
| `src/styles/global.css` | Tokens for both themes, plates, pins and tooltips. |
| `src/layouts/Base.astro` | Head, pre-paint theme script, nav and image viewer. |
| `src/assets/shots/` | Product screenshots (WebP, 2x). Themed ones as `name-light` / `name-dark`. |
| `docs/screenshots/` | The images in this README. |

To update a product screenshot, capture 16:10 at 2x in both themes when the product has them, keep the file names, and adjust the callout coordinates (`x`, `y` in percent) in `projects.ts` if the layout changed.

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
