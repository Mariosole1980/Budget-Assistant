// SW Version 1703
const CACHE_VERSION = 'v' + Date.now();
const CACHE_NAME = 'money-manager-v1703-' + Date.now();
const ASSETS = [
  'index.html',
  'splash.html',
  'style.css',
  'desktop.css',
  'logo-mark.png',
  'manifest.json',
  'icon.png',
  'xlsx.full.min.js',
  'js/fontawesome.min.css',
  'js/webfonts/poppins-bold.woff2',
  'js/webfonts/inter-medium.woff2',
  'js/webfonts/fa-solid-900.woff2',
  'js/webfonts/fa-solid-900.ttf',
  'js/webfonts/fa-regular-400.woff2',
  'js/webfonts/fa-regular-400.ttf',
  'js/webfonts/fa-brands-400.woff2',
  'js/webfonts/fa-brands-400.ttf',
  'js/supabase.js',
  'js/chart.js',
  'js/chartjs-plugin-datalabels.js',
  'js/sortable.min.js',
  'js/NLPProcessor.js',
  'js/MemoryEngine.js',
  'js/DecisionEngine.js',
  'js/OnlineAIProvider.js',
  'js/AIEngine.js',
  'js/IntentCorpus.js',
  'js/KnowledgeGraph.js',
  'js/CurrencyService.js',
  'js/transactionMerge.js',
  'js/utils.js',
  'js/constants.js',
  'js/categoryIcons.js',
  'js/translations.js',
  'js/receiptStorage.js',
  'js/transactionSorting.js',
  'js/recurringMappers.js',
  'js/importParsers.js',
  'js/recurringDates.js',
  'js/calcKeypad.js',
  'js/PremiumService.js',
  'js/SafeToSpendEngine.js',
  'js/SubscriptionEngine.js',
  'js/safeToSpendView.js',
  'js/userGuide.js',
  'js/exportService.js',
  'js/timePicker.js',
  'js/dialogService.js',
  'js/dropdownFilterService.js',
  'js/searchFilterService.js',
  'js/autocompleteService.js',
  'js/notesService.js',
  'js/notificationHub.js',
  'js/monthGridPicker.js',
  'js/aiCoachService.js',
  'js/onboardingWizard.js',
  'js/trashBinService.js',
  'js/importService.js',
  'js/financialHealthEngine.js',
  'js/categoryManager.js',
  'js/securityLockService.js',
  'js/securityPinService.js',
  'js/authControllerService.js',
  'js/partnerSyncService.js',
  'js/statsView.js',
  'js/accountsView.js',
  'js/accountManagerService.js',
  'js/notificationCenter.js',
  'js/feedbackReviewService.js',
  'js/gestureEngine.js',
  'js/voiceAssistantService.js',
  'js/billingService.js',
  'js/adminDashboardService.js',
  'js/selectionService.js',
  'js/customDatePicker.js',
  'js/subcategoryManager.js',
  'js/receiptService.js',
  'js/settingsSubscreenManager.js',
  'js/themeEngine.js',
  'js/userProfileService.js',
  'js/currencyPickerView.js',
  'js/dangerZoneService.js',
  'js/currencyFormattingService.js',
  'js/authOverlayService.js',
  'js/categoryPickerView.js',
  'js/highExpenseAlertService.js',
  'js/offlineImportService.js',
  'js/syncQueueService.js',
  'js/accountPickerView.js',
  'js/appLifecycleService.js',
  'js/supabaseRealtimeService.js',
  'js/transactionModalService.js',
  'js/authService.js',
  'js/transactionScopeService.js',
  'js/splashLifecycleService.js',
  'js/dataIntegrityService.js',
  'js/statsDateService.js',
  'js/categoryHelperService.js',
  'js/i18nService.js',
  'js/tabNavigationService.js',
  'js/modalBackdropService.js',
  'js/transactionListService.js',
  'js/premiumEntitlementService.js',
  'js/statsPeriodService.js',
  'js/calculatorKeypadService.js',
  'js/swipeNavigationService.js',
  'js/appUpdateService.js',
  'js/subcategorySuggestionService.js',
  'js/dataLoaderService.js',
  'js/transactionMutationService.js',
  'js/recurringModalService.js',
  'js/recurringTemplateModalService.js',
  'js/renderOrchestrationService.js',
  'js/templateAssociationService.js',
  'js/eventBindingService.js',
  'js/appInitService.js',
  'js/hapticFeedbackService.js',
  'js/cashFlowCalendarService.js',
  'app.js',
  'web-ui.js'
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

    // Live version manifest: ALWAYS network, NEVER cache (ensures live OTA / web version checks).
  if (path.endsWith('/version.json')) {
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
          return caches.match('index.html').then(function (indexResponse) {
            return indexResponse || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
          });
        }
        return caches.match(e.request, { ignoreSearch: true }).then(function (cachedResponse) {
          return cachedResponse || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
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
        // Navigation: fall back to the cached app shell. If even that is
        // missing, return a real Response so respondWith() never receives
        // undefined (which throws a TypeError in the browser).
        if (e.request.mode === 'navigate' || path === '/' || path === '' || path.endsWith('/index.html')) {
          return caches.match('index.html').then(function (indexResponse) {
            return indexResponse || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
          });
        }
        // Non-navigation asset with no cached copy: return a real 503 Response
        // instead of undefined.
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    })
  );
});
