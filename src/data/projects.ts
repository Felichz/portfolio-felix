import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/shots/*.webp', { eager: true });
const clips = import.meta.glob<string>('../assets/motion/*.mp4', { eager: true, query: '?url', import: 'default' });

function img(name: string): ImageMetadata {
  const hit = files[`../assets/shots/${name}.webp`];
  if (!hit) throw new Error(`Missing screenshot: ${name}.webp`);
  return hit.default;
}

function clip(name: string): string {
  const hit = clips[`../assets/motion/${name}.mp4`];
  if (!hit) throw new Error(`Missing clip: ${name}.mp4`);
  return hit;
}

/**
 * A screenshot in both themes, and optionally a short screen recording of the same view.
 * The site shows the opposite edition: light captures on the dark site, dark ones on the light site.
 */
export interface Shot {
  light: ImageMetadata;
  dark: ImageMetadata;
  alt: string;
  caption?: string;
  phone?: boolean;
  /** MP4 recordings, same framing as the screenshot. For a lead shot, the last frame matches the still. */
  motion?: { light: string; dark: string };
  /**
   * A tape instead of recordings: public/tapes/<id>.json, the app's own DOM replayed (src/scripts/tape.ts).
   * One tape serves both themes, and the live app (vendored at public/apps/<id>/) boots under it (src/scripts/live.ts).
   */
  tape?: string;
}

function themed(name: string, alt: string, extra: Partial<Shot> = {}): Shot {
  return { light: img(`${name}-light`), dark: img(`${name}-dark`), alt, ...extra };
}

/** Pairs a shot with its recordings, `name-light.mp4` and `name-dark.mp4`. */
function moving(shot: Shot, name: string): Shot {
  return { ...shot, motion: { light: clip(`${name}-light`), dark: clip(`${name}-dark`) } };
}

export interface Callout {
  /** Pin position, in percent of the main screenshot. */
  x: number;
  y: number;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  /** Class that sets the product's own display face. */
  face: string;
  wordmark?: [string, string];
  year: string;
  /** A few words for the showcase rail. */
  short: string;
  tagline: string;
  /** One line of evidence for the gallery slide. */
  proof: string;
  live: string;
  liveNote?: string;
  source: string;
  role: string;
  stack: string[];
  scale: string[];
  story: string[];
  highlights: { title: string; body: string }[];
  /**
   * An optional chapter between Engineering and Screens on the case study: how one system works, step by
   * step, and the numbers measured along the way.
   */
  deepDive?: {
    title: string;
    /** A long-form write-up of the same story, linked from the chapter. */
    writeup?: string;
    intro: string;
    steps: { title: string; body: string }[];
    numbers: { value: string; label: string }[];
  };
  typefaces: string[];
  palette: string[];
  /** Interface languages; English is the default everywhere. */
  language: 'English and Spanish' | 'English';
  accent: { light: string; dark: string; onLight: string; onDark: string };
  main: Shot;
  callouts: Callout[];
  gallery: Shot[];
}

export const projects: Project[] = [
  {
    id: 'katarch',
    short: 'An architecture course, replayed decision by decision',
    name: 'KatArch',
    face: 'face-inter',
    year: '2026',
    tagline:
      'An interactive course that replays, decision by decision, how the winning team of O’Reilly’s Fall 2020 Architecture Kata designed their system.',
    proof: '6 chapters, ~80 steps, 49 animated diagram scenes, 39 source documents',
    live: 'https://katarch.vercel.app/',
    source: 'https://github.com/Felichz/katarch',
    role: 'Solo: research, writing, design and frontend',
    stack: ['Astro', 'React islands', 'TypeScript', 'Motion', 'Hand-written CSS', 'Vercel'],
    scale: ['66 commits', '6 chapters, ~80 steps', '49 diagram scenes', 'Light and dark'],
    story: [
      'I wanted to learn software architecture from a real case instead of a textbook, so I turned the winning solution of O’Reilly’s Fall 2020 Architecture Kata into a course. One idea per screen, in the order the team actually made each decision, with every claim linked to their original repository.',
      'One rule shaped everything: no concept, diagram or ADR appears before the problem that motivated it. The diagrams assemble step by step, and some of them are small working simulations you can poke at, like a 30-second undo window or an offline PIN pickup.',
    ],
    highlights: [
      {
        title: 'Diagrams that morph instead of reloading',
        body: 'Chapters are typed lists of steps. When consecutive steps share a scene, the same React component stays mounted and only its state changes, so the diagram builds up in place.',
      },
      {
        title: 'A small SVG animation kit',
        body: 'Spring-animated nodes, edges that draw themselves, message packets that travel along paths, and one color legend for commands, events, stateful components and failures.',
      },
      {
        title: 'Readable without the visuals',
        body: 'Keyboard and swipe navigation, a deep link per step, an aria-live announcer, reduced-motion fallbacks and a text version of every diagram. Each page ships only the concepts its chapter uses.',
      },
    ],
    typefaces: ['Inter', 'JetBrains Mono'],
    palette: ['#0B0E13', '#FF7A45', '#6EA2FF', '#3FD694', '#B69BFF'],
    language: 'English and Spanish',
    accent: { light: '#C2410C', dark: '#FF7A45', onLight: '#FFFFFF', onDark: '#1A0D06' },
    main: {
      ...themed(
        'katarch-main',
        'KatArch, chapter 5, step 5: the Menu Catalog service diagram. Kitchen, loyalty and point-of-sale systems enter through an anti-corruption layer that translates their formats; the domain emits a stock-updated event to cart, recommendations, reviews and filtering.',
      ),
      tape: 'katarch',
    },
    callouts: [
      { x: 51.6, y: 36.4, text: 'The anti-corruption layer: third-party formats are translated at the border, so the domain only sees its own model.' },
      { x: 66.4, y: 48.6, text: 'One legend across every diagram: commands in blue, events in green, the domain in orange.' },
      { x: 88.4, y: 10.4, text: 'Every diagram has a text version, for screen readers and for quick reading.' },
    ],
    gallery: [
      themed('katarch-composition', 'KatArch system composition diagram: subsystems grouped by quality budget, with ordering and the menu catalog as centers of gravity.', { caption: 'System composition' }),
      moving(
        themed('katarch-undo', 'KatArch simulator of a 30-second undo window: an order held in memory at 10 of 30 seconds before reaching the payment gateway.', { caption: 'A working simulation' }),
        'katarch-undo',
      ),
      themed('katarch-valuemap', 'KatArch value map from ADR 002: four architecture styles scored against ten quality attributes.', { caption: 'ADR value map' }),
      themed('katarch-mobile', 'KatArch on a phone: the same diagram stacked above the explanation.', { phone: true, caption: 'On a phone' }),
    ],
  },
  {
    id: 'knowgraph',
    short: 'Interview prep as a map of 142 concepts',
    name: 'KnowGraph',
    face: 'face-newsreader',
    year: '2026',
    tagline:
      'Senior React and Rails interview prep as a map of 142 concepts, each studied in a four-stage session with an AI mentor that grades your explanation.',
    proof: '146 commits, 142 concepts and 266 links, 10 ADRs, 33 Playwright tests',
    live: 'https://know-graph.vercel.app/',
    source: 'https://github.com/Felichz/KnowGraph',
    role: 'Solo: product, curriculum, design, frontend and AI gateway',
    stack: ['React 19', 'Vite', 'Node gateway', 'Zod', 'Server-sent events', 'IndexedDB', 'Mermaid', 'Playwright', 'Electron'],
    scale: ['146 commits', '142 concepts, 266 links', '10 ADRs', '33 Playwright tests'],
    story: [
      'I built it to prepare my own senior interviews. 142 concepts across React and Rails, linked by what you need to understand first, grouped into focus areas and milestones by seniority level. Each concept runs a four-stage session: read it, talk it through with a Socratic AI mentor, explain it back from memory, then get graded against a rubric.',
      'Scores run from 0 to 120. 100 means the base is covered; 101 to 120 is a separate excellence tier, there to push back on the grade inflation LLMs tend toward. Everything is local-first and bring-your-own-key: progress stays in IndexedDB, and the AI gateway never stores anything.',
    ],
    highlights: [
      {
        title: 'Graph layout without D3',
        body: 'Kahn topological ranking that tolerates cycles, then eight barycenter sweeps to cut edge crossings. Hovering a node brings its prerequisites and dependents forward.',
      },
      {
        title: 'Rendering JSON as it streams',
        body: 'The evaluation arrives as structured JSON over SSE and is parsed incrementally, so rubric fields fill in while the model is still writing. Zod validates the final object.',
      },
      {
        title: 'A headless core',
        body: 'A framework-free controller wired to React through useSyncExternalStore replaced a 2,642-line App.jsx. Evaluations keep running in the background and stay in sync across tabs with BroadcastChannel.',
      },
    ],
    typefaces: ['Geist', 'Newsreader'],
    palette: ['#100E0C', '#EEECE7', '#909CF5', '#74C692', '#E8BE62'],
    language: 'English and Spanish',
    accent: { light: '#5B67D8', dark: '#909CF5', onLight: '#FFFFFF', onDark: '#100E0C' },
    main: {
      ...themed(
        'knowgraph-main',
        'KnowGraph map view: a sidebar of focus areas with progress counts, the suggested next concept, and concept cards, some scored 105 and 115 out of 120.',
      ),
      tape: 'knowgraph',
    },
    callouts: [
      { x: 18.4, y: 22.4, text: 'The suggested route: the next concept you’re ready for, and what it unlocks.' },
      { x: 26.6, y: 64.4, text: 'Scores above 100 land in the gold excellence tier.' },
      { x: 17.2, y: 29, text: 'Focus areas with mastered counts, one color per category.' },
    ],
    gallery: [
      themed('knowgraph-card', 'KnowGraph study card in its reading stage, set in a serif reading face with a code sample.', { caption: 'Study card, reading stage' }),
      moving(
        themed('knowgraph-graph', 'KnowGraph graph view: hovering Error boundaries and recovery lights its prerequisite, Components, props and composition, and dims the rest of the stage columns.', { caption: 'Dependency graph' }),
        'knowgraph-graph',
      ),
      themed('knowgraph-progress', 'KnowGraph progress view with seniority levels and milestones.', { caption: 'Progress by seniority' }),
    ],
  },
  {
    id: 'playsync',
    short: 'Synced YouTube watch parties, no accounts',
    name: 'PlaySync',
    face: 'face-bricolage',
    year: '2026',
    tagline: 'Same video, same second, from two different time zones. Create a room, share a code, and watch YouTube together while you chat.',
    proof: 'Server-owned clock, drift correction, one process and no database',
    live: 'https://syncplay-avtu.onrender.com/',
    liveNote: 'Hosted on a free Render instance, so the first load can take up to a minute while it wakes up.',
    source: 'https://github.com/Felichz/PlaySync',
    role: 'Solo: product, design, frontend and realtime server',
    stack: ['React 19', 'TypeScript', 'Vite', 'Node (node:http + ws)', 'YouTube IFrame API', 'PWA with Workbox', 'Render'],
    scale: ['~8,300 lines', 'One process, no database', '18-check two-client smoke test'],
    story: [
      'Everyone’s play, pause and seek stay locked while you chat, react and queue up the next video. The video never touches the server: each client streams straight from YouTube, and only small sync and chat messages go through the room.',
      'The server owns the clock. It stores a position and when it last changed, and clients estimate server time NTP-style, discarding samples from throttled background tabs. A reconcile loop only seeks when drift passes 1.5 seconds, and waits 2.5 seconds after a local action so the player never fights its own echo.',
    ],
    highlights: [
      {
        title: 'Permissions on the server',
        body: 'Host, control and viewer roles are enforced server-side. The host survives a reload through a per-browser ID and hands over to the longest-present guest after a 60-second grace period.',
      },
      {
        title: 'A Google Drive streaming proxy',
        body: 'Gets past Drive’s virus-scan page, forwards Range headers so seeking works, re-resolves expiring URLs, and cuts stalled streams after 12 seconds.',
      },
      {
        title: 'Hardened by default',
        body: 'Every intent is validated, chat is rate limited, messages are capped at 16 KB, static serving blocks path traversal, and blocked autoplay on iOS turns into a clear tap-to-play state.',
      },
    ],
    typefaces: ['Bricolage Grotesque', 'Figtree'],
    palette: ['#0F0B10', '#FFB08A', '#FF8497', '#7FDCAE', '#F7EEE9'],
    language: 'English and Spanish',
    accent: { light: '#C2562A', dark: '#FFB08A', onLight: '#FFFFFF', onDark: '#2B130C' },
    main: {
      ...themed(
        'playsync-main',
        'PlaySync room on desktop: Big Buck Bunny playing with custom controls, the room code, a Watching together status, a chat between Felix and Sofi, and Sofi’s popcorn reaction floating over the video.',
      ),
      tape: 'playsync',
    },
    callouts: [
      { x: 74.8, y: 3.2, text: 'Live presence: who is here, and whether the room is watching together.' },
      { x: 25.8, y: 3.2, text: 'The room code. No accounts, just share it.' },
      { x: 71.6, y: 11, text: 'Chat, queue and people share one panel; on phones they become a bottom tab bar.' },
    ],
    gallery: [
      themed('playsync-mobile', 'A PlaySync room on a phone, as a guest: the video, a view-only notice with a button to ask for control, and the chat.', { phone: true, caption: 'The guest, on a phone' }),
      themed('playsync-search', 'PlaySync YouTube search inside a room, with Blender open movie results.', { caption: 'Search without an API key' }),
      themed('playsync-landing', 'PlaySync landing page with the headline Same video, same second, and the room creation form.', { caption: 'Landing' }),
    ],
  },
  {
    id: 'lifeui',
    short: 'A HUD for real life, one activity at a time',
    name: 'LifeUI',
    face: 'face-inter',
    year: '2026',
    tagline: 'A HUD for real life: plan the day in time blocks, run one activity at a time, and close each one with a single honest moment.',
    proof: '158 commits, 257 tests, CI on every push, light and dark',
    live: 'https://life-ui-one.vercel.app/',
    source: 'https://github.com/Felichz/life-ui',
    role: 'Solo: product, design system, frontend and tests',
    stack: ['React 18', 'TypeScript (strict)', 'Vite', 'Tailwind with CSS-variable tokens', 'Radix UI', 'Jest', 'Testing Library', 'Cypress', 'GitHub Actions'],
    scale: ['158 commits', '257 tests (Jest and Cypress)', '44 components', 'Light and dark'],
    story: [
      'Not a todo app, not a habit tracker, not a time tracker. You keep a library of repeatable activities, drop them into the day’s time blocks, and run one at a time. Each one ends in a closing ritual: rate it from 0 to 10 and earn tempos. Tempos only go up. No streaks, no penalties, and free time costs nothing.',
      'This year I rebuilt the whole interface from scratch to the standard of a tool like Linear, on top of a domain core that doesn’t know React exists. CI runs typecheck, lint with zero warnings, Jest, the build and Cypress on every push.',
    ],
    highlights: [
      {
        title: 'A core that doesn’t know React',
        body: 'Immutable state, subscriptions and managers in plain TypeScript. The UI reaches it through one adapter, and tests drive a real core instead of mocks.',
      },
      {
        title: 'Versioned persistence',
        body: 'Every load goes parse, validate, migrate through schema v1, v2 and v3, then sanitize. Legacy fields are archived rather than dropped, and JSON import runs through the same path.',
      },
      {
        title: 'The preview is the result',
        body: 'The closing dialog calls the same reward function as the core, so the tempos you see are the tempos you get. The typed i18n layer makes English and Spanish keep exactly the same keys.',
      },
    ],
    typefaces: ['Inter'],
    palette: ['#FCFCFD', '#16161A', '#5854D6', '#F59E0B', '#148054'],
    language: 'English and Spanish',
    accent: { light: '#5854D6', dark: '#7C79F0', onLight: '#FFFFFF', onDark: '#0E0F12' },
    main: {
      ...themed(
        'lifeui-main',
        'LifeUI Today screen: Read has just started from a quick-start chip, 157 tempos today at 157% of the daily reference, the day plan by time blocks, and a log where Write report was just closed at 9 out of 10 for 78 tempos.',
      ),
      tape: 'lifeui',
    },
    callouts: [
      { x: 19, y: 12, text: 'Only one activity runs at a time, with its progress against its estimate or timebox.' },
      { x: 73.6, y: 12.4, text: 'Tempos today, shown as a share of your reference: an anchor, never a debt.' },
      { x: 26.2, y: 44, text: 'Quick start for pinned activities. Everything has a shortcut and a command palette.' },
    ],
    gallery: [
      themed('lifeui-closing', 'LifeUI closing ritual: rate the activity from 0 to 10 and see the reward preview of +60 tempos.', { caption: 'Closing ritual' }),
      themed('lifeui-review', 'LifeUI review screen: the day timeline, time by activity type and a table of closed activities.', { caption: 'Review' }),
      themed('lifeui-library', 'LifeUI library of reusable activities with their duration rules and history.', { caption: 'Library' }),
      themed('lifeui-mobile', 'LifeUI closing ritual on a phone.', { phone: true, caption: 'On a phone' }),
    ],
  },
  {
    id: 'lolimpact',
    short: 'League win probability, minute by minute',
    name: 'LoLImpact',
    face: 'face-martian',
    wordmark: ['LOL', 'IMPACT'],
    year: '2026',
    tagline: 'Which lane moved your League game, minute by minute, and how sure the model can be about it.',
    proof: 'Six per-minute models, intervals on every number, no ML runtime in production',
    live: 'https://lol-impact.vercel.app/',
    liveNote: 'The public deploy is running without a Riot API key right now, so the match screens here come from a local run.',
    source: 'https://github.com/Felichz/LoL-Impact',
    role: 'Solo: product, statistics, design, frontend and backend',
    stack: ['Svelte 5', 'TypeScript', 'Vite', 'Python', 'FastAPI', 'numpy', 'scikit-learn', 'Riot API', 'Vercel'],
    scale: ['6 per-minute models', '~4,200 lines', '21 Svelte components', 'Light and dark'],
    story: [
      'A win-probability model for League of Legends, trained on recent Emerald+ LAS solo queue games. You load your Riot ID and see how your team’s chances moved through each game, which lane pulled hardest, and whether that pull is real or noise. Held-out accuracy climbs from 62.8% at minute 8 to 74.9% at minute 20.',
      'The hard part was honesty. A model with one slope per champion turned out to be unidentifiable, so slopes are grouped by role and champion class instead. Every number ships with its interval, and anything the data can’t confirm is drawn in ash and sags on the chart instead of pretending to be a finding.',
    ],
    highlights: [
      {
        title: 'One model per minute',
        body: 'Logistic models at minutes 8, 10, 12, 15, 18 and 20, trained on a time-based split with regularization picked on a validation slice. Each exports its full covariance matrix, computed from the Hessian.',
      },
      {
        title: 'Uncertainty without an ML runtime',
        body: 'Error bars come from the delta method at request time. Percentiles use 201 precomputed quantiles instead of a 130 MB CSV, so production only needs FastAPI, pydantic and numpy.',
      },
      {
        title: 'A Riot client that respects limits',
        body: 'Thread-safe rate limiting (20 per second, 100 per two minutes), key rotation tied to the key that issued each ID, Retry-After on 429, backoff on 5xx, atomic cache writes and a degraded mode.',
      },
    ],
    typefaces: ['Martian Mono', 'Geist'],
    palette: ['#E7E5E1', '#F2F1ED', '#0D0D0F', '#D62828', '#9A9A9A'],
    language: 'English and Spanish',
    accent: { light: '#C81E1E', dark: '#E5484D', onLight: '#FFFFFF', onDark: '#1A0606' },
    main: {
      ...themed(
        'lol-main',
        'LoLImpact match view: recent games on the left, a readout for minute 12 showing 64% win probability with a 55% to 72% likely range, and a column chart of win probability by minute with uncertainty bands.',
      ),
      tape: 'lolimpact',
    },
    callouts: [
      { x: 30.2, y: 46.5, text: 'Every probability is shown with its likely range, never alone.' },
      { x: 93.6, y: 34, text: 'Hand-built SVG column: 50% and 95% bands around each minute, keyboard navigable.' },
      { x: 80.5, y: 53, text: 'Lanes pulling the game at the selected minute. Unconfirmed pulls stay ash and dashed.' },
    ],
    gallery: [
      themed('lol-draft', 'LoLImpact draft tool with ten champion slots split between your team and the rival team.', { caption: 'Draft tool' }),
      themed('lol-mobile', 'LoLImpact on a phone: the minute 12 readout above the probability column.', { phone: true, caption: 'On a phone' }),
    ],
  },
  {
    id: 'portfolio',
    short: 'The site you’re on, and how it opens the others',
    name: 'This portfolio',
    face: 'face-archivo',
    year: '2026',
    tagline:
      'A portfolio that shows its products by running them: each preview is the app’s own DOM, replayed, and under your pointer it becomes the app, in the same state.',
    proof: '17.7 MB of preview videos replaced by 230 KB of tapes, and every product live in its preview',
    live: 'https://portfolio-felix-teal.vercel.app/',
    source: 'https://github.com/Felichz/portfolio-felix',
    role: 'Solo: design, frontend and the recording pipeline',
    stack: ['Astro', 'TypeScript', 'Hand-written CSS', 'Custom elements', 'Web Animations API', 'View Transitions', 'Puppeteer and the Chrome DevTools Protocol', 'Vercel'],
    scale: ['~7,900 lines of TypeScript, Astro, CSS and scripts', '9 components', '6 tapes, 230 KB gzipped for the five products', 'Light and dark'],
    story: [
      'I wanted the portfolio to be one of the projects, not only the frame around them. It behaves like a desktop app: one fixed window, sections that move one at a time, and an ambient light that takes the color of whatever you’re looking at.',
      'The part I find most interesting is how the products show up. A video is the easy answer, and it’s what this site started with: two MP4s per product, one for each theme. Every preview is now a tape instead, the product’s own DOM recorded while a scripted scene drives it, replayed with its real stylesheet and none of its JavaScript. Once you’re using the page, the real app runs under the preview and keeps up with it. Put your pointer on it and it’s the app, in the state you were watching; its green light opens it in a window, still live.',
      'Each product needed a scene and a way to seed its state, and three needed their backend on the tape: LoLImpact’s API answers, KnowGraph’s IndexedDB, and for PlaySync a stand-in room server and its YouTube player, filmed as a clip. The write-up tells the whole story, including what broke.',
    ],
    highlights: [
      {
        title: 'One window, one gesture',
        body: 'The document never scrolls; a deck of full-height sections does, one per gesture. Anything that can still scroll under the pointer scrolls first, and the wheel has to rest before the deck moves again, so the two never fight.',
      },
      {
        title: 'Theme switches that restart nothing',
        body: 'The new edition spreads in a circle from the toggle, in one view-transition snapshot. Recordings keep their place across it, the showcase countdown doesn’t notice, and a tape switches on the same frame.',
      },
      {
        title: 'Measured, not assumed',
        body: 'Effects stayed only after a Chrome trace. The cursor light moved off a full-window canvas (82 to 235 fps), recordings got a keyframe every second (seeks from about 220 to 85 ms), and the résumé PDF went from 27 soft-masked images to one.',
      },
    ],
    deepDive: {
      title: 'From a video of the app to the app',
      writeup: '/work/portfolio/how-its-built/',
      intro:
        'Every product preview here used to be a pair of videos. The question was whether it could be the product itself, without paying for it in page weight or frames.',
      steps: [
        {
          title: 'Record',
          body: 'A scene drives the app in headless Chrome, written like an end-to-end test. A recorder inside the page writes down the DOM and every change to it, with child lists stored whole so moves never need tracking, plus the pointer, hover and focus, and checkpoints at rest points with the app’s storage and clock.',
        },
        {
          title: 'Replay',
          body: 'A custom element rebuilds that DOM in an iframe that can’t run scripts, with the app’s own stylesheet, and applies each change at its time. Hover and focus come back as attributes the stylesheet was rewritten to match, Web Animations are recreated on the tape’s clock, and the app’s theme is one attribute, so a single tape plays in both editions. It speaks enough of the video element’s API that the showcase didn’t have to change.',
        },
        {
          title: 'Go live',
          body: 'After your first input, never during page load, the app’s build (vendored on this origin) boots under the preview from the last checkpoint: its route, storage and clock. It keeps up with the tape: each recorded click, key and typed text is replayed in it as the tape reaches it, with the app’s clock and timers set to that recorded moment. Hovering swaps the tape for the app on the same frame; from there, hovers and clicks are the app’s own.',
        },
        {
          title: 'Bring the backend',
          body: 'Three products needed more than a browser. LoLImpact’s API answers are recorded with its scene and served to its fetches; KnowGraph’s IndexedDB is dumped at checkpoints and written back before it boots; PlaySync gets a stand-in room server, rebuilt from the scene’s socket, and its YouTube player is filmed as a clip for the tape.',
        },
        {
          title: 'Open in a window',
          body: 'The green light moves the preview’s contents into a window over the page with moveBefore, which keeps an iframe’s state where a regular move would reload it. There the same app runs at its own size, and the window grows out of the preview in a view transition: a picture of the app scaled on the compositor while the app, laid out once at its new size, takes over. Red or yellow moves it back, still live.',
        },
        {
          title: 'Measure',
          body: 'Each step was checked against traces, pixels and Lighthouse. Resizing the app every frame ran at about 20 fps, so the window is a view transition, and its frames were checked one by one by stepping the animations’ time by hand. Booting after the first input keeps page-load audits from paying for any of it.',
        },
      ],
      numbers: [
        { value: '230 KB', label: 'the five products’ tapes, gzipped, in place of 17.7 MB of video' },
        { value: '48 ms', label: 'where the window’s two pictures of the app cross over, while it’s still small' },
        { value: '100', label: 'Lighthouse accessibility, best practices and SEO, in every run with live apps in place' },
        { value: '235 fps', label: 'with the cursor light on, after moving it off a full-window canvas (82 before)' },
      ],
    },
    typefaces: ['Archivo', 'Newsreader'],
    palette: ['#F2F1ED', '#0A0A0C', '#111114', '#0D7A5F', '#5FD6B0'],
    language: 'English',
    accent: { light: '#0D7A5F', dark: '#5FD6B0', onLight: '#FFFFFF', onDark: '#04140F' },
    main: {
      ...themed('portfolio-main', 'This portfolio’s Intro: the name set in Archivo, the role and a short lede, four strengths, and the portrait on the right.'),
      tape: 'portfolio',
    },
    callouts: [
      { x: 31, y: 22, text: 'The name is set one letter at a time, and widens toward the pointer along Archivo’s width axis.' },
      { x: 2.4, y: 43, text: 'One gesture moves one section. These dots are the only navigation chrome.' },
      { x: 76, y: 30, text: 'Two portraits, one per edition; only the visible one is downloaded.' },
    ],
    gallery: [
      themed('portfolio-work', 'The work showcase with LifeUI selected: its preview, a tape of the app’s own DOM, is in the middle of the closing ritual.', { caption: 'A tape in the showcase' }),
      themed('portfolio-thaw', 'Opening LifeUI: the live preview grows into a window over the portfolio, which steps back behind it.', { caption: 'Opening an app in place' }),
      themed('portfolio-case', 'A case study overview: LifeUI’s name, facts and actions next to its preview.', { caption: 'A case study' }),
      themed('portfolio-mobile', 'This portfolio’s Intro on a phone, with the tab bar at the bottom.', { phone: true, caption: 'On a phone' }),
    ],
  },
];

export const byId = (id: string) => projects.find((p) => p.id === id);
