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

  var GREEK_BANKS = [
    {
      id: 'nbg',
      name: 'National Bank of Greece',
      displayName: 'Εθνική Τράπεζα (NBG)',
      color: '#004f80',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'eurobank',
      name: 'Eurobank',
      displayName: 'Eurobank',
      color: '#d6001c',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'alpha',
      name: 'Alpha Bank',
      displayName: 'Alpha Bank',
      color: '#002663',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'piraeus',
      name: 'Piraeus Bank',
      displayName: 'Τράπεζα Πειραιώς',
      color: '#d49b00',
      icon: 'fa-solid fa-building-columns',
      badge: 'Ελλάδα'
    },
    {
      id: 'revolut',
      name: 'Revolut',
      displayName: 'Revolut',
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

  /**
   * Check for redirect callback from bank OAuth on application load or deep link
   */
  async function checkForAuthCallback(customUrl) {
    if (typeof window === 'undefined') return;

    var urlString = customUrl || (window.location ? window.location.href : '');
    var searchStr = '';
    var qIdx = urlString.indexOf('?');
    if (qIdx !== -1) {
      var hIdx = urlString.indexOf('#', qIdx);
      searchStr = hIdx !== -1 ? urlString.substring(qIdx, hIdx) : urlString.substring(qIdx);
    } else if (window.location && window.location.search) {
      searchStr = window.location.search;
    }

    var urlParams = new URLSearchParams(searchStr);
    var code = urlParams.get('code') || urlParams.get('mock_auth_code');
    var stateParam = urlParams.get('state');
    var isCallback = urlParams.get('bank_auth_callback') || urlParams.get('bank_auth') || urlParams.get('bank') || code;

    // If no URL params, check if we have a pending callback stored from a previous load
    if (!code && !isCallback) {
      try {
        var pending = localStorage.getItem('ob_pending_callback');
        if (pending) {
          var parsed = JSON.parse(pending);
          if (Date.now() - parsed.timestamp < 300000) {
            code = parsed.code;
            stateParam = parsed.state;
            isCallback = true;
          } else {
            localStorage.removeItem('ob_pending_callback');
          }
        }
      } catch (e) { /* ignore */ }
      if (!code && !isCallback) return;
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
        throw new Error(data.error || 'Αποτυχία σύνδεσης');
      }

      notify('Η τράπεζα συνδέθηκε επιτυχώς! Γίνεται αυτόματος συγχρονισμός...', 'success');

      // Refresh app data so new accounts and balances appear immediately
      try {
        if (window.dataLoaderService && typeof window.dataLoaderService.loadAllData === 'function') {
          await window.dataLoaderService.loadAllData();
        }
        if (typeof window.renderAll === 'function') window.renderAll();
        if (typeof window.renderAccountsTab === 'function') window.renderAccountsTab();
      } catch (e) {
        console.warn('[OpenBanking] Error refreshing local app data:', e);
      }

      // Trigger transaction sync
      await syncTransactions({ silent: false });

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
      '<a href="budgetassistant://bank-callback?success=true" style="display:inline-block; background:#38bdf8; color:#0f172a; font-weight:700; padding:10px 20px; border-radius:10px; text-decoration:none; font-size:14px; box-shadow:0 4px 12px rgba(56,189,248,0.3);">' +
        'Άνοιγμα στην Εφαρμογή' +
      '</a>' +
      '<div style="margin-top:10px;"><button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#64748b; font-size:12px; cursor:pointer;">Κλείσιμο</button></div>'
    );

    document.body.appendChild(banner);

    // Try auto-opening custom scheme
    try {
      window.location.href = 'budgetassistant://bank-callback?success=true';
    } catch (_) {}
  }

  /**
   * Start bank connection OAuth flow
   */
  async function startConnection(bankName) {
    var token = await getAuthToken();
    if (!token) {
      notify('Απαιτείται σύνδεση στο Budget Assistant.', 'warning');
      return;
    }

    notify('Επικοινωνία με την τράπεζα...', 'info');

    try {
      var redirectUrl = 'https://www.budgetassistant.org/index.html';
      var res = await fetch(getApiUrl('/api/bank-auth'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          bankName: bankName,
          country: 'GR',
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

        // Save bank name so callback can use it (URL params may not include it)
        try {
          localStorage.setItem('ob_auth_bank', bankName);
        } catch (e) { /* ignore */ }

        // Redirect user to the secure Bank portal for SCA
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          // In Android native app, use Capacitor Browser plugin if available
          // so it opens an in-app browser that redirects back to the app
          if (window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
            window.Capacitor.Plugins.Browser.open({ url: data.url });
          } else {
            // Fallback: open in system browser — deep link will bring user back
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

      if (!opts.silent) {
        if (count > 0) {
          notify('Συγχρονίστηκαν ' + count + ' νέες τραπεζικές κινήσεις!', 'success');
        } else {
          notify('Όλες οι τραπεζικές κινήσεις είναι ενημερωμένες.', 'info');
        }
      }

      // Refresh app data if loader exists
      if (count > 0) {
        if (window.dataLoaderService && typeof window.dataLoaderService.loadAllData === 'function') {
          await window.dataLoaderService.loadAllData();
        } else if (typeof window.fetchTransactionsFromSupabase === 'function') {
          await window.fetchTransactionsFromSupabase();
        } else if (typeof window.renderAll === 'function') {
          window.renderAll();
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
    try {
      connections = await getConnectedBanks();
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
                  '<div style="width:36px; height:36px; border-radius:8px; background:var(--primary, #38bdf8); display:flex; align-items:center; justify-content:center; color:#0f172a; font-size:16px;">' +
                    '<i class="fa-solid fa-check"></i>' +
                  '</div>' +
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

    var banksHtml = GREEK_BANKS.map(function (bank) {
      return (
        '<div class="bank-card-item" onclick="OpenBankingService.startConnection(\'' + bank.name + '\')" ' +
        'style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; margin-bottom:8px; ' +
        'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; cursor:pointer; ' +
        'transition:all 0.2s ease;" ' +
        'onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'; this.style.borderColor=\'var(--primary, #38bdf8)\';" ' +
        'onmouseout="this.style.background=\'rgba(255,255,255,0.04)\'; this.style.borderColor=\'rgba(255,255,255,0.08)\';">' +
          '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div style="width:38px; height:38px; border-radius:10px; background:' + bank.color + '; display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px;">' +
              '<i class="' + bank.icon + '"></i>' +
            '</div>' +
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

        '<div style="background:rgba(56, 189, 248, 0.08); border-left:3px solid var(--primary, #38bdf8); padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:12px; color:var(--text-secondary, #cbd5e1); line-height:1.4;">' +
          'Η σύνδεση γίνεται απευθείας στο ασφαλές e-banking της τράπεζάς σας. Η εφαρμογή έχει πρόσβαση <strong>μόνο για ανάγνωση</strong> κινήσεων και υπολοίπου.' +
        '</div>' +

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
      document.addEventListener('DOMContentLoaded', checkForAuthCallback);
    } else {
      setTimeout(checkForAuthCallback, 500);
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
    disconnectBank: disconnectBank
  };
});
