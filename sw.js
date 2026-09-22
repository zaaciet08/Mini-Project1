/**
 * Service Worker: VKU Field Survey PWA
 * Strategy: Cache-First for static assets, Network-First with cache fallback for documents
 * Provides 100% offline-first capability for campus facilities survey with zero connectivity.
 */

const CACHE_NAME = 'vku-survey-v1.0.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './js/db.js',
  './js/camera.js',
  './js/geo.js',
  './js/sync.js',
  './js/ui.js',
  './js/app.js',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  './assets/icons/icon-maskable-192x192.png',
  './assets/icons/icon-maskable-512x512.png',
  './assets/icons/favicon.png',
  './assets/icons/icon.svg'
];

// Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing VKU Field Survey Service Worker...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for offline usage');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    }).catch((err) => {
      console.error('[SW] Cache addAll failed:', err);
    })
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Offline-first routing
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests or chrome-extension URLs
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Navigation requests (HTML): Network-First, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Fonts, Images): Cache-First, fallback to Network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately; optionally revalidate in background
        fetch(request).then((freshResponse) => {
          if (freshResponse && freshResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, freshResponse));
          }
        }).catch(() => {
          // Offline, cached version served safely
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Fetch failed offline for:', request.url);
        // Fallback for image requests
        if (request.destination === 'image') {
          return caches.match('./assets/icons/icon.svg');
        }
        throw err;
      });
    })
  );
});

// Background Sync Event (Triggered when connectivity returns)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered with tag:', event.tag);
  if (event.tag === 'sync-inspections') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'TRIGGER_BACKGROUND_SYNC'
          });
        });
      })
    );
  }
});

// Message Event: Communication from UI
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
