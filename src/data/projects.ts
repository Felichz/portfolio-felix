import type { ImageMetadata } from 'astro';

import lolMatch from '../assets/shots/lol-match.webp';
import lolMatchDark from '../assets/shots/lol-match-dark.webp';
import lolLanding from '../assets/shots/lol-landing.webp';
import lolMobile from '../assets/shots/lol-mobile.webp';
import lolDraft from '../assets/shots/lol-draft.webp';

import kgMap from '../assets/shots/kg-map.webp';
import kgCard from '../assets/shots/kg-card.webp';
import kgGraph from '../assets/shots/kg-graph.webp';
import kgProgress from '../assets/shots/kg-progress.webp';

import lifeLight from '../assets/shots/lifeui-today-light.webp';
import lifeDark from '../assets/shots/lifeui-today-dark.webp';
import lifeClosing from '../assets/shots/lifeui-closing.webp';
import lifeReview from '../assets/shots/lifeui-review.webp';
import lifeLibrary from '../assets/shots/lifeui-library.webp';

import psRoom from '../assets/shots/ps-room.webp';
import psMobile from '../assets/shots/ps-mobile.webp';
import psSearch from '../assets/shots/ps-search.webp';
import psLanding from '../assets/shots/ps-landing.webp';

import kaUndo from '../assets/shots/katarch-undo.webp';
import kaActor from '../assets/shots/katarch-actor.webp';
import kaPin from '../assets/shots/katarch-pin.webp';
import kaHub from '../assets/shots/katarch-hub.webp';
import kaMobile from '../assets/shots/katarch-mobile.webp';

export interface Shot {
  src: ImageMetadata;
  alt: string;
  caption?: string;
}

export interface Callout {
  /** Position of the pin, in percent of the main screenshot. */
  x: number;
  y: number;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  /** CSS class that sets the product's own display face. */
  face: string;
  /** Optional split name, for wordmarks that mix weights (LOL + IMPACT). */
  wordmark?: [string, string];
  index: string;
  indexStack: string;
  tagline: string;
  live: string;
  liveNote?: string;
  source: string;
  role: string;
  stack: string[];
  scale: string[];
  story: string[];
  highlights: { title: string; body: string }[];
  typefaces: { name: string; family: string; use: string }[];
  palette: { name: string; hex: string }[];
  note?: string;
  theme: {
    scheme: 'light' | 'dark';
    ground: string;
    surface: string;
    ink: string;
    muted: string;
    rule: string;
    accent: string;
    accentText: string;
    onAccent: string;
  };
  main: Shot;
  second?: Shot & { kind: 'phone' | 'screen' };
  callouts: Callout[];
  strip: Shot[];
}

export const projects: Project[] = [
  {
    id: 'lolimpact',
    name: 'LoLImpact',
    face: 'face-martian',
    wordmark: ['LOL', 'IMPACT'],
    index: 'Match analytics that show their uncertainty',
    indexStack: 'Svelte 5, FastAPI, numpy',
    tagline: 'Which lane moved your League game, minute by minute, and how sure the model can be about it.',
    live: 'https://lol-impact.vercel.app/',
    liveNote: 'The public deploy is running without a Riot API key right now, so the match screens here come from a local run.',
    source: 'https://github.com/Felichz/LoL-Impact',
    role: 'Solo: product, statistics, design, frontend and backend',
    stack: ['Svelte 5', 'TypeScript', 'Vite', 'Python', 'FastAPI', 'numpy', 'scikit-learn', 'Riot API', 'Vercel'],
    scale: ['6 per-minute models', '~4,200 lines', '21 Svelte components'],
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
    typefaces: [
      { name: 'Martian Mono', family: 'face-martian', use: 'Labels and numbers' },
      { name: 'Geist', family: 'face-geist', use: 'Sentences' },
    ],
    palette: [
      { name: 'Concrete', hex: '#E7E5E1' },
      { name: 'Paper', hex: '#F2F1ED' },
      { name: 'Carbon', hex: '#0D0D0F' },
      { name: 'Tension red', hex: '#D62828' },
      { name: 'Slack ash', hex: '#9A9A9A' },
    ],
    theme: {
      scheme: 'light',
      ground: '#E7E5E1',
      surface: '#F2F1ED',
      ink: '#0D0D0F',
      muted: '#4F4E4B',
      rule: '#CFCCC6',
      accent: '#D62828',
      accentText: '#B21E1E',
      onAccent: '#FFFFFF',
    },
    main: {
      src: lolMatch,
      alt: 'LoLImpact match view: a list of recent games on the left, a readout for minute 12 showing 64% win probability with a 55% to 72% likely range, and a vertical column chart of win probability by minute with shaded uncertainty bands.',
    },
    second: {
      kind: 'phone',
      src: lolMobile,
      alt: 'LoLImpact on a phone: the minute 12 readout with win probability, likely range and model accuracy.',
    },
    callouts: [
      { x: 30.2, y: 46.5, text: 'Every probability is shown with its likely range, never alone.' },
      { x: 93.6, y: 34, text: 'Hand-built SVG column: 50% and 95% bands around each minute, keyboard navigable.' },
      { x: 80.5, y: 53, text: 'Lanes pulling the game at the selected minute. Unconfirmed pulls stay ash and dashed.' },
    ],
    strip: [
      { src: lolMatchDark, alt: 'LoLImpact match view in the dark theme.', caption: 'Dark theme' },
      { src: lolLanding, alt: 'LoLImpact landing page with the headline What moved your games and an illustrative column chart.', caption: 'Landing' },
      { src: lolDraft, alt: 'LoLImpact draft tool with ten champion slots split between your team and the rival team.', caption: 'Draft tool' },
    ],
  },
  {
    id: 'knowgraph',
    name: 'KnowGraph',
    face: 'face-newsreader',
    index: 'Interview prep as a dependency graph, with an AI tutor',
    indexStack: 'React 19, Node, SSE',
    tagline: 'Senior React and Rails interview prep as a map of concepts, each studied in a four-stage session with an AI mentor.',
    live: 'https://know-graph.vercel.app/',
    source: 'https://github.com/Felichz/KnowGraph',
    role: 'Solo: product, curriculum, design, frontend and AI gateway',
    stack: ['React 19', 'Vite', 'Node gateway', 'Zod', 'Server-sent events', 'IndexedDB', 'Mermaid', 'Playwright', 'axe-core', 'Electron'],
    scale: ['146 commits', '142 concepts, 266 links', '10 ADRs', '33 Playwright tests'],
    story: [
      'I built it to prepare my own senior interviews. 142 concepts across React and Rails, linked by what you need to understand first. Each concept runs a four-stage session: read it, talk it through with a Socratic AI mentor, explain it back from memory, then get graded against a rubric.',
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
        body: 'A framework-free controller wired to React through useSyncExternalStore replaced a 2,643-line App.jsx. Evaluations keep running in the background and stay in sync across tabs with BroadcastChannel.',
      },
    ],
    typefaces: [
      { name: 'Geist', family: 'face-geist', use: 'Interface' },
      { name: 'Newsreader', family: 'face-newsreader', use: 'Reading' },
    ],
    palette: [
      { name: 'Graphite', hex: '#100E0C' },
      { name: 'Surface', hex: '#161512' },
      { name: 'Paper', hex: '#EEECE7' },
      { name: 'Iris', hex: '#909CF5' },
      { name: 'Mastery', hex: '#74C692' },
      { name: 'Gold', hex: '#E8BE62' },
    ],
    note: 'Interface in Spanish',
    theme: {
      scheme: 'dark',
      ground: '#100E0C',
      surface: '#161512',
      ink: '#EEECE7',
      muted: '#B7B3AB',
      rule: '#2B2825',
      accent: '#909CF5',
      accentText: '#A5B1FD',
      onAccent: '#100E0C',
    },
    main: {
      src: kgMap,
      alt: 'KnowGraph map view: a sidebar of focus areas with progress counts, a suggested next concept, and a grid of concept cards, some scored 105 and 115 out of 120.',
    },
    callouts: [
      { x: 18.4, y: 22.4, text: 'The suggested route: the next concept you’re ready for, and what it unlocks.' },
      { x: 26.6, y: 64.4, text: 'Scores above 100 land in the gold excellence tier.' },
      { x: 9.5, y: 26, text: 'Focus areas with mastered counts, one color per category.' },
    ],
    strip: [
      { src: kgGraph, alt: 'KnowGraph graph view with a hovered concept highlighting its prerequisite and dependent edges.', caption: 'Graph view' },
      { src: kgCard, alt: 'KnowGraph study card in reading mode, with the concept explained in a serif reading face and a code sample.', caption: 'Study card, reading stage' },
      { src: kgProgress, alt: 'KnowGraph progress view with seniority levels and milestones.', caption: 'Progress' },
    ],
  },
  {
    id: 'lifeui',
    name: 'LifeUI',
    face: 'face-inter',
    index: 'A HUD for real life',
    indexStack: 'React, TypeScript, Radix',
    tagline: 'Plan the day in time blocks, run one activity at a time, and close each one with a single honest moment.',
    live: 'https://life-ui-one.vercel.app/',
    source: 'https://github.com/Felichz/life-ui',
    role: 'Solo: product, design system, frontend and tests',
    stack: ['React 18', 'TypeScript (strict)', 'Vite', 'Tailwind with CSS-variable tokens', 'Radix UI', 'Jest', 'Testing Library', 'Cypress', 'GitHub Actions'],
    scale: ['158 commits', '262 test cases', '44 components', 'Light and dark'],
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
    typefaces: [{ name: 'Inter', family: 'face-inter', use: 'Everything, tabular figures on anything that changes' }],
    palette: [
      { name: 'Canvas', hex: '#FCFCFD' },
      { name: 'Ink', hex: '#16161A' },
      { name: 'Indigo', hex: '#5854D6' },
      { name: 'Tempo', hex: '#F59E0B' },
      { name: 'Live', hex: '#148054' },
    ],
    theme: {
      scheme: 'light',
      ground: '#F4F4F7',
      surface: '#FFFFFF',
      ink: '#16161A',
      muted: '#5A5C68',
      rule: '#E0E0E7',
      accent: '#5854D6',
      accentText: '#4844BE',
      onAccent: '#FFFFFF',
    },
    main: {
      src: lifeLight,
      alt: 'LifeUI Today screen: a running activity called Write report with a large 23:07 timer, quick-start chips, the day plan grouped by time blocks, and a log of completed activities with tempos earned.',
    },
    second: {
      kind: 'screen',
      src: lifeDark,
      alt: 'The same LifeUI Today screen in the dark theme.',
    },
    callouts: [
      { x: 21, y: 15.5, text: 'Only one activity runs at a time, with its progress against the estimate.' },
      { x: 73.6, y: 12.4, text: 'Tempos today, shown as a share of your reference: an anchor, never a debt.' },
      { x: 26.2, y: 44, text: 'Quick start for pinned activities. Everything has a keyboard shortcut and a command palette.' },
    ],
    strip: [
      { src: lifeClosing, alt: 'LifeUI closing ritual dialog asking how satisfied you are from 0 to 10, with the reward preview of +60 tempos.', caption: 'Closing ritual' },
      { src: lifeReview, alt: 'LifeUI review screen with the day timeline, time by activity type and a table of closed activities.', caption: 'Review' },
      { src: lifeLibrary, alt: 'LifeUI library of reusable activities with their type, duration rules and history.', caption: 'Library' },
    ],
  },
  {
    id: 'playsync',
    name: 'PlaySync',
    face: 'face-bricolage',
    index: 'Synced YouTube watch parties, no accounts',
    indexStack: 'React 19, Node, WebSockets',
    tagline: 'Same video, same second, from two different time zones. Create a room, share a code, and watch together while you chat.',
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
    typefaces: [
      { name: 'Bricolage Grotesque', family: 'face-bricolage', use: 'Display' },
      { name: 'Figtree', family: 'face-figtree', use: 'Interface' },
    ],
    palette: [
      { name: 'Midnight', hex: '#0F0B10' },
      { name: 'Raised', hex: '#1F1822' },
      { name: 'Apricot glow', hex: '#FFB08A' },
      { name: 'Rose', hex: '#FF8497' },
      { name: 'Mint', hex: '#7FDCAE' },
      { name: 'Ink', hex: '#F7EEE9' },
    ],
    note: 'Interface in Spanish',
    theme: {
      scheme: 'dark',
      ground: '#0F0B10',
      surface: '#161118',
      ink: '#F7EEE9',
      muted: '#B9A9AB',
      rule: '#2A2130',
      accent: '#FFB08A',
      accentText: '#FFC6A8',
      onAccent: '#2B130C',
    },
    main: {
      src: psRoom,
      alt: 'PlaySync room on desktop: Big Buck Bunny playing at 0:13 in a large player, with the room code, a Watching together status chip, and a chat between Felix and Sofi.',
    },
    second: {
      kind: 'phone',
      src: psMobile,
      alt: 'The same PlaySync room on a phone, as a guest: the video at 0:14, a view-only notice with a button to request control, and the chat.',
    },
    callouts: [
      { x: 77.2, y: 3.2, text: 'Live presence: who is here, and whether the room is watching together.' },
      { x: 25.8, y: 3.2, text: 'The room code: no accounts, just share it.' },
      { x: 71.6, y: 11, text: 'Chat, queue and people share one panel; on phones they become a bottom tab bar.' },
    ],
    strip: [
      { src: psSearch, alt: 'PlaySync YouTube search inside a room, showing a grid of Blender open movie results.', caption: 'Search without an API key' },
      { src: psLanding, alt: 'PlaySync landing page with the headline Mismo video, mismo segundo and a room creation form.', caption: 'Landing' },
    ],
  },
  {
    id: 'katarch',
    name: 'KatArch',
    face: 'face-inter',
    index: 'Software architecture, one decision at a time',
    indexStack: 'Astro, React islands, Motion',
    tagline: 'An interactive course that replays, decision by decision, how the winning team of O’Reilly’s first Architecture Kata designed their system.',
    live: 'https://katarch.vercel.app/',
    source: 'https://github.com/Felichz/katarch',
    role: 'Solo: research, writing, design and frontend',
    stack: ['Astro', 'React islands', 'TypeScript', 'Motion', 'Hand-written CSS', 'Vercel'],
    scale: ['66 commits', '6 chapters, ~80 steps', '49 animated diagram scenes', '39 source documents'],
    story: [
      'I wanted to learn software architecture from a real case instead of a textbook, so I turned the winning solution of O’Reilly’s Fall 2020 Architecture Kata into a course. One idea per screen, in the order the team actually made each decision, with every claim linked to their original repository.',
      'One rule shaped everything: no concept, diagram or ADR appears before the problem that motivated it. The diagrams assemble step by step, and some of them are small working simulations you can poke at.',
    ],
    highlights: [
      {
        title: 'Diagrams that morph instead of reloading',
        body: 'Chapters are typed lists of steps. When consecutive steps share a scene, the same React component stays mounted and only its state changes, so the diagram builds up in place.',
      },
      {
        title: 'A small SVG animation kit',
        body: 'Spring-animated nodes, edges that draw themselves, message packets that travel along paths, and a fixed color legend for commands, events, stateful components and failures.',
      },
      {
        title: 'Readable without the visuals',
        body: 'Keyboard and swipe navigation, a deep link per step, an aria-live announcer, reduced-motion fallbacks and a text version of every diagram. Each page ships only the concepts its chapter uses.',
      },
    ],
    typefaces: [
      { name: 'Inter', family: 'face-inter', use: 'Interface and reading' },
      { name: 'JetBrains Mono', family: 'face-jetbrains', use: 'Labels and timings' },
    ],
    palette: [
      { name: 'Night', hex: '#0B0E13' },
      { name: 'Surface', hex: '#11161D' },
      { name: 'Ember', hex: '#FF7A45' },
      { name: 'Command', hex: '#6EA2FF' },
      { name: 'Event', hex: '#3FD694' },
      { name: 'Stateful', hex: '#B69BFF' },
    ],
    note: 'Interface in Spanish',
    theme: {
      scheme: 'dark',
      ground: '#0B0E13',
      surface: '#11161D',
      ink: '#E8ECF2',
      muted: '#AAB3C2',
      rule: '#242D3A',
      accent: '#FF7A45',
      accentText: '#FF9366',
      onAccent: '#1A0D06',
    },
    main: {
      src: kaUndo,
      alt: 'KatArch step 12 of chapter 6: text explaining a 30-second undo window on the left, and a running simulator on the right where an order is held in memory at 10 of 30 seconds before reaching the payment gateway.',
    },
    second: {
      kind: 'phone',
      src: kaMobile,
      alt: 'KatArch on a phone: the same simulator stacked above the explanation, with previous and next buttons at the bottom.',
    },
    callouts: [
      { x: 78.3, y: 35.4, text: 'A working simulation: the order waits in memory while the window runs, at four times real speed.' },
      { x: 72.8, y: 9.2, text: 'Every diagram has a text version and a link to the team’s original artifact.' },
      { x: 37.4, y: 96.1, text: 'Step by step, with keyboard, swipe and a deep link for each step.' },
    ],
    strip: [
      { src: kaActor, alt: 'KatArch diagram of one actor per fridge, with client queues routed to separate actors.', caption: 'One actor per fridge' },
      { src: kaPin, alt: 'KatArch offline PIN pickup simulator with a working keypad.', caption: 'Offline PIN simulator' },
      { src: kaHub, alt: 'KatArch course hub with the chapter map grouped by phase.', caption: 'Course map' },
    ],
  },
];
