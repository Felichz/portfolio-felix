/**
 * Where previews run: the origin of their stages (src/pages/stage.astro). A stage from another site
 * than the page gets its own process from the browser (site isolation), so a tape being built or an
 * app booting never holds up this page's main thread, and a stage that's hidden or off screen stops
 * rendering. A subdomain isn't enough (it's the same site); it has to be another registrable domain,
 * like a second *.vercel.app name of this same deployment, set as PUBLIC_STAGE_ORIGIN at build time.
 *
 * Locally, localhost and 127.0.0.1 are two sites, so the same server under its other name does it.
 * Without either, stages load from this origin and run in this page's process, as before.
 */
const configured = (import.meta.env.PUBLIC_STAGE_ORIGIN as string | undefined)?.replace(/\/$/, '');

export const STAGE_ORIGIN = (() => {
  // This site opened inside one of its own stages keeps its previews in that process.
  if (window !== window.top) return location.origin;
  if (configured && configured !== location.origin) return configured;
  const { protocol, hostname, port } = location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  return location.origin;
})();
