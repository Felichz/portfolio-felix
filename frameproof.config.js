// frameproof's config. Detected: astro. Guide: npx -y github:Felichz/FrameProof guide config
export default {
  // How to build (null: the files are served as they are). Source maps give real names in every output:
  // set vite.build.sourcemap: true in astro.config.
  build: { command: 'npm run build', out: 'dist', env: { SOURCEMAP: '1' } },
  // 'static' serves the build's folder; { command, url } starts a server ({port} is filled in); { url } is a site already up.
  // On [::1]: the previews' stages load from this same origin and run in the page's process, as the
  // deployment does (no PUBLIC_STAGE_ORIGIN). On 127.0.0.1 they'd load from localhost, another site, in
  // a process of their own (src/scripts/origin.ts), which is not what visitors get.
  serve: { static: true, host: '::1' },
  // The page the scenarios start from.
  path: '/',
  scenarios: './perf/scenarios',
  budgets: './perf/budgets.js',
  // frameproof's default size: at 1600 x 960 on a Retina display the measuring window pushed the Mac's
  // GPU hard enough to hang the window server, more than once a day (perf/JOURNAL.md, 2026-11-08). The
  // scenarios park the pointer relative to the viewport (rest() in _hand.mjs).
  viewport: { width: 1280, height: 800 },
};
