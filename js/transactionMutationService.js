/**
 * ============================================================
 * TRANSACTION MUTATION & PERSISTENCE SUBSYSTEM
 * ------------------------------------------------------------
 * Handles CRUD transaction mutations: optimistic offline persistence,
 * cloud synchronization, soft-deletion, and trash storage.
 *
 * Extracted from app.js (Phase 28B Architectural Modularization)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TransactionMutationService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    return (typeof window !== 'undefined' && window.state) ? window.state : (typeof state !== 'undefined' ? state : {});
  }

async function saveTransaction(transaction) {
  transaction.amount = parseFloat(transaction.amount);

  // HIGH-EXPENSE ALERT: Fire the "Single Expense Alert" notification if this
  // newly saved expense meets/exceeds the configured limit (settings_expense_alert_limit).
  if (typeof checkHighExpenseAlert === 'function') checkHighExpenseAlert(transaction); else if (typeof window !== 'undefined' && typeof window.checkHighExpenseAlert === 'function') window.checkHighExpenseAlert(transaction);

  // 1. Generate local UUID if it's a new transaction
  if (!transaction.id) {
    transaction.id = (typeof generateUUID === 'function' ? generateUUID() : ((typeof window !== 'undefined' && typeof window.generateUUID === 'function') ? window.generateUUID() : ('id_' + Date.now())));
  }

  // Populate user_id and family_id before saving offline to prevent guest sync duplication
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (!transaction.user_id) {
      transaction.user_id = state.currentUser.id;
    }
    if (state.activeAccountMode === 'personal') {
      // In Personal Mode, new transactions default to personal scope (family_id = null)
      if (!transaction.family_id) {
        transaction.family_id = null;
        transaction.is_shared = false;
      }
    } else if (!transaction.family_id && state.userProfile && state.userProfile.family_id) {
      transaction.family_id = state.userProfile.family_id;
    }
  }

  // 2. Optimistically save to local state and local storage immediately
  saveTransactionOffline(transaction);
  // Guard against the re-fetch race: keep this transaction in the "recently saved"
  // set so a loadData() re-fetch that hasn't yet seen the cloud write does NOT drop it.
  if (typeof _markRecentlySaved === 'function') _markRecentlySaved(transaction.id); else if (typeof window !== 'undefined' && typeof window._markRecentlySaved === 'function') window._markRecentlySaved(transaction.id);
  if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
  if (typeof updateUI === 'function') updateUI(); else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') window.updateUI();

  // 3. Save to cloud directly and reliably
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = mapTransactionToDb(transaction);

    // Enqueue immediately before starting the cloud request to prevent data loss if offline
    if (typeof enqueueSyncMutation === 'function') enqueueSyncMutation('save', transaction); else if (typeof window !== 'undefined' && typeof window.enqueueSyncMutation === 'function') window.enqueueSyncMutation('save', transaction);

    try {
      _suppressRealtimeEvents = true;
      let { error } = await promiseTimeout(
        state.supabaseClient
          .from('transactions')
          .upsert([dbPayload]),
        12000
      );

      // If token expired or auth error, attempt immediate token refresh and retry
      if (error && (error.code === '401' || error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('auth'))) {
        try {
          await state.supabaseClient.auth.refreshSession();
          const retryRes = await promiseTimeout(
            state.supabaseClient
              .from('transactions')
              .upsert([dbPayload]),
            12000
          );
          error = retryRes.error;
        } catch (_) {}
      }



      if (error) {
        console.error(`[CloudSave] Supabase upsert error for ${transaction.id}:`, error);
        if (typeof showSyncToast === 'function') {
          showSyncToast(`⚠️ Cloud Sync: ${error.message || error.code || 'Failed to save to cloud'}`, 5000);
        }
        throw error;
      }

      if (typeof dequeueSyncMutation === 'function') dequeueSyncMutation('save', transaction.id); else if (typeof window !== 'undefined' && typeof window.dequeueSyncMutation === 'function') window.dequeueSyncMutation('save', transaction.id);

      // Notify partner via Cloudflare Function /api/push-notify if transaction is shared
      const partnerUid = state.partnerProfile ? (state.partnerProfile.id || state.partnerProfile.user_id) : null;
      if (partnerUid && transaction.family_id) {
        sendPartnerPushNotification(transaction, partnerUid);
      }
      return true;
    } catch (err) {
      console.warn(`Cloud save failed, keeping in queue: ${transaction.id}`, err);
      return false;
    } finally {
      setTimeout(() => { _suppressRealtimeEvents = false; }, 3000);
    }
  }
  return true;
}

function saveTransactionOffline(transaction) {
  if (!transaction.id) {
    transaction.id = (typeof generateUUID === 'function' ? generateUUID() : ((typeof window !== 'undefined' && typeof window.generateUUID === 'function') ? window.generateUUID() : ('id_' + Date.now())));
  }
  if (!transaction.created_at) {
    transaction.created_at = new Date().toISOString();
  }
  // Incremental sync: stamp updated_at on every local write so the local cache
  // carries a valid cursor baseline. The DB trigger also sets it on cloud UPDATEs.
  transaction.updated_at = new Date().toISOString();
  let trans = [...state.transactions];
  const existingIdx = trans.findIndex(t => t.id === transaction.id);
  if (existingIdx !== -1) {
    const oldTx = trans[existingIdx];
    const oldDate = String(oldTx.date || '').split('T')[0].split(' ')[0];
    const newDate = String(transaction.date || '').split('T')[0].split(' ')[0];

    // If it's a recurring transaction and the date changed, mark the old date as deleted
    // so the generator doesn't recreate it on the old date.
    if (oldDate !== newDate && oldTx.recurring_template_id) {
      const key = `${oldTx.recurring_template_id}_${oldDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
    }

    trans[existingIdx] = transaction;
  } else {
    trans.unshift(transaction);
  }
  state.transactions = trans;
  localStorage.setItem('offline_transactions', JSON.stringify(trans));

  if (!state.currentUser) {
    if (typeof saveOfflineGuestTransactions === 'function') saveOfflineGuestTransactions(trans); else if (typeof window !== 'undefined' && typeof window.saveOfflineGuestTransactions === 'function') window.saveOfflineGuestTransactions(trans);
  }

  // Check category budget limit alert
  if (typeof checkOverBudgetNotification === 'function') {
    if (typeof checkOverBudgetNotification === 'function') checkOverBudgetNotification(transaction); else if (typeof window !== 'undefined' && typeof window.checkOverBudgetNotification === 'function') window.checkOverBudgetNotification(transaction);
  }

  if (typeof triggerHaptic === 'function') {
    triggerHaptic('success');
  } else if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
    window.triggerHaptic('success');
  }
}

function deleteTransaction(id) {
  if (!id) return;

  // Delete only the transaction with this unique id.
  const idsToDelete = [String(id)];

  if (!state.currentUser) {
    const guestTxs = (typeof getOfflineGuestTransactions === 'function' ? getOfflineGuestTransactions() : ((typeof window !== 'undefined' && typeof window.getOfflineGuestTransactions === 'function') ? window.getOfflineGuestTransactions() : [])).filter(t => !idsToDelete.includes(String(t.id)));
    if (typeof saveOfflineGuestTransactions === 'function') saveOfflineGuestTransactions(guestTxs); else if (typeof window !== 'undefined' && typeof window.saveOfflineGuestTransactions === 'function') window.saveOfflineGuestTransactions(guestTxs);
  }

  // 1. Mark all these IDs as deleting
  idsToDelete.forEach(dId => (typeof _deletingTxIds !== 'undefined' ? _deletingTxIds : ((typeof window !== 'undefined' && window._deletingTxIds) ? window._deletingTxIds : (globalThis._deletingTxIds = globalThis._deletingTxIds || new Set()))).add(dId));

  // 2. Clean up local receipt photo from IndexedDB (run in background)
  idsToDelete.forEach(dId => {
    ReceiptStorage.remove(dId).catch(err => {
      console.warn('Failed to remove receipt during transaction delete:', err);
    });
  });

  // Save deleted transactions to Trash
  try {
    const deletedTxs = state.transactions.filter(t => idsToDelete.includes(String(t.id)));
    deletedTxs.forEach(t => {
      state.trashTransactions = state.trashTransactions || [];
      const alreadyInTrash = state.trashTransactions.some(tt => String(tt.id) === String(t.id));
      if (!alreadyInTrash) {
        const trashItem = { ...t, deleted_at: new Date().toISOString() };
        state.trashTransactions.push(trashItem);
      }
    });
    if (state.trashTransactions.length > 100) {
      state.trashTransactions = state.trashTransactions.slice(-100);
    }
    localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));
  } catch (err) {
    console.warn('Failed to save deleted transactions to trash:', err);
  }

  // 3. Optimistically delete from local state and update UI
  idsToDelete.forEach(dId => deleteTransactionOffline(dId, true));
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
  if (typeof updateUI === 'function') updateUI(); else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') window.updateUI();

  if (typeof handleSearchChange === 'function') {
    const searchOverlay = document.getElementById('search-overlay');
    if (searchOverlay && searchOverlay.classList.contains('active')) {
      if (typeof handleSearchChange === 'function') handleSearchChange(false); else if (typeof window !== 'undefined' && typeof window.handleSearchChange === 'function') window.handleSearchChange(false);
    }
  }

  // 4. Perform background delete (status model: soft-delete via status='deleted')
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    // Enqueue immediately before starting the cloud request to prevent data loss if the app is closed/killed
    idsToDelete.forEach(dId => enqueueSyncMutation('delete', dId));

    (async () => {
      try {
        _suppressRealtimeEvents = true;
        // Instead of hard-deleting, mark the transaction as deleted so it can be
        // restored from the trash and stays consistent across all devices.
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString(),
              deleted_by: state.currentUser.id
            })
            .in('id', idsToDelete),
          12000
        );
        if (error) throw error;
        // Keep IDs in _recentlyDeletedTxIds for 30s to guard against Supabase propagation race:
        // loadData() may run shortly after and re-fetch the transaction before the DB confirms the delete.
        idsToDelete.forEach(dId => _markRecentlyDeleted(dId));
        idsToDelete.forEach(dId => dequeueSyncMutation('delete', dId));
        // Incremental sync: record a durable tombstone so other devices can apply
        // this deletion without a full re-fetch. Best-effort; never blocks the delete.
        (typeof writeSyncTombstones === 'function' ? writeSyncTombstones('transactions', idsToDelete) : ((typeof window !== 'undefined' && typeof window.writeSyncTombstones === 'function') ? window.writeSyncTombstones('transactions', idsToDelete) : Promise.resolve())).catch(err => {
          console.warn('Failed to write transaction tombstone:', err);
        });
      } catch (err) {
        console.warn(`Cloud delete failed, keeping in queue:`, idsToDelete, err);
      } finally {
        idsToDelete.forEach(dId => (typeof _deletingTxIds !== 'undefined' ? _deletingTxIds : ((typeof window !== 'undefined' && window._deletingTxIds) ? window._deletingTxIds : (globalThis._deletingTxIds = globalThis._deletingTxIds || new Set()))).delete(dId));
        setTimeout(() => { _suppressRealtimeEvents = false; }, 8000);
      }
    })();
  } else {
    idsToDelete.forEach(dId => (typeof _deletingTxIds !== 'undefined' ? _deletingTxIds : ((typeof window !== 'undefined' && window._deletingTxIds) ? window._deletingTxIds : (globalThis._deletingTxIds = globalThis._deletingTxIds || new Set()))).delete(dId));
  }
}

function deleteTransactionOffline(id, skipSave = false) {
  const tx = state.transactions.find(t => t.id === id);
  if (tx) {
    let templateId = tx.recurring_template_id;
    const txDate = String(tx.date || '').split('T')[0].split(' ')[0];

    if (!templateId && state.recurringTemplates) {
      // Find template matching by content if recurring_template_id is missing
      const match = state.recurringTemplates.find(template => {
        return (parseFloat(tx.amount) || 0).toFixed(2) === (parseFloat(template.amount) || 0).toFixed(2) &&
          tx.type === template.type &&
          isSameCategory(tx.category, template.category) &&
          (tx.account_from || '') === (template.account_from || '');
      });
      if (match) {
        templateId = match.id;
      }
    }

    if (templateId) {
      const key = `${templateId}_${txDate}`;
      if (!state.deletedRecurringDates.includes(key)) {
        state.deletedRecurringDates.push(key);
        localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
      }
      const template = state.recurringTemplates.find(t => t.id === templateId);
      if (template) {
        if (typeof addDeletedDateToTemplate === 'function') addDeletedDateToTemplate(template, txDate); else if (typeof window !== 'undefined' && typeof window.addDeletedDateToTemplate === 'function') window.addDeletedDateToTemplate(template, txDate);
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
        if (state.supabaseClient && state.currentUser) {
          if (typeof enqueueSyncMutation === 'function') enqueueSyncMutation('save_template', template); else if (typeof window !== 'undefined' && typeof window.enqueueSyncMutation === 'function') window.enqueueSyncMutation('save_template', template);
          state.supabaseClient
            .from('recurring_templates')
            .upsert([mapTemplateToDb(template)])
            .then(({ error }) => {
              if (!error) {
                if (typeof dequeueSyncMutation === 'function') dequeueSyncMutation('save_template', template.id); else if (typeof window !== 'undefined' && typeof window.dequeueSyncMutation === 'function') window.dequeueSyncMutation('save_template', template.id);
              }
            });
        }
      }
    }
  }
  // Remove only the transaction with this unique id.
  // Content-based "duplicate" removal was removed because it could delete
  // legitimate identical transactions (same date/amount/category/note).
  state.transactions = state.transactions.filter(t => t.id !== id);
  if (!skipSave) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
  }
  if (typeof triggerHaptic === 'function') {
    triggerHaptic('error');
  } else if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
    window.triggerHaptic('error');
  }
}

  return {
    saveTransaction,
    saveTransactionOffline,
    deleteTransaction,
    deleteTransactionOffline
  };
}));
