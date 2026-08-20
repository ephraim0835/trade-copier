const CACHE_NAME = 'plaiz-copier-static-v1';

// We ONLY cache Next.js static assets safely generated during build.
// Everything else (API, RSC payloads, SSE, pages) is strictly network-only.
const isStaticAsset = (url) => {
  return url.pathname.startsWith('/_next/static/') || 
         url.pathname.startsWith('/_next/image/') ||
         url.pathname.match(/\.(woff|woff2|png|svg|jpg|ico)$/i);
};

// Install event - no pre-caching required for our minimal setup.
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('plaiz-copier-static-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - The core of our secure caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. STRICTLY BYPASS FOR SENSITIVE ROUTES (API, SSE, Auth)
  if (
    url.pathname.startsWith('/api/') || 
    event.request.headers.get('accept')?.includes('text/event-stream') || 
    url.searchParams.has('_rsc') // React Server Components payloads
  ) {
    return; // Let the browser handle it completely natively (Network-Only)
  }

  // 2. CACHE STATIC ASSETS ONLY (Cache First, fallback to Network)
  if (event.request.method === 'GET' && isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('SW static fetch failed', err);
          throw err;
        });
      })
    );
    return;
  }

  // 3. FALLBACK FOR EVERYTHING ELSE (HTML pages, dynamic content) -> Network-Only
  // We do not cache HTML pages because the dashboard state must always be live.
  event.respondWith(fetch(event.request));
});
