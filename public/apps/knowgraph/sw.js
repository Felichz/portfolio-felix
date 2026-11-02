// The app that used to live here registered a service worker for /apps/knowgraph/. This one replaces
// it on the browser's next update check: it clears that app's caches, unregisters itself, and reloads
// the pages it controlled, so returning visitors get the video page instead of a cached old app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
