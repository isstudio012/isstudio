const CACHE_NAME = 'wildflower-tarot-v1';
const urlsToCache = [
  '/deulgukwa_tarot_fixed.html',
  '/192.jpg',
  '/512.jpg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
