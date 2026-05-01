/* Service Worker — Mini Kripta
   En desarrollo: pass-through total, sin caché
   Cambiar CACHE_VERSION para forzar actualización
*/
const CACHE_VERSION = 'mini-kripta-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Sin caché — siempre red */
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
