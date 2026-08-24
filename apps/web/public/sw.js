// Basic Service Worker to satisfy PWA installation criteria
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We just let the browser handle all fetches normally.
  // The fetch listener is required by Chrome to show the "Install" prompt.
  return;
});
