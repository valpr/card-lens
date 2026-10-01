const CACHE_NAME = 'cardlens-v11';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/ankiconnect.js',
  '/vendor/cropperjs/cropper.min.js',
  '/vendor/cropperjs/cropper.min.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for non-GET requests or backend API endpoints
  if (
    event.request.method !== 'GET' ||
    url.pathname === '/ocr' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/client-info' ||
    url.pathname === '/health' ||
    url.port === '8765'
  ) {
    return;
  }

  // Network-first strategy with cache: 'no-cache' to always check server for fresh code
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Default fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
