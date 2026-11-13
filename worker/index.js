// Runs only when no static asset matches the request (assets are served first).
// The embedded demos at /apps/lifeui/ and /apps/knowgraph/ are single-page apps with client-side
// routes: a deep link into one of them gets that app's index.html. Everything else is a 404.
const SPA_APPS = ['lifeui', 'knowgraph'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    for (const app of SPA_APPS) {
      const base = `/apps/${app}/`;
      if (url.pathname.startsWith(base)) {
        return env.ASSETS.fetch(new Request(new URL(base, url), request));
      }
    }
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
