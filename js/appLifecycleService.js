/**
 * App Lifecycle & Resume Subsystem
 * Extracted from app.js (Phase 19D Architectural Modularization)
 * Handles app backgrounding state persistence, auto-lock check, resume recovery,
 * visibilitychange, and Capacitor app state listeners.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppLifecycleService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const _RESUME_GUARD_MS = 1700;
  const _REALTIME_RESUME_GUARD_MS = 10000;
  let _visibilitySyncTimer = null;
  let _resumeDebounceTimer = null;

  function saveCurrentUIStateToStorage() {
    try {
      if (typeof window !== 'undefined') {
        window._appIsBackgrounding = true;
      }
      const now = Date.now();
      if (typeof window !== 'undefined') {
        window._lastBackgroundTimestamp = now;
      }
      try {
        localStorage.setItem('app_background_timestamp', String(now));
      } catch (e) {}
      // Ensure last user activity is tracked
      if (typeof window !== 'undefined' && !window._lastUserActivity) {
        window._lastUserActivity = now;
      }
      // Blur any focused input so the keyboard doesn't re-appear on resume
      if (typeof document !== 'undefined' && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
        // Instantly reset the CSS keyboard variable so the UI layout is correct for the background screenshot
        // and doesn't get stuck suspended in mid-air during the 600ms _appJustResumed resume guard on Android.
        document.documentElement.style.setProperty('--keyboard-height', '0px');
      }

      // 1. Scroll Position
      const scrollContainer = (typeof getActiveScrollContainer === 'function')
        ? getActiveScrollContainer()
        : (typeof window !== 'undefined' && typeof window.getActiveScrollContainer === 'function' ? window.getActiveScrollContainer() : null);
      if (scrollContainer) {
        localStorage.setItem('bg_scroll_top', scrollContainer.scrollTop);
      }

      // 2. Open Modals (Match any active overlay)
      if (typeof document !== 'undefined') {
        const activeModal = document.querySelector('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active');
        if (activeModal) {
          const modalId = activeModal.id;
          localStorage.setItem('bg_active_modal_id', modalId);

          const modalBody = activeModal.querySelector('.modal-body');
          if (modalBody) {
            localStorage.setItem('bg_modal_scroll_top', modalBody.scrollTop);
          }

          if (modalId === 'transaction-modal') {
            const txInput = document.getElementById('trans-id');
            const txId = txInput ? txInput.value : '';
            localStorage.setItem('bg_active_modal_tx_id', txId || '');
          } else {
            localStorage.removeItem('bg_active_modal_tx_id');
          }

          const appState = (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : {})) || {};
          if (modalId === 'stats-transactions-modal') {
            localStorage.setItem('bg_active_subcat_txs', JSON.stringify(appState.activeSubcategoryTransactions || []));
          } else {
            localStorage.removeItem('bg_active_subcat_txs');
          }
        }
      }
    } catch (e) {
      console.warn('[STATE] Failed to save UI state:', e);
    } finally {
      if (typeof window !== 'undefined') {
        window._appIsBackgrounding = false;
      }
    }
  }

  async function _refreshSessionIfNeeded() {
    const appState = (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : {})) || {};
    if (!appState.supabaseClient || !appState.currentUser) return;
    try {
      const { data, error } = await appState.supabaseClient.auth.getSession();
      if (error) {
        console.warn('[SYNC] Session refresh failed on resume:', error.message);
        return;
      }
      if (data && data.session) {
        const sessionUser = data.session.user;
        if (sessionUser && sessionUser.id && appState.currentUser.id !== sessionUser.id) {
          appState.currentUser = sessionUser;
        }
      }
    } catch (e) {
      console.warn('[SYNC] Session refresh threw on resume:', e);
    }
  }

  function handleAppForegroundSync() {
    const appState = (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : {})) || {};
    if (appState.currentUser && appState.supabaseClient) {
      if (_visibilitySyncTimer) clearTimeout(_visibilitySyncTimer);
      const timeSinceLastSync = Date.now() - (appState.lastSyncTime || 0);
      if (timeSinceLastSync > 2000) {
        _visibilitySyncTimer = setTimeout(async () => {
          _visibilitySyncTimer = null;
          await _refreshSessionIfNeeded();
          const pushNoTrans = (typeof pushNoTransition === 'function')
            ? pushNoTransition
            : (typeof window !== 'undefined' && typeof window.pushNoTransition === 'function' ? window.pushNoTransition : () => {});
          const popNoTrans = (typeof popNoTransition === 'function')
            ? popNoTransition
            : (typeof window !== 'undefined' && typeof window.popNoTransition === 'function' ? window.popNoTransition : () => {});

          pushNoTrans();
          const _syncGuardTimer = setTimeout(() => { popNoTrans(); }, 6000);
          try {
            if (typeof forceSyncNow === 'function') {
              await forceSyncNow(true);
            } else if (typeof window !== 'undefined' && typeof window.forceSyncNow === 'function') {
              await window.forceSyncNow(true);
            }
          } finally {
            clearTimeout(_syncGuardTimer);
            setTimeout(() => { popNoTrans(); }, 500);
          }
        }, 1500);
      }
    }
  }

  function _handleAppResumed() {
    // AUTO-LOCK: Check if the app should lock on resume based on user's auto-lock settings.
    try {
      const autoLockSetting = localStorage.getItem('settings_auto_lock_delay') || 'disabled';
      if (autoLockSetting !== 'disabled') {
        const savedPin = localStorage.getItem('app_pin');
        const validPin = savedPin && savedPin.length === 4;
        if (validPin) {
          const lockFn = typeof showLockScreen === 'function'
            ? showLockScreen
            : (typeof window !== 'undefined' && typeof window.showLockScreen === 'function' ? window.showLockScreen : null);

          if (autoLockSetting === 'immediate' || autoLockSetting === '0') {
            if (lockFn) lockFn();
          } else {
            const delayMs = (typeof window !== 'undefined' && typeof window._getAutoLockDelayMs === 'function')
              ? window._getAutoLockDelayMs()
              : (parseInt(autoLockSetting, 10) * 60 * 1000);
            if (delayMs > 0) {
              const storedActivity = Number(localStorage.getItem('last_user_activity_timestamp')) || 0;
              const lastActivity = storedActivity || (typeof window !== 'undefined' ? window._lastUserActivity : 0) || Date.now();
              const elapsed = Date.now() - lastActivity;
              if (elapsed >= delayMs) {
                if (lockFn) lockFn();
              } else {
                if (typeof window !== 'undefined' && typeof window._resetAutoLockTimer === 'function') {
                  window._resetAutoLockTimer();
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AUTO-LOCK] Resume check failed:', e);
    }

    if (typeof document !== 'undefined') {
      document.body.classList.add('no-transitions');
      setTimeout(() => {
        document.body.classList.remove('no-transitions');
      }, _RESUME_GUARD_MS);
    }

    const _isNativeAndroid = typeof window !== 'undefined' && !!(window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform());
    const _isWebMode = typeof document !== 'undefined' && document.documentElement.classList.contains('web-mode');
    if (!_isNativeAndroid && !_isWebMode && typeof window !== 'undefined' && typeof window.showResumeOverlay === 'function') {
      window.showResumeOverlay();
    }

    if (_resumeDebounceTimer) return;
    _resumeDebounceTimer = setTimeout(() => { _resumeDebounceTimer = null; }, 800);

    if (_isNativeAndroid && typeof window !== 'undefined') {
      window._contentPaintNotified = false;
      if (typeof _notifyNativeContentPainted === 'function') {
        _notifyNativeContentPainted();
      } else if (typeof window._notifyNativeContentPainted === 'function') {
        window._notifyNativeContentPainted();
      }
    }

    if (typeof window !== 'undefined') {
      window._appJustResumed = true;
      setTimeout(() => { window._appJustResumed = false; }, _RESUME_GUARD_MS);
      window._lastResumeTimestamp = Date.now();
    }

    const pushNoTrans = (typeof pushNoTransition === 'function')
      ? pushNoTransition
      : (typeof window !== 'undefined' && typeof window.pushNoTransition === 'function' ? window.pushNoTransition : () => {});
    const popNoTrans = (typeof popNoTransition === 'function')
      ? popNoTransition
      : (typeof window !== 'undefined' && typeof window.popNoTransition === 'function' ? window.popNoTransition : () => {});

    pushNoTrans();
    setTimeout(() => {
      popNoTrans();
    }, _RESUME_GUARD_MS);

    if (typeof window !== 'undefined' && typeof window._updateViewportHeight === 'function') {
      window._updateViewportHeight(true);
    }

    // Restore modals that were open before backgrounding.
    if (typeof document !== 'undefined') {
      const savedModalId = localStorage.getItem('bg_active_modal_id');
      const savedEl = savedModalId ? document.getElementById(savedModalId) : null;
      const needsRestore = savedEl && !savedEl.classList.contains('active');
      if (needsRestore && typeof window !== 'undefined' && typeof window.restoreActiveModalsWithoutTransition === 'function') {
        window.restoreActiveModalsWithoutTransition();
      }
    }

    if (typeof setupSupabaseRealtimeSubscription === 'function') {
      setupSupabaseRealtimeSubscription();
    } else if (typeof window !== 'undefined' && typeof window.setupSupabaseRealtimeSubscription === 'function') {
      window.setupSupabaseRealtimeSubscription();
    }

    handleAppForegroundSync();
  }

  function initLifecycleListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        _handleAppResumed();
      } else if (document.visibilityState === 'hidden') {
        saveCurrentUIStateToStorage();
      }
    });

    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      try {
        const App = window.Capacitor.Plugins.App;
        if (App && typeof App.addListener === 'function') {
          App.addListener('appStateChange', (appState) => {
            if (appState.isActive) {
              _handleAppResumed();
            } else {
              saveCurrentUIStateToStorage();
            }
          });
        }
      } catch (e) {
        console.warn('[Capacitor] Failed to register appStateChange listener:', e);
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const appState = (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : {})) || {};
        if (appState.currentUser) {
          if (typeof startPartnerSyncPolling === 'function') startPartnerSyncPolling();
          else if (typeof window !== 'undefined' && typeof window.startPartnerSyncPolling === 'function') window.startPartnerSyncPolling();

          if (typeof setupSupabaseRealtimeSubscription === 'function') setupSupabaseRealtimeSubscription();
          else if (typeof window !== 'undefined' && typeof window.setupSupabaseRealtimeSubscription === 'function') window.setupSupabaseRealtimeSubscription();

          if (typeof processSyncQueue === 'function') processSyncQueue({ skipReload: true });
          else if (typeof window !== 'undefined' && typeof window.processSyncQueue === 'function') window.processSyncQueue({ skipReload: true });
        }
      }, 5000);
    });
  }

  // Auto-register listeners in browser environment
  if (typeof window !== 'undefined') {
    initLifecycleListeners();
  }

  return {
    saveCurrentUIStateToStorage,
    _refreshSessionIfNeeded,
    handleAppForegroundSync,
    _handleAppResumed,
    initLifecycleListeners,
    getResumeGuardMs: () => _RESUME_GUARD_MS,
    getRealtimeResumeGuardMs: () => _REALTIME_RESUME_GUARD_MS
  };
}));
