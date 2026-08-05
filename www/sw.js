// SW Version 1092
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = 'money-manager-v1087-' + Date.now();
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.png',
  'xlsx.full.min.js',
  'js/supabase.js',
  'js/chart.js',
  'js/chartjs-plugin-datalabels.js',
  'js/NLPProcessor.js',
  'js/MemoryEngine.js',
  'js/DecisionEngine.js',
  'js/OnlineAIProvider.js',
  'js/AIEngine.js',
  'js/IntentCorpus.js',
  'js/KnowledgeGraph.js',
  'js/CurrencyService.js',
  'js/fontawesome.min.css',
  'js/webfonts/fa-solid-900.woff2',
  'js/webfonts/fa-solid-900.ttf',
  'js/webfonts/fa-regular-400.woff2',
  'js/webfonts/fa-regular-400.ttf',
  'js/webfonts/fa-brands-400.woff2',
  'js/webfonts/fa-brands-400.ttf'
];

// Install Service Worker - cache assets then force activation
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = ASSETS.map(asset => {
        const request = new Request(asset, { cache: 'reload' });
        return fetch(request).then(response => {
          if (!response.ok) {
            throw new Error(`Request for ${asset} failed with status ${response.status}`);
          }
          return cache.put(asset, response);
        });
      });
      return Promise.all(cachePromises);
    }).then(() => {
      return self.skipWaiting();
    })
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
  if (e.request.method !== 'GET') {
    return;
  }

  if (e.request.url.includes('supabase.co') || e.request.url.includes('supabase.net')) {
    return;
  }

  const reqUrl = new URL(e.request.url);
  const path = reqUrl.pathname;

  // OTA-managed assets (app.js, style.css, version.json): ALWAYS network, NEVER cache.
  // The OTA engine fetches these with cache-busting query strings and validates them.
  // Serving them from the SW cache can return stale/invalid content and break OTA updates.
  if (
    path.endsWith('/app.js') ||
    path.endsWith('/style.css') ||
    path.endsWith('/version.json')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Critical app shell files: always network-first, cache fallback only for navigation
  if (
    path.endsWith('/sw.js') ||
    path.endsWith('/index.html') ||
    path.endsWith('/manifest.json') ||
    path.endsWith('/clear.html') ||
    path === '/' ||
    path === ''
  ) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Only use cache fallback for navigation (not for clear.html)
        if (path.endsWith('/clear.html')) return new Response('', { status: 503 });
        if (e.request.mode === 'navigate' || path === '/' || path === '' || path.endsWith('/index.html')) {
          return caches.match('index.html');
        }
        return caches.match(e.request, { ignoreSearch: true });
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
      return caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (e.request.mode === 'navigate' || path === '/' || path === '' || path.endsWith('/index.html')) {
          return caches.match('index.html');
        }
      });
    })
  );
});
