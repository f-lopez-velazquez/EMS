self.addEventListener('install', e => {
  e.waitUntil(caches.open('ems-cache').then(cache => cache.addAll([
    '.', 'index.html', 'styles.css', 'app.js'
  ])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});