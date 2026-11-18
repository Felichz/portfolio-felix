/**
 * What each product's README shows: a few full-width panels, each one a screenshot in the portfolio's
 * window with a headline that says what you're looking at. Read by build.mjs.
 *
 * Shots are the portfolio's own (src/assets/shots/<name>-light|dark.webp); this site's are captured by
 * site-shots.mjs into scripts/readme/shots/. Copy follows the site's
 * rules: plain words, no em-dashes, only numbers the product's own page or README already states.
 *
 * A panel is a window (`shot`), one phone beside its text (`phone`), or a row of phones (`phones`).
 * `pins` are numbered marks on the shot (x, y in percent) with a legend under the window.
 */
export const products = [
  {
    id: 'katarch',
    repo: ['KatArch', 'katarch'],
    name: 'KatArch',
    face: 'inter',
    host: 'katarch.medanolabs.com',
    accent: { light: '#C2410C', dark: '#FF7A45' },
    panels: [
      {
        slug: 'course',
        title: 'Software architecture, from twelve winning designs',
        sub: 'A narrated video course built from what the winning teams of the Architecture Katas left in writing. 17 blocks, 73 minutes, Spanish and English.',
        shot: 'katarch-main',
        pins: [
          { x: 6.2, y: 27, text: 'Every diagram is animated to the narration, one idea at a time.' },
          { x: 97.3, y: 14.6, text: 'The transcript follows the voice. Any line jumps the video to it.' },
          { x: 86.2, y: 4.1, text: 'Spanish or English. Switching keeps your place in the block.' },
        ],
      },
      {
        slug: 'map',
        title: 'One map, two acts',
        sub: 'First, how a decision is made. Then the territory, one region per block, with the families of solutions that exist there.',
        shot: 'katarch-map',
      },
      {
        slug: 'captions',
        title: 'Captions drawn by the player',
        sub: 'Subtitles are not burned into the video. The player draws them from word timings and marks each word as it is spoken.',
        shot: 'katarch-playing',
      },
      {
        slug: 'phone',
        title: 'The same player on a phone',
        sub: 'The video on top with its captions, then the block’s title, its summary and what you take away.',
        phone: 'katarch-mobile',
      },
    ],
  },
  {
    id: 'knowgraph',
    repo: ['KnowGraph', 'learning'],
    name: 'KnowGraph',
    face: 'bricolage',
    host: 'knowgraph.medanolabs.com',
    accent: { light: '#1B6FA8', dark: '#3DB9EE' },
    panels: [
      {
        slug: 'map',
        title: 'Interview prep as a map of 142 concepts',
        sub: 'Senior React and Rails concepts, linked by what you need to understand first. The map picks one next step and says why.',
        shot: 'knowgraph-graph',
      },
      {
        slug: 'read',
        step: '01',
        title: 'Read the concept',
        sub: 'Each card shows where it fits, what it requires, what it unlocks and the interview questions it answers.',
        shot: 'knowgraph-card',
      },
      {
        slug: 'explain',
        step: '02',
        title: 'Explain it in your own words',
        sub: 'Typed or dictated, from memory. Then an AI grades it against a rubric, from 0 to 120.',
        shot: 'knowgraph-main',
        pins: [
          { x: 32.6, y: 17.6, text: 'Your explanation, as you would give it in an interview.' },
          { x: 96.6, y: 21, text: 'When you pause, a coach estimates the score and points at the next gap.' },
          { x: 96.6, y: 48.6, text: 'The card’s essential ideas, marked as you cover them.' },
        ],
      },
      {
        slug: 'review',
        step: '03',
        title: 'Review it on the day it is due',
        sub: 'Flashcards run on spaced repetition. Again, Hard, Good or Easy reschedules the card.',
        shot: 'knowgraph-review',
      },
    ],
  },
  {
    id: 'playsync',
    repo: ['PlaySync', 'rave2'],
    name: 'PlaySync',
    face: 'bricolage',
    host: 'playsync.medanolabs.com',
    accent: { light: '#C2562A', dark: '#FFB08A' },
    panels: [
      {
        slug: 'room',
        title: 'Same video. Same second.',
        sub: 'Create a room, share a code and watch YouTube together while you chat. No accounts.',
        shot: 'playsync-main',
        pins: [
          { x: 32.2, y: 4, text: 'The room code. Share it and the other person is in.' },
          { x: 69.3, y: 4, text: 'Who is here, and whether the room is watching together.' },
          { x: 63.4, y: 13.8, text: 'Chat, queue and people share one panel.' },
        ],
      },
      {
        slug: 'search',
        title: 'Pick the next one without leaving the room',
        sub: 'YouTube search inside the player, with no API key. What you add goes to a queue that plays one video after another.',
        shot: 'playsync-search',
      },
      {
        slug: 'guest',
        title: 'A guest, on a phone',
        sub: 'Guests watch in sync and can ask for control. Chat, queue and people become a tab bar at the bottom.',
        phone: 'playsync-mobile',
      },
      {
        slug: 'landing',
        title: 'A room in one step',
        sub: 'Type a name and create a room, or join with a code. It works in any browser and installs as an app.',
        shot: 'playsync-landing',
      },
    ],
  },
  {
    id: 'lifeui',
    repo: ['life-ui'],
    name: 'LifeUI',
    face: 'inter',
    host: 'lifeui.medanolabs.com',
    accent: { light: '#5854D6', dark: '#7C79F0' },
    panels: [
      {
        slug: 'coach',
        title: 'A coach for your day, in a chat',
        sub: 'Tell it what is going on. It looks things up, lays out a plan, and puts it on your calendar once you say yes.',
        shot: 'lifeui-coach',
        pins: [
          { x: 0.4, y: 3.6, text: 'What is running or what comes next, and the goal it works toward, above every screen.' },
          { x: 48.1, y: 80.4, text: 'Nothing changes without your yes: every change waits on a card.' },
          { x: 62, y: 23.6, text: 'The day as one line of time, from what you did to what is planned.' },
        ],
      },
      {
        slug: 'goals',
        title: 'A goal becomes sessions on your calendar',
        sub: 'A roadmap in phases. Each session says what to do, with the guide that shows how.',
        shot: 'lifeui-goals',
        pins: [
          { x: 62, y: 75.4, text: 'Progress counts only the sessions you really completed.' },
          { x: 86.4, y: 70.6, text: 'Every exercise links to the guide the coach found.' },
        ],
      },
      {
        slug: 'close',
        title: 'Did you complete it? That is all it asks',
        sub: 'Say it in the chat or tap Finish. A yes counts as a session of its goal.',
        shot: 'lifeui-closing',
        pins: [
          { x: 2.1, y: 3.5, text: 'The running session, its clock, and its progress along the bar’s edge.' },
          { x: 48.1, y: 80.4, text: 'The close waits for your yes too, and can be undone.' },
        ],
      },
      {
        slug: 'review',
        title: 'Look back to adjust, not to judge yourself',
        sub: 'What you completed each day, the day hour by hour, and time by activity type. No points, no streaks.',
        shot: 'lifeui-review',
      },
      {
        slug: 'phone',
        title: 'On a phone, the conversation is home',
        sub: 'The same bar on top with what is running. The day, your goals and the library are one tap away.',
        phone: 'lifeui-mobile',
      },
    ],
  },
  {
    id: 'lolimpact',
    repo: ['LoL-Impact', 'LoLImpact'],
    name: 'LoLImpact',
    face: 'martian',
    host: 'lolimpact.medanolabs.com',
    accent: { light: '#C81E1E', dark: '#E5484D' },
    panels: [
      {
        slug: 'match',
        title: 'Which lane decided your game',
        sub: 'A win-probability model for League of Legends. Each game opens with its conclusion, then your team’s chances minute by minute.',
        shot: 'lol-main',
        pins: [
          { x: 30.4, y: 30.6, text: 'Every game gets a short story, read from how its win chance moved.' },
          { x: 32.2, y: 44.4, text: 'The conclusion comes first: which lane decided it, in plain words.' },
          { x: 32.2, y: 73.2, text: 'The chart keeps the model’s margin of error in view as a grey band.' },
        ],
      },
      {
        slug: 'draft',
        title: 'Before the next one starts: who not to feed',
        sub: 'What a 1,000-gold lead on each champion is worth to their team, and the rival’s win condition.',
        shot: 'lol-draft',
      },
      {
        slug: 'phone',
        title: 'The conclusion first, on a phone too',
        sub: 'The same game: the lane that decided it, then the win chance by minute.',
        phone: 'lol-mobile',
      },
    ],
  },
  {
    id: 'bondiuy',
    repo: ['bondi-uy'],
    name: 'BondiUY',
    face: 'inter',
    host: 'bondiuy.medanolabs.com',
    accent: { light: '#C7361F', dark: '#FF6B57' },
    panels: [
      {
        slug: 'wait',
        title: 'The bus trip, one step at a time',
        sub: 'BondiUY plans a trip across Montevideo, follows the bus you are waiting for and tells you when to board and when to get off.',
        phone: 'bondiuy-main',
      },
      {
        slug: 'trip',
        title: 'From the map to your stop',
        sub: 'The demo replays trips recorded from the real network, so it needs no GPS and no server.',
        phones: [
          { shot: 'bondiuy-mobile', label: 'Pick where you’re going' },
          { shot: 'bondiuy-options', label: 'Choose a trip' },
          { shot: 'bondiuy-ride', label: 'Ride, and get off at the right stop' },
        ],
      },
    ],
  },
  {
    id: 'portfolio',
    // This repo: its shots are captured from the built site by site-shots.mjs.
    self: true,
    shots: 'scripts/readme/shots',
    name: 'Felix Andersson, portfolio',
    face: 'archivo',
    host: 'felix.medanolabs.com',
    accent: { light: '#0D7A5F', dark: '#5FD6B0' },
    panels: [
      {
        slug: 'work',
        title: 'A portfolio that runs its products',
        sub: 'Every preview is a recording of the real app. Under your pointer it becomes the app itself, in the same state, ready to click.',
        shot: 'portfolio-work',
        pins: [
          { x: 28.5, y: 31, text: 'Seven products take turns. The rail fills in each one’s color as its turn runs.' },
          { x: 37, y: 11.4, text: 'The green light opens the running app in a window over the page.' },
          { x: 90.6, y: 88.2, text: 'Each product has a case study, its live site and its source.' },
        ],
      },
      {
        slug: 'intro',
        title: 'One window, one section at a time',
        sub: 'The site works like a desktop app: a bar on top, section dots down the left edge, and each turn of the wheel moves one full section.',
        shot: 'portfolio-intro',
      },
      {
        slug: 'experience',
        title: 'The CV as a timeline',
        sub: 'Roles from 2020 to now on one continuous line, with the detail of the selected role and a few concrete examples.',
        shot: 'portfolio-experience',
      },
      {
        slug: 'case',
        title: 'One case study per product',
        sub: 'Five sections each: an overview with the product in its window, then the story, the engineering, the screens and the specs.',
        shot: 'portfolio-case',
      },
      {
        slug: 'phone',
        title: 'On a phone, the sections scroll',
        sub: 'The section dots become a tab bar at the bottom, and previews stay recordings.',
        phone: 'portfolio-mobile',
      },
    ],
  },
];
