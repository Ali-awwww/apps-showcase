/* Service worker for apps-showcase.pages.dev.
   Only caches same-origin static assets (hashed Vite bundles, CSS, images).
   Navigations and /api/* calls always go to the network so release data
   and the app shell stay fresh. */
const CACHE = 'apps-showcase-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache navigations or API calls: releases must stay live.
  if (req.mode === 'navigate' || url.pathname.startsWith('/api/')) return;
  // Cache-first for static assets only.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
        return hit || fetchPromise;
      })
    )
  );
});
