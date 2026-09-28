// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://anderssonfelix.com',
  devToolbar: { enabled: false },
  image: {
    // Screenshots are captured at 2x; let Astro emit AVIF/WebP at several widths.
    responsiveStyles: false,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
