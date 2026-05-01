/* Service Worker — Mini Kripta PWA v2
   Estrategia: Network First — siempre intenta la red, caché solo como fallback
   Así los cambios se ven inmediatamente sin necesidad de limpiar caché manualmente
*/
const CACHE   = 'mini-kripta-v2';
const OFFLINE = ['/index.html', '/login.html', '/css/styles.css'];

/* Instalar: precargar solo lo mínimo */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(OFFLINE))
      .then(() => self.skipWaiting())
  );
});

/* Activar: limpiar cachés viejos */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Fetch: Network First para todo */
self.addEventListener('fetch', e => {
  /* API calls — solo network, nunca caché */
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  /* Imágenes de héroes (GitHub raw) — caché first para no recargar */
  if (e.request.url.includes('raw.githubusercontent.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  /* Todo lo demás — Network First */
  e.respondWith(
    fetch(e.request)
      .then(res => {
        /* Guardar en caché solo respuestas válidas */
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
