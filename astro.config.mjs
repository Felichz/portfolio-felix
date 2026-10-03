// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://portfolio-felix-teal.vercel.app',
  devToolbar: { enabled: false },
  // On one IPv4 address, so the local server answers as localhost and as 127.0.0.1: two sites, and
  // previews load their stages from the other one, in a process of their own (src/scripts/origin.ts).
  server: { host: '127.0.0.1' },
  image: {
    // Screenshots are captured at 2x; let Astro emit AVIF/WebP at several widths.
    responsiveStyles: false,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
