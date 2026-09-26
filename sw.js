// Reseau d'abord (les mises a jour arrivent tout de suite), cache sinon : l'appli
// s'ouvre sans reseau et la liaison avec le boitier marche quand meme.
// Les tuiles de carte ne sont pas gardees (trop lourdes).
const CACHE = 'meshcaching';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || (url.origin !== location.origin && url.host !== 'cdn.jsdelivr.net')) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
