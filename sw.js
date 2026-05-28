const CACHE_NAME = 'money-manager-v131';
const ASSETS = [
  'index.html',
  'privacy.html',
  'style.css?v=78',
  'app.js?v=131',
  'manifest.json',
  'icon.png',
  'xlsx.full.min.js'
];


// Install Service Worker
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker & Clean Old Caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Allow the page to force immediate activation of a new SW
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Interception — Network-first for app files, cache as fallback for offline
self.addEventListener('fetch', (e) => {
  // Bypass caching for Supabase API requests to ensure real-time data sync
  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase.net')) {
    return;
  }

  // Never runtime-cache critical app shell files to avoid stale builds
  const reqUrl = new URL(e.request.url);
  const path = reqUrl.pathname;
  if (
    path.endsWith('/sw.js') ||
    path.endsWith('/index.html') ||
    path.endsWith('/app.js') ||
    path.endsWith('/style.css') ||
    path.endsWith('/manifest.json')
  ) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('index.html');
      return caches.match(e.request);
    }));
    return;
  }
  
  e.respondWith(
    fetch(e.request).then((networkResponse) => {
      // Got a fresh response — update the cache and return it
      if (networkResponse && networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Offline — fall back to cache
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (e.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
