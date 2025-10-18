const CACHE_NAME = 'ems-cache-v37';
const toCache = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app-check.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(toCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Dejar pasar todo lo que no sea GET
  if (req.method !== 'GET') return;

  // NO interceptar Firestore/Cloudinary - dejar pasar directamente
  const bypassHosts = [
    'firestore.googleapis.com',
    'res.cloudinary.com',
    'api.cloudinary.com',
    'googleapis.com',
    'gstatic.com'
  ];

  if (bypassHosts.some(h => url.hostname.includes(h))) {
    // No usar event.respondWith - dejar que el navegador maneje directamente
    return;
  }

  // Navegación: network-first, fallback a cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put('./', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets same-origin: cache-first con actualización pasiva
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(networkResp => {
          if (networkResp && networkResp.ok) {
            const clone = networkResp.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return networkResp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
