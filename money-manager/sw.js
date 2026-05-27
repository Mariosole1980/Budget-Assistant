const CACHE_NAME = 'money-manager-v128';
const ASSETS = [
  'index.html',
  'privacy.html',
  'style.css?v=75',
  'app.js?v=128',
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

// Fetch Interception — Network-first for app files, cache as fallback for offline
self.addEventListener('fetch', (e) => {
  // Bypass caching for Supabase API requests to ensure real-time data sync
  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase.net')) {
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
