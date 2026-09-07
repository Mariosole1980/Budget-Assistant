/**
 * Offline Sync Queue Subsystem
 * Extracted from app.js (Phase 19B Architectural Modularization)
 * Manages queued mutations (save, delete, templates, notes), retry logic, and background processing.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SyncQueueService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function enqueueSyncMutation(action, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    const isDelete = action === 'delete' || action === 'delete_template' || action === 'delete_note' || action === 'permanent_delete_note';
    const itemId = isDelete ? payload : (payload && payload.id ? payload.id : payload);

    // Clean up duplicate saves/updates in queue if we are now deleting
    let cleanQueue = queue.filter(item => {
      const itemIsDelete = item.action === 'delete' || item.action === 'delete_template' || item.action === 'delete_note' || item.action === 'permanent_delete_note';
      const itemKey = itemIsDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      const isSaveAction = item.action === 'save' || item.action === 'save_template' || item.action === 'save_note' || item.action === 'restore_note';
      return !(itemKey === itemId && isSaveAction && isDelete);
    });

    cleanQueue.push({
      id: generateUUID(),
      action,
      payload,
      timestamp: Date.now()
    });

    localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to enqueue sync mutation:', err);
  }
}

function dequeueSyncMutation(action, itemId) {
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    const cleanQueue = queue.filter(item => {
      const itemIsDelete = item.action === 'delete' || item.action === 'delete_template' || item.action === 'delete_note' || item.action === 'permanent_delete_note' || item.action === 'restore_note' || item.action === 'upsert';
      const itemKey = itemIsDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      return !(item.action === action && itemKey === itemId);
    });
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to dequeue sync mutation:', err);
  }
}

let _isProcessingSyncQueue = false;

// skipReload: when true, do NOT call loadData/updateUI after processing (used by forceSyncNow
// which handles its own full re-fetch and UI update, preventing double renders).
async function processSyncQueue(options = {}) {
  const skipReload = !!options.skipReload;
  if (_isProcessingSyncQueue) return;
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;

  const queueStr = localStorage.getItem('money_manager_sync_queue');
  if (!queueStr) return;

  let queue = [];
  try {
    queue = JSON.parse(queueStr) || [];
  } catch (e) {
    console.error('Failed to parse sync queue:', e);
    return;
  }

  if (queue.length === 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  _isProcessingSyncQueue = true;

  // Durable tombstone guard: any queued mutation whose target transaction has been
  // permanently deleted must be dropped, so a stale queued 'save'/'upsert' can never
  // resurrect a permanently-deleted transaction on the cloud.
  let permanentlyDeletedSet = null;
  try {
    permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
  } catch (err) {
    console.warn('Failed to collect permanently deleted IDs in processSyncQueue:', err);
  }

  let successCount = 0;
  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    let itemSucceeded = false;
    try {
      if (item.action === 'save') {
        const transaction = item.payload;
        if (!transaction || !transaction.id) {
          console.warn('Skipping invalid sync queue item (missing payload or id):', item);
          continue;
        }
        // Drop stale save mutations for permanently-deleted transactions.
        if (permanentlyDeletedSet && permanentlyDeletedSet.has(String(transaction.id))) {
          console.warn('Dropping stale sync queue save for permanently-deleted transaction:', transaction.id);
          continue;
        }
        const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...dbPayload } = mapTransactionToDb(transaction);

        // PREMIUM GATE: Free plan allows up to PREMIUM_LIMITS.cloudTxPerMonth
        // cloud-synced transactions per month. If at the limit and not Premium,
        // defer this save (keep it in the queue for later) instead of syncing.
        if (!isPremium()) {
          try {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const { count } = await promiseTimeout(
              state.supabaseClient
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', state.currentUser.id)
                .eq('status', 'active')
                .gte('created_at', monthStart.toISOString())
                .then(r => r),
              8000
            ).catch(() => ({ count: 0 }));
            if ((count || 0) >= PREMIUM_LIMITS.cloudTxPerMonth) {
              // Keep the item queued for later (do not drop it).
              remaining.push(item);
              showSyncToast(
                state.lang === 'el'
                  ? `⭐ Έφτασες το μηνιαίο όριο cloud (${PREMIUM_LIMITS.cloudTxPerMonth}). Η κίνηση μένει τοπικά. Αναβάθμισε σε Premium για απεριόριστες κινήσεις!`
                  : `⭐ You reached the monthly cloud limit (${PREMIUM_LIMITS.cloudTxPerMonth}). The transaction stays local. Upgrade to Premium for unlimited transactions!`,
                4000
              );
              continue;
            }
          } catch (err) {
            console.warn('Cloud limit check failed in processSyncQueue:', err);
          }
        }

        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .upsert([dbPayload]),
          15000
        );

        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue item:`, error);
          
          const isFkFamily = error.message && error.message.includes('transactions_family_id_fkey');
          if (isFkFamily && state.currentUser) {
            // Auto-heal: The user's cached family_id is stale (e.g. they left or recreated a family on another device).
            // We fetch their fresh profile, update the transaction to match their real current status, and keep it in the queue to retry.
            console.log('[Auto-Heal] Refreshing profile to fix stale family_id constraint...');
            if (typeof loadUserProfiles === 'function') {
              await loadUserProfiles(state.currentUser);
            }
            // Update the transaction in local memory to use the correct family_id (or null if they have no family anymore)
            const freshFamilyId = state.userProfile ? state.userProfile.family_id : null;
            transaction.family_id = freshFamilyId;
            transaction.is_shared = !!freshFamilyId;
            item.payload = transaction;
            
            // Apply it to the local cache too so the UI updates
            const localIndex = state.transactions.findIndex(t => t.id === transaction.id);
            if (localIndex !== -1) {
              state.transactions[localIndex].family_id = freshFamilyId;
              state.transactions[localIndex].is_shared = !!freshFamilyId;
              localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
              if (typeof flushUI === 'function') flushUI();
            }
            
            // Push back to remaining to retry on the next sync cycle
            remaining.push(item);
            continue;
          }

          // Drop permanent schema / type errors (e.g. invalid UUID 22P02) so they don't block the queue forever
          const isPermanent = error.code === '22P02' ||
            (error.message && (error.message.includes('uuid') || error.message.includes('syntax') || error.message.includes('violates foreign key')));
          
          if (!isPermanent) {
            remaining.push(item);
          } else {
            // It is an unrecoverable permanent error. Drop it from the queue AND remove the "ghost" from the UI.
            console.error('[Sync] Dropping unrecoverable transaction from queue AND local cache:', transaction.id);
            if (typeof deleteTransactionOffline === 'function') {
              deleteTransactionOffline(transaction.id, true);
              if (typeof flushUI === 'function') flushUI();
            }
            if (typeof showSyncToast === 'function') {
              const msg = state.lang === 'el' 
                ? '❌ Σφάλμα: Μία συναλλαγή διαγράφηκε λόγω μη έγκυρων δεδομένων.' 
                : '❌ Sync failed: A transaction was deleted due to invalid data.';
              showSyncToast(msg, 5000);
            }
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete') {
        const transId = item.payload;
        if (!transId || String(transId).startsWith('recurring_')) {
          console.warn('Skipping invalid sync queue delete item (missing or non-uuid id):', item);
          continue;
        }
        // Status model: offline deletes soft-delete via status='deleted' so the
        // transaction stays restorable in the trash across all devices.
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString(),
              deleted_by: state.currentUser.id
            })
            .eq('id', transId),
          15000
        );

        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue delete item:`, error);
          const isPermanent = error.code === '22P02' || (error.message && error.message.includes('uuid'));
          if (!isPermanent) {
            remaining.push(item);
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'save_template') {
        const template = item.payload;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('recurring_templates')
            .upsert([mapTemplateToDb(template)]),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid save_template queue item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete_template') {
        const templateId = item.payload;
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('recurring_templates')
            .delete()
            .eq('id', templateId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid delete_template queue item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'upsert') {
        // Restore-from-trash queued action. The payload is the transaction id.
        // The transaction was soft-deleted (status='deleted'); restoring flips it
        // back to 'active' so it reappears on all devices.
        const transId = item.payload;
        if (!transId) {
          console.warn('Skipping invalid sync queue upsert item (missing id):', item);
          continue;
        }
        // Drop stale restore mutations for permanently-deleted transactions — a
        // permanently-deleted transaction must never be re-activated.
        if (permanentlyDeletedSet && permanentlyDeletedSet.has(String(transId))) {
          console.warn('Dropping stale sync queue upsert (restore) for permanently-deleted transaction:', transId);
          continue;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({ status: 'active', deleted_at: null, deleted_by: null })
            .eq('id', transId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue upsert item:`, error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'save_note') {
        const note = item.payload;
        if (!note || !note.id) {
          console.warn('Skipping invalid save_note queue item:', item);
          continue;
        }
        const familyId = state.userProfile ? state.userProfile.family_id : null;
        const dbRecord = mapNoteToDb(note, state.currentUser.id, familyId);
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .upsert([dbRecord]),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid save_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid delete_note queue item:', item);
          continue;
        }
        const now = new Date().toISOString();
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .update({
              status: 'deleted',
              deleted_at: now,
              deleted_by: state.currentUser.id,
              updated_at: now
            })
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid delete_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'permanent_delete_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid permanent_delete_note queue item:', item);
          continue;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .delete()
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid permanent_delete_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'restore_note') {
        const noteId = item.payload;
        if (!noteId) {
          console.warn('Skipping invalid restore_note queue item:', item);
          continue;
        }
        const now = new Date().toISOString();
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('notes')
            .update({
              status: 'active',
              deleted_at: null,
              deleted_by: null,
              updated_at: now
            })
            .eq('id', noteId),
          15000
        );
        if (error) {
          if (error.message && (error.message.includes('Fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
          }
          console.warn('Skipping invalid restore_note queue item:', error);
          remaining.push(item);
          continue;
        }
        itemSucceeded = true;
      } else {
        console.warn(`Unknown sync queue action, dropping item:`, item.action);
        continue;
      }
    } catch (err) {
      console.warn(`Network failure during sync queue replay at index ${i}:`, err);
      // Keep this item and all remaining ones for retry to preserve sequence order.
      remaining.push(item);
      for (let j = i + 1; j < queue.length; j++) {
        remaining.push(queue[j]);
      }
      break;
    }

    if (itemSucceeded) {
      successCount++;
    }
  }

  const queueChanged = remaining.length !== queue.length;
  if (successCount > 0 || queueChanged) {
    localStorage.setItem('money_manager_sync_queue', JSON.stringify(remaining));
  }
  state.syncPendingCount = remaining.length;
  updateSyncStatusIndicator();

  // Only reload and render here if the caller didn't request to skip it.
  // When called from forceSyncNow, skipReload=true because forceSyncNow does its own
  // full fetch + UI update immediately after, so we avoid a double render.
  if (successCount > 0 && !skipReload) {
    await loadData();
    updateUI();
  }

  _isProcessingSyncQueue = false;
}

  // Bind live state getter to window for backward compatibility
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, '_isProcessingSyncQueue', {
        get: function () { return _isProcessingSyncQueue; },
        set: function (v) { _isProcessingSyncQueue = v; },
        configurable: true
      });
    } catch (e) {}
  }

  return {
    enqueueSyncMutation,
    dequeueSyncMutation,
    processSyncQueue,
    isProcessingSyncQueue: function () { return _isProcessingSyncQueue; }
  };
}));
