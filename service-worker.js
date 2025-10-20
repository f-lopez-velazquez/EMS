// SW v30 – versión simple y estable
const CACHE_NAME = 'ems-cache-v30';
const TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return; // no interceptar POST/PUT/etc

  // Bypass Firestore/Cloudinary y dominios googleapis/gstatic
  const bypassHosts = ['firestore.googleapis.com', 'res.cloudinary.com', 'api.cloudinary.com', 'googleapis.com', 'gstatic.com'];
  if (bypassHosts.some((h) => url.hostname.includes(h))) return;

  // Navegación: network-first con fallback a index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets same-origin: cache-first con actualización pasiva
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) {
              caches.open(CACHE_NAME).then((c) => c.put(req, resp.clone())).catch(() => {});
            }
            return resp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
