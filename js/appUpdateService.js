/**
 * ============================================================
 * APP UPDATE & GUEST LIFECYCLE SERVICE
 * ------------------------------------------------------------
 * Handles force app updates (Capgo OTA download/set/reload,
 * ServiceWorker unregistration, cache purge) and guest session initialization.
 *
 * Extracted from app.js (Phase 27B Architectural Modularization)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppUpdateService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    return (typeof window !== 'undefined' && window.state) ? window.state : {};
  }

  async function forceAppUpdate() {
    const state = getState();
    const lang = state.lang || 'el';
    const confirmMsg = lang === 'en'
      ? 'Force update and reload the app?'
      : 'Θέλετε να επιβάλλετε ενημέρωση και επαναφόρτωση της εφαρμογής;';
    const confirmTitle = lang === 'el' ? 'Αναγκαστική Ενημέρωση' : 'Force Update';

    let confirmed = false;
    if (typeof window !== 'undefined' && typeof window.showConfirm === 'function') {
      confirmed = await window.showConfirm(confirmMsg, confirmTitle, '🔄');
    } else {
      confirmed = true;
    }
    if (!confirmed) return false;

    if (typeof window !== 'undefined' && typeof window.showSyncToast === 'function') {
      window.showSyncToast(lang === 'el' ? 'Έλεγχος & λήψη ενημέρωσης...' : 'Checking & downloading update...', 10000);
    }

    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) {
      try {
        const manifestRes = await fetch("https://budget-assistant-pwa.pages.dev/version.json?_t=" + Date.now());
        const manifest = await manifestRes.json();

        if (!manifest || !manifest.url) {
          throw new Error("Invalid version.json format");
        }

        if (typeof window.showSyncToast === 'function') {
          window.showSyncToast((lang === 'el' ? 'Λήψη έκδοσης ' : 'Downloading version ') + (manifest.version || 'νέας') + '...', 10000);
        }

        const DOWNLOAD_TIMEOUT_MS = 90000;
        const downloadPromise = window.Capacitor.Plugins.CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version || Date.now().toString(),
          checksum: manifest.checksum || undefined
        });
        const update = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => {
          const t = setTimeout(() => reject(new Error('Download timed out')), DOWNLOAD_TIMEOUT_MS);
          if (t && t.unref) t.unref();
        })
        ]);

        await window.Capacitor.Plugins.CapacitorUpdater.set({ id: update.id });

        if (typeof window.showSyncToast === 'function') {
          window.showSyncToast(lang === 'el' ? 'Εφαρμογή ενημέρωσης & επανεκκίνηση...' : 'Applying update & reloading...', 3000);
        }

        setTimeout(async () => {
          try {
            if (window.Capacitor.Plugins.CapacitorUpdater.reload) {
              await window.Capacitor.Plugins.CapacitorUpdater.reload();
            } else if (window.location && window.location.reload) {
              window.location.reload(true);
            }
          } catch (_) {
            if (window.location && window.location.reload) {
              window.location.reload(true);
            }
          }
        }, 500);
        return true;
      } catch (e) {
        console.error('[ForceUpdate] Capgo update failed; falling back to classic reload:', e);
      }
    }

    // Classic path (plain web/PWA or no OTA update available): clear SW + cache and reload
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      } catch (e) {
        console.error('Failed to unregister SW:', e);
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      } catch (e) {
        console.error('Failed to clear cache:', e);
      }
    }
    if (typeof window !== 'undefined' && window.location && window.location.reload) {
      window.location.reload(true);
    }
    return true;
  }

  async function enterGuestMode() {
    const state = getState();
    state.guestMode = true;
    if (typeof window !== 'undefined') {
      window._authConfirmed = true;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_guest_mode', 'true');
      localStorage.removeItem('offline_transactions_owner');
    }

    state.currentUser = null;
    state.session = null;
    state.userProfile = null;
    state.partnerProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    state.transactions = [];
    state.budgets = [];
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.trashTransactions = [];
    state.notifications = [];
    state.notes = [];

    if (typeof window !== 'undefined') {
      if (typeof window.hideAuthOverlay === 'function') {
        window.hideAuthOverlay();
      }
      if (typeof window.toggleLoader === 'function') {
        window.toggleLoader(true);
      }
      const switcher = typeof document !== 'undefined' ? document.getElementById('wallet-switcher-container') : null;
      if (switcher) switcher.style.display = 'none';

      if (typeof window.updateHeaderProfileBadge === 'function') {
        window.updateHeaderProfileBadge();
      }

      window._suppressTransitions = true;
      try {
        if (typeof window.loadData === 'function') {
          await window.loadData();
        }
        if (typeof window.flushUI === 'function') {
          window.flushUI();
        }
      } finally {
        setTimeout(() => { window._suppressTransitions = false; }, 1500);
      }

      if (typeof window.renderPartnerSection === 'function') {
        window.renderPartnerSection();
      }
      if (typeof window.toggleLoader === 'function') {
        window.toggleLoader(false);
      }
    }
  }

  return {
    forceAppUpdate,
    enterGuestMode
  };
}));
