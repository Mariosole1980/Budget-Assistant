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
   * Check for redirect callback from bank OAuth on application load
   */
  async function checkForAuthCallback() {
    if (typeof window === 'undefined') return;

    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get('code') || urlParams.get('mock_auth_code');
    var isCallback = urlParams.get('bank_auth_callback') || urlParams.get('bank_auth') || code;

    // If no URL params, check if we have a pending callback stored from a previous load
    if (!code && !isCallback) {
      try {
        var pending = localStorage.getItem('ob_pending_callback');
        if (pending) {
          var parsed = JSON.parse(pending);
          // Only retry within 5 minutes
          if (Date.now() - parsed.timestamp < 300000) {
            code = parsed.code;
            isCallback = true;
          } else {
            localStorage.removeItem('ob_pending_callback');
          }
        }
      } catch (e) { /* ignore */ }
      if (!code && !isCallback) return;
    }

    var bankName = urlParams.get('bank') || '';
    // Retrieve saved bank name from auth initiation if not in URL
    if (!bankName) {
      try { bankName = localStorage.getItem('ob_auth_bank') || ''; } catch (e) { /* ignore */ }
    }
    if (!bankName) bankName = 'Τραπεζικός Λογαριασμός';

    // Clean URL query parameters to avoid re-triggering on refresh
    if (window.location.search) {
      var cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    var token = await getAuthToken();
    if (!token) {
      // Store callback data so it can be retried after login
      try {
        localStorage.setItem('ob_pending_callback', JSON.stringify({
          code: code,
          bankName: bankName,
          timestamp: Date.now()
        }));
      } catch (e) { /* ignore */ }
      notify('Παρακαλούμε συνδεθείτε στο λογαριασμό σας για ολοκλήρωση της σύνδεσης.', 'warning');
      return;
    }

    // Clear pending since we have a token now
    try { localStorage.removeItem('ob_pending_callback'); } catch (e) { /* ignore */ }

    notify('Ολοκλήρωση σύνδεσης με την τράπεζα...', 'info');

    try {
      var res = await fetch(getApiUrl('/api/bank-callback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          code: code || 'auth_completed',
          bankName: bankName
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

      // Trigger immediate sync of transactions
      await syncTransactions({ silent: false });

    } catch (err) {
      console.error('[OpenBanking] Callback error:', err);
      notify('Σφάλμα σύνδεσης τράπεζας: ' + (err.message || 'Δοκιμάστε ξανά'), 'error');
    }
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
   * UI: Open modal to pick a Greek Bank
   */
  function openConnectModal() {
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

    var banksHtml = GREEK_BANKS.map(function (bank) {
      return (
        '<div class="bank-card-item" onclick="OpenBankingService.startConnection(\'' + bank.name + '\')" ' +
        'style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; margin-bottom:10px; ' +
        'background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; cursor:pointer; ' +
        'transition:all 0.2s ease;" ' +
        'onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'; this.style.borderColor=\'var(--primary, #38bdf8)\';" ' +
        'onmouseout="this.style.background=\'rgba(255,255,255,0.04)\'; this.style.borderColor=\'rgba(255,255,255,0.08)\';">' +
          '<div style="display:flex; align-items:center; gap:14px;">' +
            '<div style="width:42px; height:42px; border-radius:10px; background:' + bank.color + '; display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px;">' +
              '<i class="' + bank.icon + '"></i>' +
            '</div>' +
            '<div>' +
              '<div style="font-weight:700; font-size:15px; color:var(--text-primary, #fff);">' + bank.displayName + '</div>' +
              '<div style="font-size:12px; color:var(--text-muted, #94a3b8);">' + bank.badge + ' • PSD2 Open Banking</div>' +
            '</div>' +
          '</div>' +
          '<div style="color:var(--text-muted, #94a3b8); font-size:14px;">' +
            '<i class="fa-solid fa-chevron-right"></i>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    modal.innerHTML = (
      '<div style="background:var(--bg-card, #1e293b); border:1px solid rgba(255,255,255,0.1); border-radius:20px; max-width:440px; width:100%; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.5); font-family:\'Outfit\',sans-serif; animation:modalPop 0.25s ease;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
          '<div style="display:flex; align-items:center; gap:10px;">' +
            '<div style="width:36px; height:36px; border-radius:10px; background:rgba(56, 189, 248, 0.15); display:flex; align-items:center; justify-content:center; color:var(--primary, #38bdf8); font-size:18px;">' +
              '<i class="fa-solid fa-shield-halved"></i>' +
            '</div>' +
            '<div>' +
              '<h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text-primary, #fff);">Σύνδεση με Τράπεζα</h3>' +
              '<p style="margin:2px 0 0; font-size:12px; color:var(--text-muted, #94a3b8);">Ασφαλής ανάγνωση κινήσεων (PSD2 AIS)</p>' +
            '</div>' +
          '</div>' +
          '<button onclick="OpenBankingService.closeConnectModal()" style="background:none; border:none; color:var(--text-muted, #94a3b8); font-size:18px; cursor:pointer; padding:6px;">' +
            '<i class="fa-solid fa-xmark"></i>' +
          '</button>' +
        '</div>' +

        '<div style="background:rgba(56, 189, 248, 0.08); border-left:3px solid var(--primary, #38bdf8); padding:10px 14px; border-radius:8px; margin-bottom:18px; font-size:12px; color:var(--text-secondary, #cbd5e1); line-height:1.4;">' +
          'Η σύνδεση γίνεται απευθείας στο ασφαλές e-banking της τράπεζάς σας. Η εφαρμογή έχει πρόσβαση <strong>μόνο για ανάγνωση</strong> κινήσεων και υπολοίπου.' +
        '</div>' +

        '<div style="max-height:340px; overflow-y:auto; margin-bottom:16px; padding-right:4px;">' +
          banksHtml +
        '</div>' +

        '<div style="text-align:center;">' +
          '<button onclick="OpenBankingService.closeConnectModal()" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary, #cbd5e1); font-weight:600; padding:10px 20px; border-radius:10px; width:100%; cursor:pointer;">' +
            'Ακύρωση' +
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
    checkForAuthCallback: checkForAuthCallback
  };
});
