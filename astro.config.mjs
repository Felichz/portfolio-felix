// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://portfolio-felix-teal.vercel.app',
  devToolbar: { enabled: false },
  image: {
    // Screenshots are captured at 2x; let Astro emit AVIF/WebP at several widths.
    responsiveStyles: false,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
