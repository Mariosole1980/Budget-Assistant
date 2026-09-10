/**
 * Offline Import & Guest Data Subsystem
 * Extracted from app.js (Phase 19A Architectural Modularization)
 * Handles guest/offline transactions, idempotent cloud transfer, and prompt modals.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OfflineImportService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let _offlinePromptInFlight = false;
  let _syncLocalInFlight = false;

  function getOfflineGuestTransactions() {
    try {
      const raw = localStorage.getItem('offline_guest_transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly exclude demo sample transactions so new accounts are never prompted for demo data
          const realTxs = parsed.filter(t => t && !t.is_demo && !String(t.id || '').startsWith('demo_'));
          return realTxs;
        }
      }
    } catch (e) {
      console.warn('Failed to parse offline_guest_transactions:', e);
    }
    return [];
  }

  function saveOfflineGuestTransactions(trans) {
    try {
      if (!Array.isArray(trans) || trans.length === 0) {
        localStorage.removeItem('offline_guest_transactions');
      } else {
        // Exclude demo transactions from guest backup
        const realTxs = trans.filter(t => t && !t.is_demo && !String(t.id || '').startsWith('demo_'));
        if (realTxs.length === 0) {
          localStorage.removeItem('offline_guest_transactions');
        } else {
          localStorage.setItem('offline_guest_transactions', JSON.stringify(realTxs));
        }
      }
    } catch (e) {
      console.error('Failed to save offline_guest_transactions:', e);
    }
    updateOfflineImportSettingsRow();
  }

  function updateOfflineImportSettingsRow() {
    if (typeof document === 'undefined') return;
    const row = document.getElementById('settings-offline-import-row');
    if (!row) return;
    const count = getOfflineGuestTransactions().length;
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    if (count > 0 && appState.currentUser) {
      row.style.display = 'flex';
      const descEl = document.getElementById('settings-offline-import-desc');
      if (descEl) {
        const template = (appState.lang === 'el')
          ? `Μεταφορά των ${count} τοπικών κινήσεων στον λογαριασμό σας`
          : `Transfer ${count} local transactions to your account`;
        descEl.textContent = template;
      }
    } else {
      row.style.display = 'none';
    }
  }

  function ensureOfflineImportModal() {
    if (typeof document === 'undefined') return null;
    let modal = document.getElementById('offline-import-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'offline-import-modal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '2147483647';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 360px; text-align: center; padding: 26px 20px; border-radius: 24px; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
        <div style="width: 56px; height: 56px; border-radius: 18px; background: rgba(99,102,241,0.12); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto;">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <h3 id="offline-import-modal-title" style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-primary); font-family: 'Outfit', sans-serif;">
            Διαχείριση Offline Κινήσεων
          </h3>
          <p id="offline-import-modal-desc" style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.45;">
            Βρέθηκαν offline κινήσεις. Τι θέλετε να κάνετε για τον λογαριασμό σας;
          </p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px;">
          <!-- Option 1: Sync to Cloud -->
          <button id="offline-import-btn-sync" class="btn btn-primary" style="padding: 13px 16px; font-size: 13.5px; font-weight: 700; border-radius: 14px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span id="offline-import-btn-sync-text">Μεταφορά στον Λογαριασμό</span>
          </button>
          <!-- Option 2: Keep Offline Only -->
          <button id="offline-import-btn-keep" class="btn btn-secondary" style="padding: 12px 16px; font-size: 13px; font-weight: 600; border-radius: 14px; width: 100%; border: 1px solid var(--border); background: rgba(255,255,255,0.04); color: var(--text-primary); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fa-solid fa-floppy-disk"></i>
            <span id="offline-import-btn-keep-text">Διατήρηση μόνο Offline</span>
          </button>
          <!-- Option 3: Discard / Delete -->
          <button id="offline-import-btn-discard" class="btn btn-danger-outline" style="padding: 10px 16px; font-size: 12.5px; font-weight: 600; border-radius: 14px; width: 100%; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.04); color: #ef4444; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i class="fa-solid fa-trash"></i>
            <span id="offline-import-btn-discard-text">Διαγραφή</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function showOfflineImportPrompt(userId, userEmail, isManual = false) {
    return new Promise((resolve) => {
      if (_offlinePromptInFlight) {
        resolve(null);
        return;
      }

      const guestTxs = getOfflineGuestTransactions();
      const count = guestTxs.length;
      const appState = (typeof state !== 'undefined' ? state : window.state) || {};
      const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : window.TRANSLATIONS) || {};
      const lang = appState.lang || 'el';

      if (count === 0) {
        if (isManual && typeof showToast === 'function') {
          showToast(lang === 'el' ? 'Δεν βρέθηκαν εκκρεμείς offline κινήσεις.' : 'No pending offline transactions found.');
        }
        resolve(null);
        return;
      }

      _offlinePromptInFlight = true;
      const modal = ensureOfflineImportModal();
      if (!modal) {
        _offlinePromptInFlight = false;
        resolve(null);
        return;
      }

      const emailDisplay = userEmail || (appState.currentUser?.email || 'Cloud');

      const titleEl = document.getElementById('offline-import-modal-title');
      const descEl = document.getElementById('offline-import-modal-desc');
      const btnSyncText = document.getElementById('offline-import-btn-sync-text');
      const btnKeepText = document.getElementById('offline-import-btn-keep-text');
      const btnDiscardText = document.getElementById('offline-import-btn-discard-text');

      if (titleEl) titleEl.textContent = (translations[lang] && translations[lang]['modal_offline_import_title']) || 'Διαχείριση Offline Κινήσεων';
      if (descEl) {
        const descTemplate = (translations[lang] && translations[lang]['modal_offline_import_desc']) || 'Βρέθηκαν {count} κινήσεις που καταγράψατε σε λειτουργία Offline. Τι θέλετε να κάνετε για τον λογαριασμό {email};';
        descEl.textContent = descTemplate.replace('{count}', count).replace('{email}', emailDisplay);
      }
      if (btnSyncText) btnSyncText.textContent = (translations[lang] && translations[lang]['btn_sync_to_cloud']) || '☁️ Μεταφορά στον Λογαριασμό';
      if (btnKeepText) btnKeepText.textContent = (translations[lang] && translations[lang]['btn_keep_offline_only']) || '💾 Διατήρηση μόνο Offline';
      if (btnDiscardText) btnDiscardText.textContent = (translations[lang] && translations[lang]['btn_discard_offline']) || '🗑️ Διαγραφή';

      const btnSync = document.getElementById('offline-import-btn-sync');
      const btnKeep = document.getElementById('offline-import-btn-keep');
      const btnDiscard = document.getElementById('offline-import-btn-discard');

      let resolved = false;
      const closeModal = (choice) => {
        if (resolved) return;
        resolved = true;
        _offlinePromptInFlight = false;
        if (choice === 'keep') {
          try {
            localStorage.setItem('offline_guest_prompt_dismissed_count', String(count));
          } catch (e) { /* storage unavailable — ignore */ }
        }
        modal.classList.remove('active');
        modal.style.cssText = '';
        document.body.classList.remove('modal-open');
        modal.ontouchstart = null;
        modal.ontouchend = null;
        modal.onclick = null;
        resolve(choice);
      };

      const newBtnSync = btnSync.cloneNode(true);
      const newBtnKeep = btnKeep.cloneNode(true);
      const newBtnDiscard = btnDiscard.cloneNode(true);

      btnSync.parentNode.replaceChild(newBtnSync, btnSync);
      btnKeep.parentNode.replaceChild(newBtnKeep, btnKeep);
      btnDiscard.parentNode.replaceChild(newBtnDiscard, btnDiscard);

      newBtnSync.onclick = async (e) => {
        e.stopPropagation();
        closeModal('sync');
        await transferOfflineDataToAccount(userId, userEmail);
      };

      newBtnKeep.onclick = (e) => {
        e.stopPropagation();
        closeModal('keep');
        updateOfflineImportSettingsRow();
      };

      newBtnDiscard.onclick = async (e) => {
        e.stopPropagation();
        const confirmText = ((translations[lang] && translations[lang]['offline_discard_confirm']) || 'Είστε σίγουροι ότι θέλετε να διαγράψετε τις {count} offline κινήσεις;').replace('{count}', count);
        const ok = (typeof showConfirm === 'function')
          ? await showConfirm(confirmText, '', '🗑️')
          : ((typeof window !== 'undefined' && typeof window.showConfirm === 'function')
            ? await window.showConfirm(confirmText, '', '🗑️')
            : true);
        if (ok) {
          localStorage.removeItem('offline_guest_transactions');
          localStorage.removeItem('offline_guest_prompt_dismissed_count');
          updateOfflineImportSettingsRow();
          closeModal('discard');
        }
      };

      modal.classList.add('active');
      document.body.classList.add('modal-open');

      let touchStartTarget = null;
      modal.ontouchstart = (e) => {
        touchStartTarget = e.target;
      };
      modal.ontouchend = (e) => {
        if (touchStartTarget === modal && e.target === modal) {
          e.preventDefault();
          e.stopPropagation();
          closeModal('keep');
        }
        touchStartTarget = null;
      };
      modal.onclick = (e) => {
        if (e.target === modal) {
          e.stopPropagation();
          closeModal('keep');
        }
      };
    });
  }

  function triggerManualOfflineImport() {
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    if (!appState.currentUser) {
      if (typeof showAuthOverlay === 'function') {
        showAuthOverlay();
      }
      return;
    }
    showOfflineImportPrompt(appState.currentUser.id, appState.currentUser.email, true);
  }

  // 100% IDEMPOTENT CLOUD UPSERT (Persistent UUIDs - Zero Duplicates)
  async function transferOfflineDataToAccount(userId, userEmail) {
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    if (!userId || !appState.supabaseClient) return;
    const guestTxs = getOfflineGuestTransactions();
    if (guestTxs.length === 0) return;

    if (typeof toggleLoader === 'function') toggleLoader(true);
    try {
      const mapFn = typeof mapTransactionToDb === 'function' ? mapTransactionToDb : (t => Object.assign({}, t));
      const toUpsert = guestTxs.map(t => {
        const copy = mapFn(t);
        delete copy.fx_snapshot;
        return copy;
      }).filter(Boolean);

      if (typeof window !== 'undefined') window._suppressRealtimeEvents = true;
      const timeoutFn = typeof promiseTimeout === 'function' ? promiseTimeout : ((p) => p);

      for (let i = 0; i < toUpsert.length; i += 50) {
        const batch = toUpsert.slice(i, i + 50);
        const { error } = await timeoutFn(
          appState.supabaseClient.from('transactions').upsert(batch, { onConflict: 'id' }).then(r => r),
          60000
        );
        if (error) throw error;
      }

      // ONLY ON 100% SUCCESS: Clean guest storage
      localStorage.removeItem('offline_guest_transactions');
      localStorage.removeItem('offline_guest_prompt_dismissed_count');
      updateOfflineImportSettingsRow();

      // Reload user data & update UI
      if (typeof loadData === 'function') await loadData();
      if (typeof flushUI === 'function') flushUI();

      const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : window.TRANSLATIONS) || {};
      const lang = appState.lang || 'el';
      const successMsg = ((translations[lang] && translations[lang]['offline_import_success']) || '🎉 {count} offline κινήσεις μεταφέρθηκαν επιτυχώς στον λογαριασμό σας!').replace('{count}', toUpsert.length);
      if (typeof showToast === 'function') showToast(successMsg, 4000);
    } catch (err) {
      console.error('Failed to transfer offline transactions:', err);
      const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : window.TRANSLATIONS) || {};
      const lang = appState.lang || 'el';
      const errorMsg = (translations[lang] && translations[lang]['offline_import_error']) || '❌ Προέκυψε σφάλμα κατά τη μεταφορά. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.';
      if (typeof showToast === 'function') showToast(errorMsg, 4000);
    } finally {
      if (typeof toggleLoader === 'function') toggleLoader(false);
      setTimeout(() => {
        if (typeof window !== 'undefined') window._suppressRealtimeEvents = false;
      }, 3000);
    }
  }

  // Background sync helper for pending local items belonging to the current user
  async function syncLocalTransactionsToCloud(userId, options = {}) {
    const silent = !!options.silent;
    const transStr = localStorage.getItem('offline_transactions');
    const guestTxs = (typeof getOfflineGuestTransactions === 'function') ? getOfflineGuestTransactions() : [];
    if (!transStr && guestTxs.length === 0) return;

    if (_syncLocalInFlight) {
      return;
    }
    _syncLocalInFlight = true;

    try {
      let allTrans = [];
      try {
        allTrans = transStr ? (JSON.parse(transStr) || []) : [];
      } catch (e) {
        allTrans = [];
      }
      const combined = [...allTrans, ...guestTxs];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const localTrans = combined.filter(t => {
        if (!t || !t.amount) return false;
        if (!t.id) return true;
        if (String(t.id).startsWith('local_')) return true;
        if (t.user_id === userId || !t.user_id || t.user_id === 'guest') return true;
        if (!uuidRegex.test(String(t.id))) return true;
        return false;
      });

      // Durable tombstone guard: never re-upload a permanently-deleted transaction to
      // the cloud, even if it is still present in the offline cache.
      let permanentlyDeletedSet = null;
      try {
        if (typeof collectPermanentlyDeletedTxIds === 'function') {
          permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
        }
      } catch (err) {
        console.warn('Failed to collect permanently deleted IDs in syncLocalTransactionsToCloud:', err);
      }
      const filteredLocalTrans = permanentlyDeletedSet
        ? localTrans.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))))
        : localTrans;

      if (filteredLocalTrans.length > 0) {
        const mapFn = typeof mapTransactionToDb === 'function' ? mapTransactionToDb : (t => Object.assign({}, t));
        const toInsert = filteredLocalTrans.map(t => {
          const copy = mapFn(t);
          delete copy.fx_snapshot;
          return copy;
        }).filter(Boolean);

        const appState = (typeof state !== 'undefined' ? state : window.state) || {};
        const timeoutFn = typeof promiseTimeout === 'function' ? promiseTimeout : ((p) => p);

        if (typeof window !== 'undefined') window._suppressRealtimeEvents = true;
        try {
          for (let i = 0; i < toInsert.length; i += 50) {
            const batch = toInsert.slice(i, i + 50);
            const { error } = await timeoutFn(appState.supabaseClient
              .from('transactions')
              .upsert(batch, { onConflict: 'id' }).then(r => r), 60000);
            if (error) throw error;
          }

          const cleanOffline = allTrans.filter(t => !filteredLocalTrans.includes(t));
          localStorage.setItem('offline_transactions', JSON.stringify(cleanOffline));
          localStorage.setItem('offline_transactions_owner', userId);
          localStorage.removeItem('offline_guest_transactions');
          localStorage.removeItem('offline_guest_prompt_dismissed_count');
        } finally {
          setTimeout(() => {
            if (typeof window !== 'undefined') window._suppressRealtimeEvents = false;
          }, 5000);
        }
      }
    } catch (err) {
      console.error('Error in syncLocalTransactionsToCloud:', err);
    } finally {
      _syncLocalInFlight = false;
    }
  }

  return {
    getOfflineGuestTransactions,
    saveOfflineGuestTransactions,
    updateOfflineImportSettingsRow,
    ensureOfflineImportModal,
    showOfflineImportPrompt,
    triggerManualOfflineImport,
    transferOfflineDataToAccount,
    syncLocalTransactionsToCloud
  };
}));
