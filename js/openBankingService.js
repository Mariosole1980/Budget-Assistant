/**
 * openBankingService.js
 *
 * Open Banking (PSD2) Client Service for Budget Assistant.
 * Integrates direct bank connection and transaction synchronization for:
 * - National Bank of Greece (Εθνική Τράπεζα)
 * - Eurobank
 * - Alpha Bank
 * - Piraeus Bank (Τράπεζα Πειραιώς)
 * - Revolut
 *
 * Handles:
 * 1. Bank connection initiation & OAuth SCA redirect
 * 2. OAuth callback capture & session registration
 * 3. On-demand & background bank transaction sync with deduplication
 * 4. UI modal for Greek bank selection
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
    root.OpenBankingService = exports;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Built-in fallback catalogue. `name` must stay byte-identical to the name
  // Enable Banking publishes on GET /aspsps, because that exact string is what
  // POST /auth accepts; `country` matters just as much (Revolut is registered
  // under GB, not GR) and used to be hardcoded to GR for every bank.
  var GREEK_BANKS = [
    {
      id: 'nbg',
      name: 'National Bank of Greece',
      displayName: 'Εθνική Τράπεζα (NBG)',
      country: 'GR',
      color: '#004f80',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'eurobank',
      name: 'Eurobank',
      displayName: 'Eurobank',
      country: 'GR',
      color: '#d6001c',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'alpha',
      name: 'Alpha Bank',
      displayName: 'Alpha Bank',
      country: 'GR',
      color: '#002663',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'piraeus',
      name: 'Piraeus Bank',
      displayName: 'Τράπεζα Πειραιώς',
      country: 'GR',
      color: '#d49b00',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'revolut',
      name: 'Revolut',
      displayName: 'Revolut',
      country: 'GB',
      color: '#0075eb',
      icon: 'fa-solid fa-credit-card',
      badge: 'EU / Digital'
    }
  ];

  function getApiUrl(endpoint) {
    var cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (typeof window !== 'undefined' && typeof window.getBackendApiUrl === 'function') {
      return window.getBackendApiUrl(cleanEndpoint);
    }
    var isCapacitorOrLocal = (typeof window !== 'undefined' && typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      (typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ));
    var base = isCapacitorOrLocal ? 'https://www.budgetassistant.org' : '';
    return base + cleanEndpoint;
  }

  // ── Bank logos (live from the provider, never bundled) ────────────────────
  // The logo shown for every bank is the one published by the bank-data provider
  // (Enable Banking) through /api/bank-institutions, so it is always the current
  // official artwork instead of a locally stored/outdated copy. The name → URL
  // mapping is cached (12h) so repeat openings are instant and offline-safe.
  var INSTITUTIONS_CACHE_KEY = 'ba_bank_institutions_logos_v2';
  var INSTITUTIONS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
  var _logoCache = null;   // { at: number, map: { normalizedName: logoUrl }, list: Array }
  var _logoPromise = null;
  // normalizedName → ISO country of the provider's ASPSP entry. /api/bank-auth
  // needs it because a bank's country is part of its identity (Revolut = GB).
  var _institutionCountries = {};

  function normalizeBankName(name) {
    var raw = String(name == null ? '' : name);
    try {
      raw = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (_) { /* very old engines: keep raw */ }
    return raw.toLowerCase().replace(/[^a-z0-9\u0370-\u03ff]+/g, '');
  }

  function isSafeLogoUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    // Only https images: blocks javascript:, data: and mixed-content sources.
    return /^https:\/\/[^\s"'<>]+$/i.test(url);
  }

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * The provider serves brand images with `Cache-Control: immutable, max-age=1y`,
   * so a bare URL could keep an outdated logo pinned in the browser cache for a
   * year. A monthly tag makes the browser re-check the artwork at most once a
   * month per bank (the provider's own route ignores the extra param).
   */
  function withLogoTtl(url) {
    if (!isSafeLogoUrl(url)) return '';
    var now = new Date();
    var month = now.getUTCMonth() + 1;
    var tag = now.getUTCFullYear() + '-' + (month < 10 ? '0' + month : String(month));
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + tag;
  }

  function readLogoCache() {
    if (_logoCache) return _logoCache;
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(INSTITUTIONS_CACHE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.map && typeof parsed.at === 'number') {
            _logoCache = parsed;
          }
        }
      }
    } catch (_) { /* corrupt cache: ignore */ }
    return _logoCache;
  }

  function writeLogoCache(entry) {
    _logoCache = entry;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(INSTITUTIONS_CACHE_KEY, JSON.stringify(entry));
      }
    } catch (_) { /* private mode / quota: cache stays in memory */ }
  }

  /**
   * Fetch the current provider logo URL for every bank (ASPSP).
   * @returns {Promise<Object<string,string>>} normalized bank name → official logo URL
   */
  async function getInstitutionLogos() {
    var cached = readLogoCache();
    if (cached && (Date.now() - cached.at) < INSTITUTIONS_CACHE_TTL) {
      // Warm the country map even on a cache hit (e.g. after an app restart).
      if (Array.isArray(cached.list)) indexInstitutionCountries(cached.list);
      return cached.map;
    }
    if (_logoPromise) return _logoPromise;

    _logoPromise = (async function () {
      try {
        var res = await fetch(getApiUrl('/api/bank-institutions'), {
          headers: { 'Accept': 'application/json' }
        });
        if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'n/a'));
        var data = await res.json();
        var institutions = (data && data.institutions) || [];
        var map = {};
        institutions.forEach(function (inst) {
          if (!inst || !inst.name || !isSafeLogoUrl(inst.logo)) return;
          var key = normalizeBankName(inst.name);
          var versioned = withLogoTtl(inst.logo);
          if (key && versioned) map[key] = versioned;
        });
        indexInstitutionCountries(institutions);
        writeLogoCache({ at: Date.now(), map: map, list: institutions });
        return map;
      } catch (e) {
        console.warn('[OpenBanking] Could not load bank logos from provider:', e && e.message ? e.message : e);
        // Serve the last known good mapping instead of showing nothing.
        return cached ? cached.map : {};
      } finally {
        _logoPromise = null;
      }
    })();

    return _logoPromise;
  }

  /**
   * The provider's live ASPSP catalogue (names, countries, logos, consent
   * ceilings). The connect modal uses it so the bank the user taps is exactly
   * the one POST /auth will be asked for — a name/country mismatch is rejected
   * by Enable Banking with HTTP 422.
   * @returns {Promise<Array>} empty array when the catalogue is unavailable
   */
  async function getInstitutions() {
    var cached = readLogoCache();
    if (cached && Array.isArray(cached.list) && (Date.now() - cached.at) < INSTITUTIONS_CACHE_TTL) {
      indexInstitutionCountries(cached.list);
      return cached.list;
    }

    await getInstitutionLogos();
    cached = readLogoCache();
    var list = cached && Array.isArray(cached.list) ? cached.list : [];
    indexInstitutionCountries(list);
    return list;
  }

  function indexInstitutionCountries(list) {
    var map = {};
    (list || []).forEach(function (inst) {
      if (!inst || !inst.name) return;
      var key = normalizeBankName(inst.name);
      if (!key) return;
      map[key] = String(inst.country || '').toUpperCase();
    });
    if (Object.keys(map).length > 0) _institutionCountries = map;
    return map;
  }

  /** Country the provider publishes for a bank (falls back to the registry). */
  function resolveBankCountry(bankName) {
    var key = normalizeBankName(bankName);
    if (key && _institutionCountries[key]) return _institutionCountries[key];
    var registryBank = findRegistryBank(bankName);
    return (registryBank && registryBank.country) || 'GR';
  }

  function findRegistryBank(bankName) {
    var key = normalizeBankName(bankName);
    if (!key) return null;
    for (var i = 0; i < GREEK_BANKS.length; i++) {
      var bank = GREEK_BANKS[i];
      if (normalizeBankName(bank.name) === key || normalizeBankName(bank.displayName) === key) {
        return bank;
      }
    }
    return null;
  }

  /**
   * Resolve the provider logo URL for a bank name (connection name or ASPSP name).
   * @param {string} name
   * @param {Object<string,string>} [map] optional pre-fetched map
   * @returns {string} logo URL or '' when unknown/unsafe
   */
  function resolveBankLogo(name, map) {
    var logos = (map && typeof map === 'object') ? map : (function () {
      var cache = readLogoCache();
      return cache && cache.map ? cache.map : {};
    })();

    var key = normalizeBankName(name);
    if (!key) return '';
    if (isSafeLogoUrl(logos[key])) return logos[key];

    // Loose match: a connection may store "ALPHA BANK S.A." while the provider
    // lists "Alpha Bank" (or vice versa), so compare normalized substrings.
    var keys = Object.keys(logos);
    for (var i = 0; i < keys.length; i++) {
      var candidate = keys[i];
      if (!candidate || candidate === key) continue;
      if (key.indexOf(candidate) !== -1 || candidate.indexOf(key) !== -1) {
        if (isSafeLogoUrl(logos[candidate])) return logos[candidate];
      }
    }
    return '';
  }

  /**
   * Render a bank logo tile. The official logo sits on a light tile (provider
   * artwork is transparent, sometimes dark), with the brand icon as placeholder
   * while the image loads and as fallback when it cannot be fetched (offline).
   */
  function bankLogoHtml(opts) {
    var o = opts || {};
    var size = o.size || 38;
    var radius = o.radius || 10;
    var icon = o.icon || 'fa-solid fa-building-columns';
    var color = o.color || '#475569';
    var logo = isSafeLogoUrl(o.logo) ? o.logo : '';

    var tileStyle = 'position:relative; width:' + size + 'px; height:' + size + 'px; ' +
      'border-radius:' + radius + 'px; overflow:hidden; background:#fff; ' +
      'display:flex; align-items:center; justify-content:center;';

    var placeholder = '<span aria-hidden="true" style="position:absolute; inset:0; display:flex; ' +
      'align-items:center; justify-content:center; background:#fff; color:' + escapeAttr(color) + '; ' +
      'font-size:' + Math.round(size * 0.42) + 'px;">' +
      '<i class="' + escapeAttr(icon) + '"></i>' +
      '</span>';

    var tile;
    if (!logo) {
      tile = '<div style="' + tileStyle + '">' + placeholder + '</div>';
    } else {
      tile = '<div style="' + tileStyle + '">' + placeholder +
        '<img src="' + escapeAttr(logo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" ' +
        'style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; ' +
        'padding:' + Math.max(3, Math.round(size * 0.1)) + 'px; box-sizing:border-box; background:#fff; ' +
        'opacity:0; transition:opacity 0.25s ease;" ' +
        'onload="this.style.opacity=\'1\';" ' +
        'onerror="this.style.display=\'none\';" />' +
        '</div>';
    }

    var badge = o.badge
      ? '<span aria-hidden="true" style="position:absolute; right:-3px; bottom:-3px; width:15px; height:15px; ' +
        'border-radius:50%; background:#22c55e; color:#0f172a; font-size:8px; line-height:1; display:flex; ' +
        'align-items:center; justify-content:center; border:2px solid var(--bg-card, #1e293b);">' +
        '<i class="fa-solid fa-check"></i></span>'
      : '';

    return '<div style="position:relative; flex:0 0 auto; display:inline-flex;">' + tile + badge + '</div>';
  }

  async function getAuthToken() {
    var appState = (typeof window !== 'undefined' && window.state) ? window.state : ((typeof state !== 'undefined') ? state : null);

    // 1. In-memory state session
    if (appState && appState.session && appState.session.access_token) {
      return appState.session.access_token;
    }

    // 2. Query Supabase client on state
    var client = (appState && appState.supabaseClient) || (typeof window !== 'undefined' && (window.supabaseClient || window.supabase));
    if (client && client.auth && typeof client.auth.getSession === 'function') {
      try {
        var sessRes = await client.auth.getSession();
        if (sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token) {
          if (appState) appState.session = sessRes.data.session;
          return sessRes.data.session.access_token;
        }
      } catch (e) {
        console.warn('[OpenBanking] Error in client.auth.getSession:', e);
      }
    }

    // 3. Direct localStorage scan for persisted Supabase tokens (Android WebView persistence)
    if (typeof localStorage !== 'undefined') {
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && ((k.startsWith('sb-') && k.endsWith('-auth-token')) || k === 'supabase.auth.token')) {
            var val = localStorage.getItem(k);
            if (val) {
              var parsed = JSON.parse(val);
              var rawSession = parsed.currentSession || parsed;
              if (rawSession && rawSession.access_token) {
                if (appState) appState.session = rawSession;
                return rawSession.access_token;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[OpenBanking] Error scanning localStorage for token:', err);
      }
    }

    return null;
  }

  function notify(msg, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type || 'info');
    } else if (typeof window.showAlert === 'function') {
      window.showAlert(msg, 'Open Banking');
    } else {
      console.log('[OpenBanking]', msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Pending connection bookkeeping
  //
  // The bank flow leaves the app (Custom Tab / external browser). If the deep
  // link back never arrives (or the installed build cannot parse it) the
  // connection is still completed server-side by the web bounce page, so the app
  // detects it as soon as it becomes visible again.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // PSU type (private vs business account)
  //
  // Enable Banking asks the ASPSP for the matching login flow. When the PSU type
  // does not match the account the bank either fails the SCA or returns an
  // account list without the user's accounts — which looks like a broken
  // connection for business customers.
  // ---------------------------------------------------------------------------
  var PSU_TYPE_KEY = 'ob_psu_type';

  function readPsuType() {
    try {
      return localStorage.getItem(PSU_TYPE_KEY) === 'business' ? 'business' : 'personal';
    } catch (e) {
      return 'personal';
    }
  }

  function setPsuType(value) {
    var next = value === 'business' ? 'business' : 'personal';
    try { localStorage.setItem(PSU_TYPE_KEY, next); } catch (e) { /* ignore */ }
    return next;
  }

  var AUTH_PENDING_KEY = 'ob_auth_pending';
  var AUTH_PENDING_TTL = 20 * 60 * 1000;
  var recoveryInFlight = false;
  var resumeListenersInstalled = false;

  function markAuthPending(bankName) {
    try {
      localStorage.setItem(AUTH_PENDING_KEY, JSON.stringify({
        bankName: bankName || '',
        timestamp: Date.now()
      }));
      localStorage.setItem('ob_auth_bank', bankName || '');
    } catch (e) { /* ignore */ }
  }

  function clearAuthPending() {
    try {
      localStorage.removeItem(AUTH_PENDING_KEY);
      localStorage.removeItem('ob_auth_bank');
    } catch (e) { /* ignore */ }
  }

  function readAuthPending() {
    try {
      var raw = localStorage.getItem(AUTH_PENDING_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.timestamp) return null;
      if (Date.now() - parsed.timestamp > AUTH_PENDING_TTL) {
        clearAuthPending();
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  async function isBankConnected(bankName) {
    try {
      var connections = await getConnectedBanks();
      if (!Array.isArray(connections) || connections.length === 0) return false;
      var wanted = String(bankName || '').toLowerCase().trim();
      // Placeholder names carry no useful information → any connection counts
      if (!wanted || wanted === 'τραπεζικός λογαριασμός') return true;
      return connections.some(function (conn) {
        var name = String(conn && conn.aspsp_name ? conn.aspsp_name : '').toLowerCase();
        if (!name) return false;
        return name.indexOf(wanted) !== -1 || wanted.indexOf(name) !== -1;
      });
    } catch (e) {
      return false;
    }
  }

  async function refreshAfterConnection() {
    notify('Η τράπεζα συνδέθηκε επιτυχώς! Γίνεται αυτόματος συγχρονισμός...', 'success');

    // Refresh app data so new accounts and balances appear immediately
    try {
      if (window.DataLoaderService && typeof window.DataLoaderService.loadData === 'function') {
        await window.DataLoaderService.loadData();
      } else if (typeof window.forceSyncNow === 'function') {
        await window.forceSyncNow(true);
      }
      if (typeof window.updateUI === 'function') window.updateUI();
      if (typeof window.renderAccountsTab === 'function') window.renderAccountsTab();
    } catch (e) {
      console.warn('[OpenBanking] Error refreshing local app data:', e);
    }

    // Trigger transaction sync
    await syncTransactions({ silent: false });
    clearAuthPending();
  }

  /**
   * Called when the app becomes visible again: if a bank connection was started
   * and the bank flow is already completed server-side, finish the flow locally.
   */
  async function recoverPendingConnection(trigger) {
    if (recoveryInFlight || typeof window === 'undefined') return;
    var pending = readAuthPending();
    if (!pending) return;

    var token = await getAuthToken();
    if (!token) return;

    recoveryInFlight = true;
    try {
      // Poll briefly: the browser's fire-and-forget callback POST may still be
      // in flight when the app regains focus.
      for (var attempt = 0; attempt < 3; attempt++) {
        await new Promise(function (resolve) { setTimeout(resolve, attempt === 0 ? 1200 : 1500); });

        if (await isBankConnected(pending.bankName)) {
          console.log('[OpenBanking] Bank connection completed while away (' + (trigger || 'resume') + ')');
          await refreshAfterConnection();
          return;
        }

        if (!readAuthPending()) return; // already handled elsewhere
      }
      console.log('[OpenBanking] No completed connection found yet (' + (trigger || 'resume') + ')');
    } catch (e) {
      console.warn('[OpenBanking] Pending connection recovery failed:', e);
    } finally {
      recoveryInFlight = false;
    }
  }

  var _lastAutoSyncTime = 0;
  var AUTO_SYNC_COOLDOWN_MS = 3 * 60 * 1000; // at most once every 3 minutes

  /**
   * Silently sync bank transactions on app resume / startup if the user has active connections.
   */
  async function maybeAutoSyncBankTransactions() {
    if (typeof window === 'undefined') return;
    var now = Date.now();
    if (now - _lastAutoSyncTime < AUTO_SYNC_COOLDOWN_MS) return;

    var token = await getAuthToken();
    if (!token) return;

    var banks = await getConnectedBanks();
    if (!Array.isArray(banks) || banks.length === 0) return;

    _lastAutoSyncTime = now;
    console.log('[OpenBanking] Auto-syncing bank transactions in background...');
    await syncTransactions({ silent: true });
  }

  function installResumeListeners() {
    if (resumeListenersInstalled || typeof window === 'undefined') return;
    resumeListenersInstalled = true;

    var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App &&
        typeof window.Capacitor.Plugins.App.addListener === 'function') {
      window.Capacitor.Plugins.App.addListener('appStateChange', function (state) {
        if (state && state.isActive) {
          recoverPendingConnection('app-resume');
          maybeAutoSyncBankTransactions();
        }
      });
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          recoverPendingConnection('visibility');
          maybeAutoSyncBankTransactions();
        }
      });
    }
  }

  /**
   * Check for redirect callback from bank OAuth on application load or deep link
   */
  async function checkForAuthCallback(customUrl) {
    if (typeof window === 'undefined') return;

    var urlString = customUrl || (window.location ? window.location.href : '');
    var searchStr = '';
    var hashStr = '';
    var qIdx = urlString.indexOf('?');
    var hIdx = urlString.indexOf('#');
    if (qIdx !== -1) {
      var qEnd = (hIdx !== -1 && hIdx > qIdx) ? hIdx : urlString.length;
      searchStr = urlString.substring(qIdx, qEnd);
    }
    if (hIdx !== -1) {
      hashStr = urlString.substring(hIdx);
    }
    if (!searchStr && !hashStr && window.location) {
      searchStr = window.location.search || '';
      hashStr = window.location.hash || '';
    }

    var urlParams = new URLSearchParams(searchStr);
    var hashParams = new URLSearchParams(hashStr.replace(/^#/, ''));
    var code = urlParams.get('code') || hashParams.get('code') || urlParams.get('mock_auth_code');
    var stateParam = urlParams.get('state') || hashParams.get('state');
    var successFlag = urlParams.get('success') === 'true' || hashParams.get('success') === 'true';
    // A Supabase PKCE login also returns `?code=`, so `code` alone is not proof
    // of a bank callback. The bank flow always carries the JSON `state` blob
    // produced by /api/bank-auth ({ userId, bankName, timestamp }).
    var hasBankState = false;
    if (stateParam) {
      try {
        var stateJson = JSON.parse(stateParam);
        hasBankState = !!(stateJson && stateJson.userId);
      } catch (e) {
        try {
          var decodedState = JSON.parse(decodeURIComponent(stateParam));
          hasBankState = !!(decodedState && decodedState.userId);
        } catch (e2) {
          hasBankState = false;
        }
      }
    }
    var isCallback = urlParams.get('bank_auth_callback') || urlParams.get('bank_auth') || urlParams.get('bank') ||
      (!!code && hasBankState);

    // Plain success signal (e.g. com.budgetassistant.app://bank-callback?success=true):
    // the connection was completed while the app was in the background.
    if (successFlag && !code) {
      await recoverPendingConnection('success-flag');
      return;
    }

    // A bare `code` without bank state/flags belongs to a Supabase PKCE login
    // (both flows return `?code=`), so it must NOT be sent to /api/bank-callback.
    // Only a stored pending callback from a previous load can still qualify.
    if (!isCallback) {
      if (!code) {
        try {
          var pending = localStorage.getItem('ob_pending_callback');
          if (pending) {
            var parsed = JSON.parse(pending);
            if (parsed && (Date.now() - parsed.timestamp) < 300000) {
              code = parsed.code;
              stateParam = parsed.state;
              isCallback = true;
            } else {
              localStorage.removeItem('ob_pending_callback');
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (!isCallback) return;
    }

    var bankName = urlParams.get('bank') || '';
    if (!bankName) {
      try { bankName = localStorage.getItem('ob_auth_bank') || ''; } catch (e) { /* ignore */ }
    }
    if (!bankName) bankName = 'Τραπεζικός Λογαριασμός';

    // Clean URL query parameters if on web to avoid re-triggering on refresh
    if (!customUrl && window.location && window.location.search) {
      try {
        var cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {}
    }

    var token = await getAuthToken();

    // If no token AND no state parameter, store and ask user to log in
    if (!token && !stateParam) {
      try {
        localStorage.setItem('ob_pending_callback', JSON.stringify({
          code: code,
          bankName: bankName,
          state: stateParam,
          timestamp: Date.now()
        }));
      } catch (e) { /* ignore */ }
      notify('Παρακαλούμε συνδεθείτε στο λογαριασμό σας για ολοκλήρωση της σύνδεσης.', 'warning');
      return;
    }

    try { localStorage.removeItem('ob_pending_callback'); } catch (e) { /* ignore */ }

    // Guard against duplicate deliveries of the same authorization code
    // (appUrlOpen + launch URL + browser bounce all point at the same callback).
    if (code && code !== 'auth_completed') {
      var alreadyProcessed = false;
      try {
        var processedRaw = localStorage.getItem('ob_processed_code');
        var processed = processedRaw ? JSON.parse(processedRaw) : null;
        if (processed && processed.code === code && (Date.now() - processed.at) < 10 * 60 * 1000) {
          alreadyProcessed = true;
        }
      } catch (e) { /* ignore */ }

      if (alreadyProcessed) {
        console.log('[OpenBanking] Callback code already processed, refreshing data instead');
        await refreshAfterConnection();
        return;
      }

      try {
        localStorage.setItem('ob_processed_code', JSON.stringify({ code: code, at: Date.now() }));
      } catch (e) { /* ignore */ }
    }

    notify('Ολοκλήρωση σύνδεσης με την τράπεζα...', 'info');

    try {
      var headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      var res = await fetch(getApiUrl('/api/bank-callback'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          code: code || 'auth_completed',
          bankName: bankName,
          state: stateParam || null
        })
      });

      var resText = await res.text();
      var data = {};
      try {
        data = JSON.parse(resText);
      } catch (_) {
        data = { error: resText.slice(0, 100) };
      }

      if (!res.ok) {
        // The connection may still have been created by another delivery of the
        // callback (web bounce page). Verify before reporting a failure.
        if (await isBankConnected(bankName)) {
          console.log('[OpenBanking] Callback reported an error but the bank is connected:', data.error);
          await refreshAfterConnection();
          return;
        }
        throw new Error(data.error || 'Αποτυχία σύνδεσης');
      }

      await refreshAfterConnection();

      if (data && data.warning === 'NO_ACCOUNTS_SELECTED') {
        notify('⚠️ ' + (data.message || 'Δεν επιλέχθηκε λογαριασμός κατά την έγκριση. Συνδεθείτε ξανά και επιλέξτε τον λογαριασμό σας.'), 'warning');
      }

      // If running on the web in an external browser (e.g. mobile Chrome), offer to return to the native app
      var isNativeApp = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      if (!isNativeApp && !customUrl) {
        showReturnToAppBanner();
      }

    } catch (err) {
      console.error('[OpenBanking] Callback error:', err);
      notify('Σφάλμα σύνδεσης τράπεζας: ' + (err.message || 'Δοκιμάστε ξανά'), 'error');
    }
  }

  function showReturnToAppBanner() {
    var banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '20px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.zIndex = '2147483647';
    banner.style.backgroundColor = '#1e293b';
    banner.style.border = '1px solid #38bdf8';
    banner.style.borderRadius = '16px';
    banner.style.padding = '18px 24px';
    banner.style.boxShadow = '0 20px 40px rgba(0,0,0,0.6)';
    banner.style.textAlign = 'center';
    banner.style.maxWidth = '90%';
    banner.style.width = '380px';
    banner.style.fontFamily = "'Outfit', sans-serif";

    banner.innerHTML = (
      '<div style="font-size:24px; margin-bottom:8px;">🎉</div>' +
      '<div style="font-size:16px; font-weight:700; color:#fff; margin-bottom:6px;">Η σύνδεση ολοκληρώθηκε!</div>' +
      '<div style="font-size:13px; color:#94a3b8; margin-bottom:16px;">Ο τραπεζικός σας λογαριασμός συνδέθηκε επιτυχώς.</div>' +
      '<a href="com.budgetassistant.app://bank-callback?success=true" style="display:inline-block; background:#38bdf8; color:#0f172a; font-weight:700; padding:10px 20px; border-radius:10px; text-decoration:none; font-size:14px; box-shadow:0 4px 12px rgba(56,189,248,0.3);">' +
        'Άνοιγμα στην Εφαρμογή' +
      '</a>' +
      '<div style="margin-top:10px;"><button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#64748b; font-size:12px; cursor:pointer;">Κλείσιμο</button></div>'
    );

    document.body.appendChild(banner);

    // Try auto-opening the native app (same scheme as the web bounce page)
    try {
      window.location.href = 'com.budgetassistant.app://bank-callback?success=true';
    } catch (_) {}
  }

  /**
   * Start bank connection OAuth flow
   */
  async function startConnection(bankName) {
    // Accepts a bank name (legacy callers / inline onclick) or the bank object
    // rendered by the modal (which also carries the provider's country).
    var bank = (bankName && typeof bankName === 'object') ? bankName : null;
    var name = String((bank && bank.name) || bankName || '').trim();
    if (!name) {
      notify('Δεν επιλέχθηκε τράπεζα.', 'warning');
      return;
    }

    var token = await getAuthToken();
    if (!token) {
      notify('Απαιτείται σύνδεση στο Budget Assistant.', 'warning');
      return;
    }

    notify('Επικοινωνία με την τράπεζα...', 'info');

    try {
      // Enable Banking requires an exactly registered redirect URL, so this stays
      // /index.html. Cloudflare Pages 308-redirects /index.html -> / with the query
      // string intact, and landing.html forwards any ?code=&state= payload to /app,
      // where the bank-callback bounce in index.html completes the connection.
      var redirectUrl = 'https://www.budgetassistant.org/index.html';
      var res = await fetch(getApiUrl('/api/bank-auth'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          bankName: name,
          // The provider identifies a bank by name + country; both are sent
          // explicitly (Revolut, for example, is published under GB).
          country: (bank && bank.country) || resolveBankCountry(name),
          psuType: readPsuType(),
          language: 'el',
          redirectUrl: redirectUrl
        })
      });

      var resText = await res.text();
      var data = {};
      try {
        data = JSON.parse(resText);
      } catch (_) {
        data = { error: resText.slice(0, 100) };
      }

      if (!res.ok) {
        throw new Error(data.error || 'Σφάλμα κατά την έναρξη σύνδεσης');
      }

      if (data && data.url) {
        // Close modal if open
        closeConnectModal();

        // Remember the bank and that an authorization is in flight, so that the
        // app can finish the flow when it comes back (even without a deep link).
        markAuthPending(name);
        installResumeListeners();

        // Redirect user to the secure Bank portal for SCA
        var isNativePlatform = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
        var preferExternal = false;
        try {
          preferExternal = localStorage.getItem('ob_prefer_system_browser') === 'true';
        } catch (_) {}

        if (isNativePlatform) {
          if (!preferExternal && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            if (typeof window.Capacitor.Plugins.Browser.addListener === 'function') {
              window.Capacitor.Plugins.Browser.addListener('browserFinished', function () {
                recoverPendingConnection('browser-finished');
              });
            }
            window.Capacitor.Plugins.Browser.open({ url: data.url });
          } else {
            // Open in system browser (Chrome/Samsung Internet) for direct App-to-App support
            window.open(data.url, '_system');
          }
        } else {
          window.location.href = data.url;
        }
      } else {
        throw new Error('Δεν ελήφθη έγκυρος σύνδεσμος τράπεζας.');
      }
    } catch (err) {
      console.error('[OpenBanking] Start auth error:', err);
      notify('Σφάλμα: ' + err.message, 'error');
    }
  }

  /**
   * Sync transactions from connected bank accounts
   */
  async function syncTransactions(options) {
    var opts = options || {};
    var token = await getAuthToken();
    if (!token) {
      if (!opts.silent) notify('Απαιτείται σύνδεση.', 'warning');
      return { ok: false, error: 'Unauthorized' };
    }

    if (!opts.silent) {
      notify('Συγχρονισμός τραπεζικών κινήσεων...', 'info');
    }

    try {
      var res = await fetch(getApiUrl('/api/bank-sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });

      var resText = await res.text();
      var data = {};
      try {
        data = JSON.parse(resText);
      } catch (_) {
        data = { error: resText.slice(0, 100) };
      }

      if (!res.ok) {
        throw new Error(data.error || 'Σφάλμα συγχρονισμού');
      }

      var count = data.syncedCount || 0;
      var bankErrors = Array.isArray(data.errors) ? data.errors : [];

      if (!opts.silent) {
        if (data && data.warning === 'NO_ACCOUNTS_SELECTED') {
          notify('⚠️ ' + (data.message || 'Δεν βρέθηκαν επιλεγμένοι λογαριασμοί. Αποσυνδέστε και επανασυνδέστε την τράπεζα.'), 'warning');
        } else if (count > 0) {
          notify('Συγχρονίστηκαν ' + count + ' νέες τραπεζικές κινήσεις!', 'success');
        } else if (bankErrors.length === 0) {
          notify('Όλες οι τραπεζικές κινήσεις είναι ενημερωμένες.', 'info');
        }
        if (bankErrors.length > 0) {
          // A failed account is almost always an expired or insufficient
          // consent: say so instead of pretending everything is up to date.
          notify('Κάποιοι τραπεζικοί λογαριασμοί δεν συγχρονίστηκαν. Δοκιμάστε αποσύνδεση και επανασύνδεση της τράπεζας.', 'warning');
        }
      }

      // Refresh app data so imported transactions & balances immediately appear in UI
      if (count > 0) {
        try {
          if (window.DataLoaderService && typeof window.DataLoaderService.loadData === 'function') {
            await window.DataLoaderService.loadData();
          } else if (typeof window.forceSyncNow === 'function') {
            await window.forceSyncNow(true);
          }
          if (typeof window.updateUI === 'function') {
            window.updateUI();
          }
          if (typeof window.renderAccountsTab === 'function') {
            window.renderAccountsTab();
          }
        } catch (uiErr) {
          console.warn('[OpenBanking] Error refreshing UI after sync:', uiErr);
        }
      }

      return { ok: true, syncedCount: count };
    } catch (err) {
      console.error('[OpenBanking] Sync error:', err);
      if (!opts.silent) notify('Σφάλμα συγχρονισμού: ' + err.message, 'error');
      return { ok: false, error: err.message };
    }
  }

  /**
   * Fetch connected banks for the current user
   */
  async function getConnectedBanks() {
    var token = await getAuthToken();
    if (!token) return [];
    try {
      var res = await fetch(getApiUrl('/api/bank-connections'), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return [];
      var data = await res.json();
      return data.connections || [];
    } catch (e) {
      console.warn('[OpenBanking] Error fetching connections:', e);
      return [];
    }
  }

  /**
   * Disconnect a bank connection
   */
  async function disconnectBank(connectionId, bankName) {
    if (!confirm('Είστε βέβαιοι ότι θέλετε να αποσυνδέσετε την τράπεζα ' + (bankName || '') + ';')) {
      return;
    }
    var token = await getAuthToken();
    if (!token) return;

    notify('Αποσύνδεση τράπεζας...', 'info');
    try {
      var res = await fetch(getApiUrl('/api/bank-connections?id=' + encodeURIComponent(connectionId)), {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Αποτυχία αποσύνδεσης');

      notify('Η τράπεζα αποσυνδέθηκε επιτυχώς.', 'success');

      // Refresh app data
      if (window.dataLoaderService && typeof window.dataLoaderService.loadAllData === 'function') {
        await window.dataLoaderService.loadAllData();
      }
      if (typeof window.renderAll === 'function') window.renderAll();
      if (typeof window.renderAccountsTab === 'function') window.renderAccountsTab();

      // Refresh modal
      openConnectModal();
    } catch (e) {
      console.error('[OpenBanking] Disconnect error:', e);
      notify('Σφάλμα: ' + e.message, 'error');
    }
  }

  function countryBadge(country) {
    var code = String(country || '').toUpperCase();
    if (code === 'GR') return 'Ελλάδα';
    if (code === 'GB') return 'Ην. Βασίλειο';
    if (code === 'CY') return 'Κύπρος';
    return code || 'ΕΕ';
  }

  /**
   * Merge the provider catalogue with the built-in registry: every provider
   * ASPSP is listed (including banks the app never hardcoded), and registry
   * banks missing from the catalogue are kept so a temporarily incomplete
   * response cannot hide e.g. Revolut.
   */
  function buildAvailableBanks(liveInstitutions) {
    var live = Array.isArray(liveInstitutions) ? liveInstitutions : [];
    var seen = {};
    var banks = [];

    live.forEach(function (inst) {
      var name = String((inst && inst.name) || '').trim();
      if (!name) return;
      var key = normalizeBankName(name);
      if (!key || seen[key]) return;
      seen[key] = true;
      var reg = findRegistryBank(name);
      var country = String((inst && inst.country) || (reg && reg.country) || 'GR').toUpperCase();
      banks.push({
        id: (reg && reg.id) || key,
        name: name,
        displayName: (reg && reg.displayName) || name,
        country: country,
        color: (reg && reg.color) || '#38bdf8',
        icon: (reg && reg.icon) || 'fa-solid fa-building-columns',
        badge: countryBadge(country)
      });
    });

    GREEK_BANKS.forEach(function (bank) {
      var key = normalizeBankName(bank.name);
      if (!key || seen[key]) return;
      seen[key] = true;
      banks.push({
        id: bank.id,
        name: bank.name,
        displayName: bank.displayName,
        country: bank.country,
        color: bank.color,
        icon: bank.icon,
        badge: bank.badge
      });
    });

    var order = {};
    GREEK_BANKS.forEach(function (bank, index) {
      order[normalizeBankName(bank.name)] = index;
    });

    banks.sort(function (a, b) {
      var aKey = normalizeBankName(a.name);
      var bKey = normalizeBankName(b.name);
      var aRank = Object.prototype.hasOwnProperty.call(order, aKey) ? order[aKey] : 999;
      var bRank = Object.prototype.hasOwnProperty.call(order, bKey) ? order[bKey] : 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.displayName.localeCompare(b.displayName, 'el');
    });

    return banks;
  }

  /**
   * UI: Open modal to manage / connect Greek Banks
   */
  async function openConnectModal() {
    var modalId = 'open-banking-modal';
    var modal = document.getElementById(modalId);

    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'custom-dialog-backdrop';
      modal.style.display = 'none';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.zIndex = '2147483640';
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      modal.style.backdropFilter = 'blur(6px)';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.padding = '16px';

      document.body.appendChild(modal);
    }

    var connections = [];
    var bankLogos = {};
    var availableBanks = GREEK_BANKS.slice();
    try {
      // The provider catalogue (names + countries + logos, cached 12h) is
      // fetched in parallel with the connections so opening the modal adds no
      // extra latency, and it guarantees every row matches an ASPSP /auth
      // accepts.
      var bootstrap = await Promise.all([
        getConnectedBanks().catch(function () { return []; }),
        getInstitutionLogos().catch(function () { return {}; }),
        getInstitutions().catch(function () { return []; })
      ]);
      connections = bootstrap[0] || [];
      bankLogos = bootstrap[1] || {};
      availableBanks = buildAvailableBanks(bootstrap[2]);
    } catch (_) {}

    var connectedHtml = '';
    if (connections.length > 0) {
      connectedHtml = (
        '<div style="margin-bottom:16px;">' +
          '<div style="font-size:12px; font-weight:700; color:var(--primary, #38bdf8); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">' +
            'Συνδεδεμενες Τραπεζες' +
          '</div>' +
          connections.map(function (c) {
            var accs = c.bank_accounts || [];
            var totalBal = accs.reduce(function (sum, a) { return sum + (parseFloat(a.balance) || 0); }, 0);
            var subtitle = accs.length > 0
              ? (accs.length === 1 ? '1 λογαριασμός' : accs.length + ' λογαριασμοί') + ' • Υπόλοιπο: ' + totalBal.toFixed(2) + ' €'
              : 'Ενεργή σύνδεση';

            return (
              '<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; margin-bottom:8px; ' +
              'background:rgba(56, 189, 248, 0.08); border:1px solid rgba(56, 189, 248, 0.25); border-radius:12px;">' +
                '<div style="display:flex; align-items:center; gap:12px;">' +
                  bankLogoHtml({ logo: resolveBankLogo(c.aspsp_name, bankLogos), size: 36, radius: 9, icon: 'fa-solid fa-check', color: '#16a34a', badge: true }) +
                  '<div>' +
                    '<div style="font-weight:700; font-size:14px; color:#fff;">' + (c.aspsp_name || 'Τράπεζα') + '</div>' +
                    '<div style="font-size:12px; color:#94a3b8;">' + subtitle + '</div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex; gap:6px;">' +
                  '<button type="button" onclick="OpenBankingService.syncTransactions()" title="Συγχρονισμός" ' +
                  'style="background:rgba(255,255,255,0.08); border:none; color:#38bdf8; width:32px; height:32px; border-radius:8px; cursor:pointer;">' +
                    '<i class="fa-solid fa-rotate"></i>' +
                  '</button>' +
                  '<button type="button" onclick="OpenBankingService.disconnectBank(\'' + c.id + '\', \'' + (c.aspsp_name || '') + '\')" title="Αποσύνδεση" ' +
                  'style="background:rgba(239,68,68,0.12); border:none; color:#ef4444; width:32px; height:32px; border-radius:8px; cursor:pointer;">' +
                    '<i class="fa-solid fa-trash-can"></i>' +
                  '</button>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>'
      );
    }

    var banksHtml = availableBanks.map(function (bank) {
      return (
        '<div class="bank-card-item" onclick="OpenBankingService.startConnection(\'' + bank.name + '\')" ' +
        'style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; margin-bottom:8px; ' +
        'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; cursor:pointer; ' +
        'transition:all 0.2s ease;" ' +
        'onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'; this.style.borderColor=\'var(--primary, #38bdf8)\';" ' +
        'onmouseout="this.style.background=\'rgba(255,255,255,0.04)\'; this.style.borderColor=\'rgba(255,255,255,0.08)\';">' +
          '<div style="display:flex; align-items:center; gap:12px;">' +
            bankLogoHtml({ logo: resolveBankLogo(bank.name, bankLogos), size: 38, radius: 10, icon: bank.icon, color: bank.color }) +
            '<div>' +
              '<div style="font-weight:700; font-size:14.5px; color:var(--text-primary, #fff);">' + bank.displayName + '</div>' +
              '<div style="font-size:11.5px; color:var(--text-muted, #94a3b8);">' + bank.badge + ' • PSD2 Open Banking</div>' +
            '</div>' +
          '</div>' +
          '<div style="color:var(--text-muted, #94a3b8); font-size:13px;">' +
            '<i class="fa-solid fa-chevron-right"></i>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    modal.innerHTML = (
      '<div style="background:var(--bg-card, #1e293b); border:1px solid rgba(255,255,255,0.1); border-radius:20px; max-width:440px; width:100%; padding:22px; box-shadow:0 20px 40px rgba(0,0,0,0.5); font-family:\'Outfit\',sans-serif; animation:modalPop 0.25s ease;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">' +
          '<div style="display:flex; align-items:center; gap:10px;">' +
            '<div style="width:36px; height:36px; border-radius:10px; background:rgba(56, 189, 248, 0.15); display:flex; align-items:center; justify-content:center; color:var(--primary, #38bdf8); font-size:18px;">' +
              '<i class="fa-solid fa-shield-halved"></i>' +
            '</div>' +
            '<div>' +
              '<h3 style="margin:0; font-size:17px; font-weight:700; color:var(--text-primary, #fff);">Σύνδεση Τραπεζών</h3>' +
              '<p style="margin:2px 0 0; font-size:11.5px; color:var(--text-muted, #94a3b8);">Ασφαλής ανάγνωση κινήσεων (PSD2 AIS)</p>' +
            '</div>' +
          '</div>' +
          '<button onclick="OpenBankingService.closeConnectModal()" style="background:none; border:none; color:var(--text-muted, #94a3b8); font-size:18px; cursor:pointer; padding:6px;">' +
            '<i class="fa-solid fa-xmark"></i>' +
          '</button>' +
        '</div>' +

        '<div style="background:rgba(56, 189, 248, 0.08); border-left:3px solid var(--primary, #38bdf8); padding:10px 14px; border-radius:8px; margin-bottom:12px; font-size:12px; color:var(--text-secondary, #cbd5e1); line-height:1.4;">' +
          'Η σύνδεση γίνεται απευθείας στο ασφαλές e-banking της τράπεζάς σας. Η εφαρμογή έχει πρόσβαση <strong>μόνο για ανάγνωση</strong> κινήσεων και υπολοίπου.' +
        '</div>' +

        '<div style="display:flex; background:rgba(0,0,0,0.3); border-radius:10px; padding:3px; margin-bottom:8px;">' +
          '<button type="button" onclick="OpenBankingService.setPsuType(\'personal\'); OpenBankingService.openConnectModal();" style="flex:1; border:none; padding:7px 4px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; ' + (readPsuType() === 'personal' ? 'background:var(--primary, #38bdf8); color:#0f172a;' : 'background:transparent; color:#94a3b8;') + '">' +
            '<i class="fa-solid fa-user" style="margin-right:5px;"></i>Ιδιώτης' +
          '</button>' +
          '<button type="button" onclick="OpenBankingService.setPsuType(\'business\'); OpenBankingService.openConnectModal();" style="flex:1; border:none; padding:7px 4px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; ' + (readPsuType() === 'business' ? 'background:var(--primary, #38bdf8); color:#0f172a;' : 'background:transparent; color:#94a3b8;') + '">' +
            '<i class="fa-solid fa-briefcase" style="margin-right:5px;"></i>Επιχείρηση' +
          '</button>' +
        '</div>' +

        '<div style="font-size:11px; color:#94a3b8; margin-bottom:12px; line-height:1.35; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px;">' +
          (readPsuType() === 'business'
            ? '<span>Σύνδεση με <strong>επαγγελματικό</strong> λογαριασμό (Business e-Banking).</span>'
            : '<span>Σύνδεση με <strong>προσωπικό</strong> λογαριασμό (Ιδιώτης). Για εταιρικό, επιλέξτε Σύνδεση με <strong>επαγγελματικό</strong> λογαριασμό παραπάνω.</span>') +
        '</div>' +

        '<div style="background:rgba(234, 179, 8, 0.08); border-left:3px solid #eab308; padding:8px 12px; border-radius:8px; margin-bottom:14px; font-size:11px; color:#fde047; line-height:1.45;">' +
          '<strong>💡 Οδηγίες Επιτυχούς Σύνδεσης:</strong><br>' +
          '• <strong>Ειδοποίηση Έγκρισης:</strong> Αν δεν εμφανιστεί άμεσα ειδοποίηση στο κινητό, πατήστε στη σελίδα της τράπεζας <em>«Αποστολή κωδικού με SMS (OTP)»</em> ή ανοίξτε απευθείας την εφαρμογή της τράπεζάς σας.<br>' +
          '• <strong>Επιλογή Λογαριασμών (Υποχρεωτικό):</strong> Στην οθόνη της τράπεζας, <u>τικάρετε το κουτάκι</u> δίπλα στον λογαριασμό ή την κάρτα σας πριν πατήσετε «Έγκριση»!' +
        '</div>' +

        (function() {
          var isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
          if (!isNative) return '';
          var preferExt = false;
          try { preferExt = localStorage.getItem('ob_prefer_system_browser') === 'true'; } catch (_) {}
          return '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px;">' +
            '<span style="font-size:11px; color:#cbd5e1;"><i class="fa-brands fa-chrome" style="margin-right:6px; color:#38bdf8;"></i>Άνοιγμα στο Chrome (προτείνεται για bank apps)</span>' +
            '<input type="checkbox" ' + (preferExt ? 'checked' : '') + ' onchange="try{localStorage.setItem(\'ob_prefer_system_browser\', this.checked ? \'true\' : \'false\');}catch(_){}" style="accent-color:#38bdf8; width:16px; height:16px; cursor:pointer;">' +
          '</div>';
        })() +

        '<div style="max-height:360px; overflow-y:auto; margin-bottom:16px; padding-right:4px;">' +
          connectedHtml +
          (connections.length > 0 ? '<div style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin:12px 0 8px;">Συνδεση Νεας Τραπεζας</div>' : '') +
          banksHtml +
        '</div>' +

        '<div style="text-align:center;">' +
          '<button onclick="OpenBankingService.closeConnectModal()" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary, #cbd5e1); font-weight:600; padding:10px 20px; border-radius:10px; width:100%; cursor:pointer;">' +
            'Κλείσιμο' +
          '</button>' +
        '</div>' +
      '</div>'
    );

    modal.style.display = 'flex';
  }

  function closeConnectModal() {
    var modal = document.getElementById('open-banking-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Auto-init on script load
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        installResumeListeners();
        checkForAuthCallback();
        setTimeout(maybeAutoSyncBankTransactions, 3500);
      });
    } else {
      setTimeout(function () {
        installResumeListeners();
        checkForAuthCallback();
        setTimeout(maybeAutoSyncBankTransactions, 3500);
      }, 500);
    }
  }

  return {
    supportedBanks: GREEK_BANKS,
    openConnectModal: openConnectModal,
    closeConnectModal: closeConnectModal,
    startConnection: startConnection,
    syncTransactions: syncTransactions,
    checkForAuthCallback: checkForAuthCallback,
    getConnectedBanks: getConnectedBanks,
    getInstitutionLogos: getInstitutionLogos,
    getInstitutions: getInstitutions,
    resolveBankCountry: resolveBankCountry,
    resolveBankLogo: resolveBankLogo,
    setPsuType: setPsuType,
    disconnectBank: disconnectBank,
    recoverPendingConnection: recoverPendingConnection,
    maybeAutoSyncBankTransactions: maybeAutoSyncBankTransactions
  };
});
