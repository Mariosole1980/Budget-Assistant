// SW Version 91
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = 'money-manager-' + CACHE_VERSION;
const ASSETS = [
  'index.html',
  'privacy.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icon.png',
  'xlsx.full.min.js'
];

// Install Service Worker - cache assets then force activation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches, claim all clients, notify them to refresh
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Notify all open clients that a new version is available
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
        });
      });
    })
  );
});

// Listen for SKIP_WAITING from page
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch - Network-first for all app files, cache fallback for offline
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase.net')) {
    return;
  }

  const reqUrl = new URL(e.request.url);
  const path = reqUrl.pathname;

  // Critical app shell files: always network-first, no cache on fetch
  if (
    path.endsWith('/sw.js') ||
    path.endsWith('/index.html') ||
    path.endsWith('/app.js') ||
    path.endsWith('/style.css') ||
    path.endsWith('/manifest.json')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('index.html');
        return caches.match(e.request);
      })
    );
    return;
  }

  // Other assets: network-first, update cache in background
  e.respondWith(
    fetch(e.request).then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (e.request.mode === 'navigate') return caches.match('index.html');
      });
    })
  );
});
