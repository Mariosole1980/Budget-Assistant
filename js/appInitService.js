/**
 * appInitService.js
 *
 * Application Boot & Lifecycle Initialization Subsystem
 * Extracted from app.js (Phase 31B Architectural Modularization)
 *
 * Encapsulates:
 * - initApp(): Asynchronous bootstrap sequence (platform classes, viewports, i18n, auth, data loading, initial render, web UX hook)
 * - _bootApp(): Resilience boot wrapper with error boundary recovery trigger
 * - installAntiZoomGuard(): Guard preventing unwanted zoom during Android autofill
 * - installHalfInitWatchdog(): 6-second watchdog verifying successful boot completion
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.AppInitService = factory();
    if (typeof root.initApp === 'undefined') root.initApp = root.AppInitService.initApp;
    if (typeof root._bootApp === 'undefined') root._bootApp = root.AppInitService._bootApp;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isIOS = (typeof window !== 'undefined' && typeof window.isIOS !== 'undefined')
    ? window.isIOS
    : ((typeof navigator !== 'undefined') && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));

  const isAndroid = (typeof window !== 'undefined' && typeof window.isAndroid !== 'undefined')
    ? window.isAndroid
    : ((typeof navigator !== 'undefined') && /Android/i.test(navigator.userAgent));

  // Dynamic state accessor proxy
  const state = new Proxy({}, {
    get(target, prop) {
      const s = (typeof window !== 'undefined' && window.state)
        ? window.state
        : (typeof global !== 'undefined' && global.state
          ? global.state
          : (typeof getState === 'function' ? getState() : {}));
      return s ? s[prop] : undefined;
    },
    set(target, prop, val) {
      const s = (typeof window !== 'undefined' && window.state)
        ? window.state
        : (typeof global !== 'undefined' && global.state
          ? global.state
          : (typeof getState === 'function' ? getState() : {}));
      if (s) s[prop] = val;
      return true;
    }
  });

  async function initApp() {
  // NOTE: _appLoaded is intentionally NOT set to true here at the start.
  // It is set to true only AFTER initApp() completes successfully (see the
  // end of this function). This keeps the recovery-mode error handler in
  // index.html armed (it checks `!window._appLoaded`) so that if initApp()
  // throws partway through, the user is shown the Recovery overlay instead
  // of being left stuck in a half-initialized broken state (untranslated nav
  // labels, dead tab switching, frozen scroll) with no way out.
  if (window._startupTimeout) clearTimeout(window._startupTimeout);

  if (isAndroid) {
    document.body.classList.add('is-android');
  }
  if (isIOS) {
    document.body.classList.add('is-ios');

    // Global focusout listener to reset layout viewport panning when any input blurs on iOS
    document.addEventListener('focusout', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only reset if focus didn't immediately move to another input/textarea/select
        setTimeout(() => {
          const activeEl = document.activeElement;
          const isAnotherInputFocused = activeEl &&
            (activeEl.tagName === 'INPUT' ||
              activeEl.tagName === 'TEXTAREA' ||
              activeEl.tagName === 'SELECT');
          if (!isAnotherInputFocused) {
            forceViewportReset();
          }
        }, 100);
      }
    });
  }

  // ============================================================
  // FORCE CLOSE ALL MODALS - runs on every load type
  // iOS Safari bfcache: DOMContentLoaded does NOT re-fire on
  // back/forward navigation or OAuth redirects. 'pageshow' does.
  // ============================================================
  function forceCloseAllModals() {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('left');
    document.body.style.removeProperty('width');
    document.body.style.removeProperty('height');
    document.querySelectorAll('.modal-overlay, .tx-modal-overlay').forEach(function (m) {
      m.classList.remove('active');
    });
    // Also reset any inline display:flex on modals
    const txModal = document.getElementById('transaction-modal');
    if (txModal && txModal.style.display === 'flex') txModal.style.display = '';
  }
  // Expose globally so auth handler can call it too
  window.forceCloseAllModals = forceCloseAllModals;

  // Run immediately on DOM ready
  forceCloseAllModals();

  // Set initial scroll isolation class for default trans tab
  document.body.classList.add('trans-tab-active');
  loadConfig();
  initSettingsFromStorage();

  // FIX (overlay placement): Self-heal any full-screen overlay that is nested
  // inside .app-container (position:relative + overflow:hidden) by moving it
  // directly under <body>. This prevents the auth-overlay-style "trapped modal"
  // bug from recurring on any overlay. Must run early, before any overlay shows.
  if (typeof initOverlayPlacement === 'function') {
    initOverlayPlacement();
  }
  // FIX #1: Start the auto-lock inactivity timer (if enabled). This must run
  // AFTER initSettingsFromStorage() so the stored delay is already loaded.
  if (typeof _initAutoLock === 'function') {
    _initAutoLock();
  }
  initMultiCurrency();
  if (typeof loadNotifications === 'function') {
    loadNotifications();
  } else if (typeof window !== 'undefined' && typeof window.loadNotifications === 'function') {
    window.loadNotifications();
  }
  if (typeof initLocalNotifications === 'function') {
    initLocalNotifications();
  } else if (typeof window !== 'undefined' && typeof window.initLocalNotifications === 'function') {
    window.initLocalNotifications();
  }
  initSupabase();
  setupEventListeners();
  if (typeof initPullToRefresh === 'function') {
    initPullToRefresh();
  } else if (typeof window !== 'undefined' && typeof window.initPullToRefresh === 'function') {
    window.initPullToRefresh();
  }
  if (typeof initSwipeToBack === 'function') {
    initSwipeToBack();
  } else if (typeof window !== 'undefined' && typeof window.initSwipeToBack === 'function') {
    window.initSwipeToBack();
  }
  initTabSwipeNavigation();
  resetAllTabScreenStyles();
  initRippleEffects();
  if (typeof initLightboxPinchZoom === 'function') {
    initLightboxPinchZoom();
  } else if (typeof window !== 'undefined' && typeof window.initLightboxPinchZoom === 'function') {
    window.initLightboxPinchZoom();
  }

  // ALWAYS load cached local data immediately so the UI is never blank on refresh.
  // If Supabase is enabled, onAuthStateChange will call loadData() again with fresh cloud data.
  //
  // Self-healing migration for tombstone reconciliation / incremental cache drift.
  // Resets stale sync cursors once so all clients perform a guaranteed full sync
  // and reconcile any transactions hidden by stale localStorage tombstones.
  try {
    const HEAL_KEY = 'tombstone_reconcile_fix_v3';
    if (!localStorage.getItem(HEAL_KEY)) {
      if (typeof resetSyncCursors === 'function') resetSyncCursors();
      localStorage.removeItem('permanent_deleted_tx_ids');
      localStorage.setItem(HEAL_KEY, 'true');
    }
  } catch (_) { }

  loadOfflineData();

  // CRITICAL: Also run on pageshow — this fires for bfcache restores
  // (e.g. after Google OAuth redirect on iOS), unlike DOMContentLoaded
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      // Page restored from bfcache (iOS back navigation or OAuth redirect)
      if (typeof window.restoreActiveModalsWithoutTransition === 'function') {
        window.restoreActiveModalsWithoutTransition();
      }
    }
  });

  // INSTANT COLD-START RENDERING (0ms):
  // Always render cached transactions and balances immediately, regardless of online/offline status.
  // This guarantees the user sees all cached transactions immediately on app launch, instead of an empty
  // screen or partial list while waiting for network auth and cloud synchronization to complete.
  const hasCachedUser = localStorage.getItem('cached_current_user');
  const isGuestMode = localStorage.getItem('auth_guest_mode') === 'true';

  if (hasCachedUser || isGuestMode) {
    hideAuthOverlay();
    if (hasCachedUser && !state.currentUser) {
      try { state.currentUser = JSON.parse(hasCachedUser); } catch (e) { }
    }
    if (isGuestMode) state.guestMode = true;
    window._authConfirmed = true;

    // Suppress transitions so the instant first paint is invisible and smooth
    window._suppressTransitions = true;
    try {
      calculateInitialBalances();
      updateUI();
    } finally {
      setTimeout(() => { window._suppressTransitions = false; }, 1500);
    }
  } else if (!navigator.onLine || !state.supabaseClient) {
    // No cached session and offline — show login
    showAuthOverlay();
  }

  function restoreActiveModalsFromStorage() {
    try {
      // SECURITY: Never restore a previous user's personal-data modal (e.g. the
      // transactions modal) before the session is confirmed valid. _isAuthenticated()
      // is true only after _authConfirmed is set (valid session / guest / offline
      // cached user). Until then, clear any saved modal state so nothing flashes.
      if (!_isAuthenticated()) {
        localStorage.removeItem('bg_active_modal_id');
        localStorage.removeItem('bg_active_modal_tx_id');
        localStorage.removeItem('bg_active_subcat_txs');
        localStorage.removeItem('bg_modal_scroll_top');
        return;
      }

      const activeModalId = null /* startup restore disabled */;
      if (activeModalId) {
        const currentlyActive = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
        if (currentlyActive && currentlyActive.id === activeModalId) return;
        if (activeModalId === 'transaction-modal') {
          const txId = localStorage.getItem('bg_active_modal_tx_id');
          if (txId) {
            const t = state.transactions.find(item => String(item.id) === String(txId));
            if (t) openEditTransactionModal(t, { instant: true });
          } else {
            openAddTransactionModal({ instant: true });
          }
        } else if (activeModalId === 'advisor-chat-modal') {
          openAdvisorChat();
        } else if (activeModalId === 'profile-settings-modal') {
          openProfileSheet();
        } else {
          openModal(activeModalId, { instant: true });
        }
        localStorage.removeItem('bg_active_modal_tx_id');
        localStorage.removeItem('bg_active_subcat_txs');
      }
    } catch (e) {
      console.warn('Failed to restore UI modal state:', e);
    }
  }
  window.restoreActiveModalsFromStorage = restoreActiveModalsFromStorage;

  function restoreActiveModalsWithoutTransition() {
    try {
      const activeModalId = localStorage.getItem('bg_active_modal_id');
      if (!activeModalId) return;

      const currentlyActive = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
      if (currentlyActive && currentlyActive.id === activeModalId) {
        // Modal is already correctly open. Do NOT toggle 'no-transition' globally,
        // which would invalidate rendering layers and cause visual flashes on resume.
        return;
      }

      pushNoTransition();
      restoreActiveModalsFromStorage();
      // ANTI-FLICKER: Keep no-transition for the full resume guard window
      // (_RESUME_GUARD_MS, ~1700ms) to cover the deferred updateUI render
      // (700ms baseDelay when _appJustResumed is true) AND the 1500ms
      // foreground sync. This ensures the tab re-render from the deferred
      // updateUI is also invisible to the user, eliminating the second flash
      // on resume. Uses the reference-counted guard so overlapping guards
      // never prematurely remove the class.
      setTimeout(() => {
        popNoTransition();
        document.documentElement.classList.remove('modal-prerender');
        // Optional cleanup of the injected style tag
        const prerenderStyle = document.getElementById('prerender-modal-style');
        if (prerenderStyle) prerenderStyle.remove();
      }, (typeof _RESUME_GUARD_MS === 'number' ? _RESUME_GUARD_MS : 1700));
    } catch (e) {
      console.warn('Failed to restore UI state without transitions:', e);
    }
  }
  window.restoreActiveModalsWithoutTransition = restoreActiveModalsWithoutTransition;

  // Restore active modals on boot instantly without transitions
  restoreActiveModalsWithoutTransition();

  // Safe removal of early tab style block to avoid layout flashes
  const earlyTabStyle = document.getElementById('early-tab-style');
  if (earlyTabStyle) {
    earlyTabStyle.remove();
  }
  // Safe removal of early auth hide style block
  const earlyAuthHideStyle = document.getElementById('early-auth-hide-style');
  if (earlyAuthHideStyle) {
    earlyAuthHideStyle.remove();
  }

  updateHeaderProfileBadge();

  // If device is offline, bypass Supabase auth and render cached data immediately.
  // Ensure early styles are cleaned up if offline
  if (!navigator.onLine || !state.supabaseClient) {
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('trans-date').value = today;
  applyLanguage(state.lang);
  detectGeoLanguage();

  // Remove no-transition class after the first paint is committed.
  // This prevents CSS transitions from flashing during startup.
  // Double-rAF ensures the browser has painted the initial frame before re-enabling.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  });
  window._appLoaded = true;
  if (window._startupTimeout) clearTimeout(window._startupTimeout);

  // PREMIUM RETURN HANDLER: After Stripe Checkout redirects back with
  // ?premium=success, refresh the profile (server is the source of truth) so
  // the Premium entitlement is reflected immediately. Also clean the URL so a
  // refresh doesn't re-trigger the toast.
  (function handlePremiumReturn() {
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('premium');
      const paypalStatus = params.get('paypal');
      const paypalToken = params.get('token');

      // Handle PayPal return
      if (paypalStatus === 'success' && paypalToken) {
        params.delete('paypal');
        params.delete('token');
        params.delete('PayerID');
        const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);

        (async () => {
          try {
            let sessionToken = '';
            if (state.supabaseClient) {
              const sRes = state.supabaseClient.auth.session ? { data: { session: state.supabaseClient.auth.session() } } : await state.supabaseClient.auth.getSession();
              sessionToken = (sRes && sRes.data && sRes.data.session) ? sRes.data.session.access_token : '';
            }
            if (sessionToken) {
              const capRes = await fetch(getBackendApiUrl('/api/paypal-capture'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + sessionToken
                },
                body: JSON.stringify({ orderId: paypalToken })
              });
              const capData = await capRes.json().catch(() => ({}));
              if (capData.success) {
                showSyncToast(state.lang === 'el' ? '🎉 Το Premium ενεργοποιήθηκε μέσω PayPal! Ευχαριστούμε!' : '🎉 Premium activated via PayPal! Thank you!', 5000);
                if (state.currentUser && typeof loadUserProfiles === 'function') {
                  await loadUserProfiles(state.currentUser);
                  updatePremiumUI();
                }
                return;
              }
            }
          } catch (pErr) {
            console.warn('PayPal capture error:', pErr);
          }
        })();
        return;
      }

      if (!status) return;

      // Remove the query param from the URL (history.replaceState keeps the page).
      params.delete('premium');
      const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);

      if (status === 'success') {
        showSyncToast(state.lang === 'el' ? '🎉 Το Premium ενεργοποιήθηκε! Ευχαριστούμε!' : '🎉 Premium activated! Thank you!', 5000);
        // Refresh the profile once the user is authenticated. First run the
        // server-side reconciliation (/api/premium-status) so the entitlement
        // is granted even if the webhook hasn't processed yet, then re-fetch.
        if (state.currentUser && typeof loadUserProfiles === 'function') {
          (async () => {
            try {
              if (typeof reconcilePremiumPurchase === 'function') {
                await reconcilePremiumPurchase();
              }
            } catch (e) { /* reconciliation is best-effort */ }
            loadUserProfiles(state.currentUser).then(() => {
              updatePremiumUI();
            }).catch(() => { });
          })();
        }
      } else if (status === 'cancelled') {
        showSyncToast(state.lang === 'el' ? 'Η αγορά ακυρώθηκε.' : 'Purchase cancelled.', 3000);
      }
    } catch (e) {
      console.warn('Premium return handler error:', e);
    }
  })();

  // COLD-START FADE-IN: The first updateUI() render is deferred by ~150ms
  // (via _updateUIRAF). Wait for that deferred render to paint (double-rAF +
  // a small buffer) before fading out the cold-start overlay, so the user sees
  // the fully-rendered content fade in smoothly instead of an abrupt black flash.
  //
  // On FIRST LAUNCH (no cached session) the login card is shown via the auth
  // overlay. Because the security guard skips _updateUIImpl() rendering while
  // unauthenticated, the content-painted signal never fires — so we must wait
  // until the auth overlay (login card) is actually VISIBLE before fading out,
  // otherwise the cold-start overlay lifts too early and the user sees a flash
  // of the blank background before the login card appears. We poll for it.
  const _authOverlayEl = document.getElementById('auth-overlay');
  // Detect a genuine first-launch / unauthenticated state (no cached session, not
  // guest, not yet confirmed) rather than relying on the overlay's inline
  // style.display. The early-auth-style CSS rule makes the overlay visible via a
  // stylesheet (display:flex !important), which does NOT update the inline
  // style.display property — so checking style.display here would always read
  // 'none' and fade the cold-start overlay out before the login card is painted,
  // producing a visible blank gap on first open.
  const _hasCachedUserAtBoot = !!localStorage.getItem('cached_current_user');
  const _isGuestModeAtBoot = localStorage.getItem('auth_guest_mode') === 'true';
  const _isFirstLaunchLogin = !!_authOverlayEl &&
    !_hasCachedUserAtBoot &&
    !_isGuestModeAtBoot &&
    !window._authConfirmed;
  if (_isFirstLaunchLogin) {
    // Poll until the login card is actually painted (visible + non-empty), then
    // fade out. A hard cap prevents the overlay from ever blocking the UI.
    const _coldStartPollStart = Date.now();
    const _coldStartPoll = setInterval(() => {
      const authCard = document.getElementById('auth-card');
      const cardVisible = authCard &&
        authCard.offsetParent !== null &&
        authCard.offsetHeight > 0;
      const authVisible = _authOverlayEl.style.display !== 'none' &&
        _authOverlayEl.offsetParent !== null;
      if ((cardVisible || authVisible) || (Date.now() - _coldStartPollStart > 2500)) {
        clearInterval(_coldStartPoll);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => { fadeOutColdStartOverlay(); }, 120);
          });
        });
      }
    }, 80);
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          fadeOutColdStartOverlay();
        }, 120);
      });
    });
  }

  if (typeof updateNotesTrashBadge === 'function') {
    updateNotesTrashBadge();
  }

  // DESKTOP WEB UX HOOK: Initialize the desktop UI layer (sidebar, topbar,
  // dashboard, keyboard shortcuts) ONLY when running in web-mode (browser/PWA).
  // web-ui.js is loaded with `defer` after app.js, so initDesktopUI is defined.
  // It self-guards on html.web-mode, so Android/iOS native is never affected.
  if (document.documentElement.classList.contains('web-mode')) {
    if (typeof window.initDesktopUI === 'function') {
      try {
        window.initDesktopUI();
      } catch (e) {
        console.error('[DesktopUI] init failed:', e);
      }
    }

    // Web-only Live Demo auto-boot & Upgrade action handler
    (function handleWebParams() {
      try {
        const params = new URLSearchParams(window.location.search);
        const isDemo = params.get('demo') === 'true' || params.get('demo') === '1' || localStorage.getItem('ba_web_demo_active') === 'true';
        const action = params.get('action');
        const open = params.get('open');

        if (isDemo) {
          localStorage.setItem('ba_ftux_status', 'demo_active');
          if (typeof onboardingAddDemoData === 'function') {
            const curState = (typeof getState === 'function') ? getState() : (window.state || {});
            if (!curState.transactions || curState.transactions.length === 0) {
              onboardingAddDemoData(true);
            }
          }
          if (!document.getElementById('web-demo-banner')) {
            const banner = document.createElement('div');
            banner.id = 'web-demo-banner';
            banner.style.cssText = 'position:sticky; top:0; z-index:99999; background:linear-gradient(90deg, #1e1b4b, #312e81); border-bottom:1px solid rgba(124,106,247,0.4); color:#fff; padding:8px 16px; font-family:"Outfit",sans-serif; font-size:13px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 4px 16px rgba(0,0,0,0.4); flex-wrap:wrap; gap:8px;';
            banner.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="background:#10B981; color:#0f172a; padding:2px 8px; border-radius:99px; font-weight:800; font-size:11px;">LIVE DEMO</span>
                <span>Δοκιμαστική λειτουργία με προφορτωμένα δεδομένα.</span>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <button type="button" onclick="if(typeof openPremiumModal==='function') openPremiumModal();" style="background:#10B981; color:#0f172a; border:none; padding:5px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">⚡ Απόκτηση Lifetime PRO (9,99€)</button>
                <button type="button" onclick="exitWebDemo()" style="background:rgba(255,255,255,0.1); color:#cbd5e1; border:1px solid rgba(255,255,255,0.2); padding:5px 10px; border-radius:8px; font-size:12px; cursor:pointer;">Έξοδος</button>
              </div>
            `;
            document.body.prepend(banner);
          }
          window.exitWebDemo = function() {
            localStorage.removeItem('ba_web_demo_active');
            localStorage.removeItem('auth_guest_mode');
            if (typeof onboardingClearDemoData === 'function') {
              onboardingClearDemoData(true);
            }
            window.location.href = '/app';
          };
        }

        if (action === 'upgrade' || open === 'premium') {
          setTimeout(() => {
            if (typeof openPremiumModal === 'function') {
              openPremiumModal();
            }
          }, 600);
        }
      } catch (e) {
        console.warn('Web entry params handler error:', e);
      }
    })();
  }
  }

  function _bootApp() {
    return initApp().catch(function (err) {
      console.error('[Boot] initApp() failed:', err);
      if (typeof window !== 'undefined' && typeof window.showRecoveryMode === 'function') {
        try {
          window.showRecoveryMode('App initialization failed: ' + (err && err.message ? err.message : String(err)));
        } catch (e) { /* recovery overlay itself failed; nothing more we can do */ }
      }
    });
  }

  function installAntiZoomGuard() {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    let _resetting = false;
    window.visualViewport.addEventListener('resize', function () {
      if (_resetting) return;
      const scale = window.visualViewport.scale;
      if (scale !== 1) {
        _resetting = true;
        const vp = document.querySelector('meta[name="viewport"]');
        if (vp) {
          vp.setAttribute('content',
            'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover');
        }
        window.scrollTo(0, 0);
        if (document.body) document.body.scrollTop = 0;
        if (document.documentElement) document.documentElement.scrollTop = 0;
        setTimeout(function () { _resetting = false; }, 300);
      }
    });
  }

  function installHalfInitWatchdog() {
    if (typeof window === 'undefined' || typeof setTimeout !== 'function') return;
    setTimeout(function () {
      if (window._appLoaded) return;
      if (typeof document === 'undefined') return;
      if (document.getElementById('recovery-overlay')) return;
      var authOverlay = document.getElementById('auth-overlay');
      if (authOverlay && authOverlay.style.display !== 'none') return;

      var accountsNav = document.querySelector('#tab-nav-accounts span[data-i18n="nav_accounts"]');
      if (accountsNav) {
        var text = (accountsNav.textContent || '').trim();
        var isFallback = (text === 'Λογαριασμοί' || text === 'Accounts');
        if (isFallback) {
          console.error('[Watchdog] App left in half-initialized state (nav not translated). Triggering recovery.');
          if (typeof window.showRecoveryMode === 'function') {
            try {
              window.showRecoveryMode('App did not finish initializing (nav labels not applied). Please reload.');
            } catch (e) { /* ignore */ }
          }
        }
      }
    }, 6000);
  }

  function autoRecoverTemplatesFromHistory() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('templates_autorecovered', 'true');
      }
    } catch (e) { }
  }

  // Auto-install runtime guards when running in browser
  if (typeof window !== 'undefined') {
    installAntiZoomGuard();
    installHalfInitWatchdog();
  }

  return {
    initApp: initApp,
    _bootApp: _bootApp,
    installAntiZoomGuard: installAntiZoomGuard,
    installHalfInitWatchdog: installHalfInitWatchdog,
    autoRecoverTemplatesFromHistory: autoRecoverTemplatesFromHistory
  };
});
