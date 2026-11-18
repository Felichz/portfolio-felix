# Felix Andersson, portfolio

Personal site of Felix Andersson, Senior Fullstack Engineer in Montevideo. Five years on Cisco's Magnetic design system and the Meraki Dashboard, now the whole stack at Clayful (Rails, Node, Firebase, a Capacitor app), plus products of my own, designed and built end to end. The site presents that work: a showcase of the products with live previews, a case study for each, and the CV.

**[felix.medanolabs.com](https://felix.medanolabs.com/)** · [Résumé (PDF)](public/felix-andersson-resume.pdf) · [LinkedIn](https://www.linkedin.com/in/felixandersson/) · [GitHub](https://github.com/Felichz)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/01-work-dark.webp">
  <img src="docs/readme/01-work-light.webp" width="100%" alt="Felix Andersson, portfolio, screenshot in a browser window. A portfolio that runs its products. Every preview is a recording of the real app. Under your pointer it becomes the app itself, in the same state, ready to click. Marked: 1, Seven products take turns. The rail fills in each one’s color as its turn runs. 2, The green light opens the running app in a window over the page. 3, Each product has a case study, its live site and its source.">
</picture>

<sub>The pictures follow your GitHub theme (light or dark).</sub>

## What's on it

The site works like a desktop app in a fixed window: a bar on top, a rail of section dots down the left edge, and full-height sections that move one at a time. A scroll gesture jumps to the next section; a section scrolls inside itself only when the window is too small for it. On phones the sections scroll naturally and the rail becomes a tab bar.

- **Intro.** Name, role, a short summary, and a portrait.
- **Work.** A showcase of six products, this site included. Each product's screen recording plays, holds on its last frame, and the next one slides in; the rail fills in the product's color as its turn runs. Pause it with the button, or by reading the product copy.
- **Experience.** The CV: roles from 2020 to now on a continuous timeline, with the detail of the selected role below and a few concrete examples in prose.
- **About.** How I got here, the toolset, and contact.
- **One case study per product** (`/work/katarch`, `/work/knowgraph`, ...), as five sections: Overview with the lead screenshot, its recording and numbered callouts; Story; Engineering; Screens; Specs and the next case study.
- **Two themes.** Light (warm stone) and dark (near-black), chosen before first paint from the saved choice or the system setting, toggled from the bar. Screenshots use the opposite theme to the page.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/02-intro-dark.webp">
  <img src="docs/readme/02-intro-light.webp" width="100%" alt="Felix Andersson, portfolio, screenshot in a browser window. One window, one section at a time. The site works like a desktop app: a bar on top, section dots down the left edge, and each turn of the wheel moves one full section.">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/03-experience-dark.webp">
  <img src="docs/readme/03-experience-light.webp" width="100%" alt="Felix Andersson, portfolio, screenshot in a browser window. The CV as a timeline. Roles from 2020 to now on one continuous line, with the detail of the selected role and a few concrete examples.">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/04-case-dark.webp">
  <img src="docs/readme/04-case-light.webp" width="100%" alt="Felix Andersson, portfolio, screenshot in a browser window. One case study per product. Five sections each: an overview with the product in its window, then the story, the engineering, the screens and the specs.">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/05-phone-dark.webp">
  <img src="docs/readme/05-phone-light.webp" width="100%" alt="Felix Andersson, portfolio, screenshot on a phone. On a phone, the sections scroll. The section dots become a tab bar at the bottom, and previews stay recordings.">
</picture>

## Implementation notes

- **Tapes instead of videos.** Every product's preview, and this site's own, is a tape: the app's DOM recorded while a scripted scene drives it in headless Chrome, then replayed in a script-less iframe with the app's real stylesheet. The five products' tapes weigh 230 KB gzipped, in place of 17.7 MB of video (two files per product, one per theme); they play in either theme and scale without loss.
- **Live previews.** After the visitor's first input (never during page load, so Lighthouse stays at 100), the app's own build, vendored under `/apps/<id>/`, boots under the preview and follows the tape by replaying its recorded clicks, with its clock and timers following the recording. Hovering a preview swaps in the live app on the same frame, ready to use. The green window light moves the app (with `moveBefore`, state intact) into a larger window with the same layout (every tape is recorded at 1152×720 and the app runs at that size, scaled), in the site's theme, with links to the case study, website and source. On this site's own slide, the preview is the site itself.
- **Previews in their own process.** Each preview (its tape and its live app) runs in a stage, a small document the page embeds and drives with messages. Served from a different site than the page, it gets its own browser process, so building a tape or booting an app does not block the page. The page does no per-frame work while a preview plays: the showcase countdown and the tape's cursor run on the compositor, and tapes apply recorded changes only when they fall due. Apps boot one at a time once a preview has been on screen briefly; an app the visitor used is paused (clock stopped) when it leaves the screen. Measured with `scripts/perf/` (alternating traces of the old and new builds): main-thread busy time while a preview plays went from 63–74% to under 15%.

- One navigation model for wheel, trackpad, touch, keys, tabs and links. A wheel gesture moves one section, unless it started by scrolling something inside the section.
- Deep links (`/#experience`, `/#work/lifeui`) open on their section and product before the first paint.
- The name is animated per glyph along Archivo's width axis: letters rise into place on load and widen toward the pointer.
- Pointer effects: a soft color spotlight follows the pointer over the dot grid, buttons are magnetic, the portrait and the showcase window tilt toward the pointer, and a scrubber on the Experience timeline shows the month and role under the cursor.
- The ambient glow takes its colors from the current section, and from the current product in the showcase.
- The showcase screenshot and product name morph into the case study header (cross-document view transitions).
- Rendering cost kept low: no backdrop blur, static ambient layers. The theme toggle reveals the other theme in a circle from the button, from a single snapshot with transitions suspended.
- Layout sizes against the window with container units and tightens on short screens.
- Reduced motion: no autoplay, no tilt, instant section moves.
- Static output, responsive AVIF/WebP images, recordings that load only when they play, self-hosted font subsets, no client framework.

## Stack

Astro 7, TypeScript, hand-written CSS with custom properties. Deployed as a static site.

## Tapes and live apps

How it works, in short, is on the [portfolio case study](https://felix.medanolabs.com/work/portfolio/#how).

```bash
node scripts/apps/vendor.mjs <id>        # build a product for /apps/<id>/ (its repo checked out next to this one)
node scripts/tapes/record.mjs <id>       # record public/tapes/<id>.json from its scene
node scripts/tapes/record.mjs portfolio  # this site's Intro, from dist/ (build first)
```

| Product | Built from | Recording needs |
| --- | --- | --- |
| KatArch | `../katarch` (the video course; its videos stream from R2) | nothing |
| KnowGraph | none: `scripts/apps/knowgraph-video/` in this repo, a page that plays the product video on the bridge's clock (the app needs the visitor's own LLM and ships as a desktop download) | nothing; its tape is the video itself, written by `node scripts/tapes/make-video-tape.mjs knowgraph <dark.mp4> <light.mp4> 34` (a clip per edition, cut to the study loop) |
| PlaySync | `../rave2-embed` (branch `portfolio-embed`: no service worker, video muted in a frame) | the real server, clock pinned: `PIN=15:24 PORT=3099 npx tsx --import ../portfolio/scripts/tapes/pin-clock.mjs server/index.ts` |
| LifeUI | none: `scripts/apps/lifeui-video/` in this repo, a page that plays the product film on the bridge's clock (the coach needs a language model of the visitor's own) | nothing; its tape is the film itself, written by `node scripts/tapes/make-video-tape.mjs lifeui ../life-ui/site/media/lifeui-film-dark.mp4 ../life-ui/site/media/lifeui-film-light.mp4` (a clip per edition, the whole 33 s) |
| LoLImpact | `../LoLImpact/frontend` | its backend: `python -m uvicorn app.main:app --port 8010` in `backend/` |

Scenes live in `scripts/tapes/scenes/`. The stage is `src/pages/stage.astro` (`src/scripts/stage.ts`: the tape player `src/scripts/tape.ts` and the live app's session `src/scripts/session.ts`), the page's `<tape-player>` `src/scripts/player.ts`, the live previews and their window `src/scripts/live.ts`, the bridge inlined into vendored apps `scripts/apps/bridge.js` (clock and timers, recorded API answers, the route), and PlaySync's stand-in room `scripts/apps/playsync-room.js`. After a bridge change, `node scripts/apps/vendor.mjs --bridge` puts it into the built apps without rebuilding them.

Stages load from `PUBLIC_STAGE_ORIGIN` when it's set at build time: another registrable domain serving this same deployment (a subdomain is the same site, and gets no process of its own), such as a second domain pointed at the same Worker. Locally a page on `localhost` loads them from `127.0.0.1` (the dev and preview servers listen there). Without either, stages load from the page's own origin and run in its process.

```bash
node scripts/perf/check.mjs              # every preview plays, goes live, and the stage is out of process
node scripts/perf/check.mjs --gate       # + frame budgets: steady phases p99 <= 16.7 ms, no gap > 100 ms; cold transients p99 <= 100 ms, no gap > 500 ms
npm run perf:gate                        # the gate at 2x CPU throttling
node scripts/perf/live.mjs [label]       # fps of every interaction: the cycle, hover to live, the window
node scripts/perf/scroll.mjs             # fps of scrolling the portfolio: slow down, fast back up
node scripts/perf/trace.mjs <label>      # traces of the showcase's moments, summarized per process
node scripts/perf/ab.mjs base,noshadow   # one thing switched off at a time, alternating runs
```

**The frame budget.** Every interaction is measured (`--gate`). The page keeps a flight recorder (`src/scripts/blackbox.ts`): frame gaps over 250 ms dump what was mounting, whether the window was open, and whether the page was flinging. Heavy work is scheduled around the visitor:

- Stages mount one at a time, never while the visitor is interacting.
- A product change is spread over three frames (the rail first, the slide next, the recording and the address last), with the incoming slide's textures pre-rastered during its countdown.
- The panel's ambient light is resolved at build time (a `data-p` flip, not four variables through the subtree).
- A boot starts where the tape ended (every tape records a final checkpoint), with its bytes already fetched (`warm-bytes`, fired when the slide turns active, never during the boot itself: a fetch in flight would deduplicate against the frame's own load).
- Under the pointer the tape responds as a ghost until the real app takes over.
- The bridge controls the app's frames as it controls its clock: an app nobody sees renders no frames, and a visible one runs at the highest steady rate the stage measures the machine can hold (`setPace`), with endless animations at reduced pace.
- While one preview is active, every other tape releases its document.

Measured results: a three-stage mount burst went from 800 ms to 84 ms; window morphs from 60–71% hitched frames to 0–22%; a heavy app in its window from 58 fps / 71% hitched to 240 fps / 0% (PlaySync, whose YouTube player is outside the bridge's control: 42 to 95 fps).

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
| `src/data/career.ts` | Time in the industry, computed at build time. |
| `src/pages/work/[id].astro` | Case study template (five sections), generated from `projects.ts`. |
| `src/layouts/Base.astro` | The app shell: head, pre-paint theme and deep-link scripts, `Bar`, the section rail (`Dock`), the deck, image viewer. |
| `src/scripts/deck.ts` | The vertical deck: wheel, keys, links, hash, section rail and ambient light. |
| `src/scripts/fx.ts` | Pointer spotlight and tilt. |
| `src/scripts/flags.ts` | The lite mode's switch: off by default, `?lite` in the URL for one visit. On, a preview's window opens without its animation. |
| `src/components/Plate.astro` | Theme-aware screenshot in a browser window, with the recording player. |
| `src/styles/global.css` | Tokens for both editions, ambient layers, shell, surfaces, buttons, plates, pins. |
| `src/assets/portrait/` | The portrait, a dark and a white studio shot (the site shows the opposite one). |
| `src/assets/shots/` | Product screenshots (WebP, 2x), as `name-light` / `name-dark`. |
| `src/assets/motion/` | Screen recordings (H.264 MP4, 1920 wide), as `name-light` / `name-dark`. |
| `docs/readme/` | The pictures in this README, and in each product's own: drawn by `scripts/readme/build.mjs` from `panels.mjs` (a screenshot in the site's window, with a headline). `site-shots.mjs` captures this site's own screens from `dist/`. |

To update a product screenshot, capture 16:10 at 2x in both themes, keep the file names, and adjust the callout coordinates (`x`, `y` in percent) in `projects.ts` if the layout changed. A lead shot with a recording should use the recording's last frame as its still, so the hand-off from video to callouts matches.

## Deploy

Any static host works. Production is a Cloudflare Worker with static assets (`wrangler.jsonc`, plus `worker/index.js` for deep links into the embedded demos): `npm run deploy` builds and publishes it to felix.medanolabs.com, and `npm run deploy:staging` to felix-stg.medanolabs.com.

Design context: [`PRODUCT.md`](PRODUCT.md) (audience, voice, evidence) and [`DESIGN.md`](DESIGN.md) (the visual system).

## The products

| | |
| --- | --- |
| [KatArch](https://github.com/Felichz/katarch) | A narrated video course on software architecture, built from what the twelve winning teams of the Architecture Katas left in writing. |
| [KnowGraph](https://github.com/Felichz/KnowGraph) | Senior React and Rails interview prep as a map of 142 concepts: you explain each one and an LLM you bring grades it. Desktop app; the preview here is its product video. |
| [PlaySync](https://github.com/Felichz/PlaySync) | Synced YouTube watch parties with no accounts and a server-owned clock. |
| [LifeUI](https://github.com/Felichz/life-ui) | A personal assistant and coach that runs on a local model: it looks things up, plans with you and puts each session on your calendar once you say yes. |
| [BondiUY](https://github.com/Felichz/bondi-uy) | Bus trips across Montevideo, step by step: it plans the trip, follows the bus you are waiting for and tells you when to get off. Android and web. |
| [LoL-Impact](https://github.com/Felichz/LoL-Impact) | League of Legends win probability, minute by minute, with the uncertainty shown. |

## License

The code is under the [MIT license](LICENSE). The writing, the résumé, the photographs and the products' recordings are © Felix Andersson.
