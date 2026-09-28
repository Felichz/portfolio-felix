# Felix Andersson, portfolio

Single-page portfolio built with Astro, React islands and TypeScript. Static output, no runtime server.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check + static build into dist/
npm run preview  # serve dist/
```

## Where things live

- `src/data/projects.ts`: every product specimen (copy, stack, scale, palette, typefaces, screenshots, callout pins).
- `src/components/Experience.astro`: Cisco and Device Magic experience, the AI review pipeline diagram.
- `src/components/RowsDemo.tsx`: the live 100,000-row filtering demo (synthetic data, progressive vs blocking).
- `src/components/Hero.astro`: first viewport with the product tabs; the right panel repaints to each product's palette.
- `src/styles/global.css`: house tokens (Archivo, ink on white) and the `--s-*` surface variables each section overrides.
- `src/assets/shots/`: screenshots (WebP, captured at 2x). Astro emits AVIF/WebP at several widths.
- `public/`: fonts (latin subsets), résumé PDF, favicon, `og.png` share image.

## Updating a screenshot

Replace the file in `src/assets/shots/` with a 1440x900 capture at 2x (2880x1800) and keep the same name. If the layout of that screen changed, adjust the callout pin coordinates (`x`, `y` in percent) in `projects.ts`.

## Deploy

Any static host works. On Vercel: import the repo, framework preset Astro, no extra settings.

Design context lives in `PRODUCT.md` (audience, voice rules, evidence) and `DESIGN.md` (the visual system).
