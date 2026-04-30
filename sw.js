/* Service Worker — Mini Kripta PWA */
const CACHE = 'mini-kripta-v1';
const STATIC = [
  '/', '/index.html', '/login.html', '/hero-detail.html',
  '/hero-new.html', '/admin.html', '/profile.html',
  '/css/styles.css',
  '/js/auth.js', '/js/utils.js', '/js/heroes.js',
  '/js/index.js', '/js/login.js', '/js/hero-detail.js',
  '/js/hero-new.js', '/js/admin.js',
  '/img/logo_mini_kripta.png', '/img/logo-48.png',
  '/img/icon-192.png', '/img/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Nunito:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  /* API calls — siempre network first */
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  /* Resto — cache first, fallback network */
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
