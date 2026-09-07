/**
 * ============================================================
 * DATA INTEGRITY, DEDUPLICATION & TOMBSTONE SUBSYSTEM
 * ============================================================
 * Handles category cleanup, safe ID-based duplicate transaction cleaning,
 * permanent-delete tombstone tracking, stale tombstone self-healing,
 * and missing transaction cloud synchronization.
 *
 * Extracted from app.js (Phase 22B Architectural Modularization)
 * ============================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DataIntegrityService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const _PERMANENT_DELETED_LS_KEY = 'permanent_deleted_tx_ids';
  const _RECENTLY_DELETED_LS_KEY = 'recently_deleted_tx_ids';

  function _promiseTimeout(promise, ms) {
    if (typeof promiseTimeout === 'function') return promiseTimeout(promise, ms);
    if (typeof window !== 'undefined' && typeof window.promiseTimeout === 'function') {
      return window.promiseTimeout(promise, ms);
    }
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Promise timed out')), ms))
    ]);
  }

// Scan categories and transactions to clean up duplicates (e.g. Chinese characters)
async function cleanDuplicateCategories() {
  const targetCategoryName = '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ';

  // Find bad categories in the categories list
  const badCategories = state.categories.filter(c => c.name && (
    c.name.includes('茶') ||
    /[\u4e00-\u9fff]/.test(c.name) ||
    (c.name.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && c.name !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
  ));

  // Find bad category names in transactions
  const badCategoryNamesInTrans = new Set();
  state.transactions.forEach(t => {
    if (t.category && (
      t.category.includes('茶') ||
      /[\u4e00-\u9fff]/.test(t.category) ||
      (t.category.includes('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ') && t.category !== '🧾ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ')
    )) {
      badCategoryNamesInTrans.add(t.category);
    }
  });

  if (badCategories.length === 0 && badCategoryNamesInTrans.size === 0) return;

  let didChange = false;
  const isOnline = state.supabaseClient && state.currentUser;

  // 1. Process bad category names in transactions
  for (const badCatName of badCategoryNamesInTrans) {
    try {
      if (isOnline) {
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCatName);
      }

      // Update local state transactions
      state.transactions.forEach(t => {
        if (t.category === badCatName) {
          t.category = targetCategoryName;
        }
      });
      didChange = true;
    } catch (e) {
      console.error(`Error during transaction update for category name "${badCatName}":`, e);
    }
  }

  // 2. Process bad category objects from database list
  for (const badCat of badCategories) {
    try {
      if (isOnline) {
        await state.supabaseClient
          .from('transactions')
          .update({ category: targetCategoryName })
          .eq('category', badCat.name);

        await state.supabaseClient
          .from('categories')
          .delete()
          .eq('id', badCat.id);
      }

      // Update local state transactions (just in case)
      state.transactions.forEach(t => {
        if (t.category === badCat.name) {
          t.category = targetCategoryName;
        }
      });

      // Update local state categories
      state.categories = state.categories.filter(c => c.id !== badCat.id);
      didChange = true;
    } catch (e) {
      console.error(`Error cleaning up bad category object "${badCat.name}":`, e);
    }
  }

  if (didChange) {
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('offline_categories', JSON.stringify(state.categories));
    calculateInitialBalances();
    // Only call updateUI if we're not in the middle of a bulk sync operation
    // (which already schedules its own clean render at the end)
    if (typeof updateUI === 'function' && !_suppressRealtimeEvents) {
      updateUI();
    }
  }
}

// DATA-INTEGRITY SAFETY: This function previously grouped transactions by their
// VISIBLE CONTENTS (date/amount/category/note) and PERMANENTLY DELETED the
// "duplicates" from the cloud. That is unsafe: two legitimate, distinct
// transactions can be identical in every visible field, so content-based
// matching destroys real financial data. Per project policy we NEVER delete or
// overwrite user financial data based on heuristics unless the identity of the
// record is provably established.
//
// The only provable identity is the primary key `id`. Records with DIFFERENT
// ids are never considered duplicates, regardless of identical contents.
// This function now performs a safe, ID-based dedup only (removing records that
// share the exact same id) and NEVER deletes from the cloud.
async function cleanDuplicateTransactions() {
  if (!state.transactions || state.transactions.length === 0) return;

  const seenIds = new Set();
  const localCleaned = [];
  let didChangeLocal = false;

  state.transactions.forEach(t => {
    if (!t) return;
    if (t.id) {
      const idStr = String(t.id);
      if (seenIds.has(idStr)) {
        // Same provable id -> genuine duplicate; keep the first occurrence.
        didChangeLocal = true;
        return;
      }
      seenIds.add(idStr);
    }
    localCleaned.push(t);
  });

  if (didChangeLocal) {
    // Preserve sorting
    localCleaned.sort(compareTransactions);

    state.transactions = localCleaned;
    localStorage.setItem('offline_transactions', JSON.stringify(localCleaned));
    calculateInitialBalances();
    updateUI();
  }

  // NOTE: No cloud deletion is performed here. Cloud-side duplicate cleanup is
  // handled safely by the ID-based merge in js/transactionMerge.js.
}

window.cleanDuplicateTransactions = cleanDuplicateTransactions;

function getPendingLocalTransactions(cachedTransactions) {
  // Delegates to the tested pure implementation in js/transactionMerge.js.
  const deps = {
    syncQueue: readSyncQueueForMerge(),
    recentlySavedTxIds: (typeof _recentlySavedTxIds !== 'undefined' && _recentlySavedTxIds) ? _recentlySavedTxIds : null,
  };
  return window.TransactionMerge.getPendingLocalTransactions(cachedTransactions, deps);
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY HELPER: collect every transaction ID that must NEVER be
// re-uploaded / re-activated / re-introduced into local state.
//
// Sources:
//   1. The trash bin (deleted_transactions_trash) — the ONLY correct key.
//   2. Any transaction in the offline cache with status='deleted'.
//   3. The in-memory recently-deleted set (30s grace window).
//   4. Any queued 'delete' mutation in the sync queue.
//   5. The durable permanent-delete tombstone list (permanent_deleted_tx_ids).
//
// This is deliberately defensive: if the trash key is missing we log a warning
// rather than silently treating the exclusion set as empty, so a future key
// mismatch can never again silently resurrect deleted transactions.
// ---------------------------------------------------------------------------
// _PERMANENT_DELETED_LS_KEY declared at module scope
function collectPermanentlyDeletedTxIds() {
  const excludedIds = new Set();
  const add = (id) => { if (id !== null && id !== undefined && id !== '') excludedIds.add(String(id)); };

  // 1. Trash bin (correct key). Log if the legacy wrong key is present so we
  //    can detect any residual stale data from the old bug.
  try {
    const trash = JSON.parse(localStorage.getItem('deleted_transactions_trash') || '[]') || [];
    trash.forEach(it => { if (it && it.id) add(it.id); });
  } catch (e) { console.warn('[DataIntegrity] Failed to read deleted_transactions_trash:', e); }
  try {
    const legacyTrash = JSON.parse(localStorage.getItem('trash_transactions') || '[]') || [];
    if (legacyTrash.length > 0) {
      console.warn('[DataIntegrity] Legacy trash_transactions key found with', legacyTrash.length, 'items — migrating to deleted_transactions_trash semantics.');
      legacyTrash.forEach(it => { if (it && it.id) add(it.id); });
    }
  } catch (e) { }

  // 2. Offline cache items already marked deleted.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    cache.forEach(t => { if (t && t.status === 'deleted' && t.id) add(t.id); });
  } catch (e) { }

  // 3. Recently-deleted in-memory set.
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) {
    _recentlyDeletedTxIds.forEach(add);
  }

  // 4. Queued 'delete' mutations.
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        add(item.payload);
      }
    });
  } catch (e) { }

  // 5. Durable permanent-delete tombstone list.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    perm.forEach(add);
  } catch (e) { }

  return excludedIds;
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY SELF-HEALING: reconcileStaleTombstones
//
// The cloud is the source of truth for what is ACTIVE. If a transaction is
// reported active by the cloud (status='active') but a stale local tombstone /
// trash entry claims it was permanently deleted, that tombstone is WRONG and
// must be cleaned up. Otherwise the stale tombstone would hide the transaction
// from the UI (the bug that caused "dozens of transactions disappeared from
// web after refresh").
//
// We NEVER clean a tombstone for a transaction that is being deleted RIGHT NOW:
//   * in-flight (_deletingTxIds)
//   * within the recent grace window (_recentlyDeletedTxIds / recently_deleted_tx_ids)
//   * with a pending 'delete' / 'permanent_delete_tx' mutation in the sync queue
//
// Those are legitimate in-progress deletions and must keep their tombstones so
// the cloud soft-delete can propagate. Only STALE tombstones (where the cloud
// still reports the row active and no deletion is in flight) are removed.
//
// @param {Array<{id:string}>} cloudActiveTransactions  transactions the cloud
//        reports as active (status='active')
// @returns {number} number of stale tombstone entries cleaned
// ---------------------------------------------------------------------------
function reconcileStaleTombstones(cloudActiveTransactions) {
  if (!cloudActiveTransactions || !Array.isArray(cloudActiveTransactions) || cloudActiveTransactions.length === 0) {
    return 0;
  }

  // IDs the cloud reports as active.
  const cloudActiveIds = new Set(cloudActiveTransactions.map(t => (t && t.id) ? String(t.id) : null).filter(Boolean));

  // IDs that are legitimately being deleted right now (must keep tombstones).
  const inFlightDeletionIds = new Set();
  const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
  if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
  try {
    const stored = JSON.parse(localStorage.getItem(_RECENTLY_DELETED_LS_KEY) || '{}');
    Object.keys(stored).forEach(addInFlight);
  } catch (_) { }
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        addInFlight(item.payload);
      }
    });
  } catch (_) { }

  // A tombstone ID is stale if the cloud reports it active AND it is not being
  // deleted right now.
  const staleIds = new Set();
  cloudActiveIds.forEach(id => {
    if (!inFlightDeletionIds.has(id)) staleIds.add(id);
  });

  if (staleIds.size === 0) return 0;

  let cleaned = 0;

  // 1. Clean the durable permanent-delete tombstone list.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    const before = perm.length;
    const cleanedPerm = perm.filter(id => !(id && staleIds.has(String(id))));
    if (cleanedPerm.length !== before) {
      localStorage.setItem(_PERMANENT_DELETED_LS_KEY, JSON.stringify(cleanedPerm));
      cleaned += (before - cleanedPerm.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean permanent_deleted_tx_ids:', e); }

  // 2. Clean the trash bin (deleted_transactions_trash).
  try {
    const trash = JSON.parse(localStorage.getItem('deleted_transactions_trash') || '[]') || [];
    const before = trash.length;
    const cleanedTrash = trash.filter(it => !(it && it.id && staleIds.has(String(it.id))));
    if (cleanedTrash.length !== before) {
      localStorage.setItem('deleted_transactions_trash', JSON.stringify(cleanedTrash));
      cleaned += (before - cleanedTrash.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean deleted_transactions_trash:', e); }

  // 3. Clean the legacy trash key (trash_transactions) if present.
  try {
    const legacyTrash = JSON.parse(localStorage.getItem('trash_transactions') || '[]') || [];
    const before = legacyTrash.length;
    const cleanedLegacy = legacyTrash.filter(it => !(it && it.id && staleIds.has(String(it.id))));
    if (cleanedLegacy.length !== before) {
      localStorage.setItem('trash_transactions', JSON.stringify(cleanedLegacy));
      cleaned += (before - cleanedLegacy.length);
    }
  } catch (e) { }

  // 4. Clean status='deleted' entries from the offline cache.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    const before = cache.length;
    const cleanedCache = cache.filter(t => !(t && t.status === 'deleted' && t.id && staleIds.has(String(t.id))));
    if (cleanedCache.length !== before) {
      localStorage.setItem('offline_transactions', JSON.stringify(cleanedCache));
      cleaned += (before - cleanedCache.length);
    }
  } catch (e) { console.warn('[DataIntegrity] reconcileStaleTombstones: failed to clean offline_transactions:', e); }

  if (cleaned > 0) {
    console.info(`[DataIntegrity] reconcileStaleTombstones: cleaned ${cleaned} stale tombstone/trash entries for cloud-active transactions.`);
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// DATA-INTEGRITY HELPER: purge permanently-deleted transaction IDs from every
// local cache and queue so they can never be re-uploaded or re-introduced.
//
//   * state.transactions (in-memory)
//   * offline_transactions (localStorage cache)
//   * money_manager_sync_queue (stale save/upsert mutations for these IDs)
//   * durable permanent-delete tombstone list (permanent_deleted_tx_ids)
//
// Also writes a durable tombstone to the cloud (sync_tombstones) so other
// devices apply the permanent deletion. Best-effort; never blocks the delete.
// ---------------------------------------------------------------------------
function purgePermanentlyDeletedTxIds(ids, { writeCloudTombstone = false } = {}) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids.map(id => String(id)));

  // 1. Remove from in-memory state.
  if (Array.isArray(state.transactions)) {
    const before = state.transactions.length;
    state.transactions = state.transactions.filter(t => !(t && idSet.has(String(t.id))));
    if (state.transactions.length !== before) {
      console.info(`[DataIntegrity] Purged ${before - state.transactions.length} permanently-deleted tx from state.transactions.`);
    }
  }

  // 2. Remove from offline_transactions cache.
  try {
    const cache = JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [];
    const before = cache.length;
    const cleaned = cache.filter(t => !(t && idSet.has(String(t.id))));
    if (cleaned.length !== before) {
      localStorage.setItem('offline_transactions', JSON.stringify(cleaned));
      console.info(`[DataIntegrity] Purged ${before - cleaned.length} permanently-deleted tx from offline_transactions.`);
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to purge offline_transactions:', e); }

  // 3. Remove stale save/upsert mutations for these IDs from the sync queue.
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    const before = queue.length;
    const cleaned = queue.filter(item => {
      if (!item) return false;
      const isDelete = item.action === 'delete' || item.action === 'permanent_delete_tx';
      const itemId = isDelete ? item.payload : (item.payload && item.payload.id ? item.payload.id : item.payload);
      return !(itemId && idSet.has(String(itemId)));
    });
    if (cleaned.length !== before) {
      localStorage.setItem('money_manager_sync_queue', JSON.stringify(cleaned));
      console.info(`[DataIntegrity] Purged ${before - cleaned.length} stale sync-queue mutations for permanently-deleted tx.`);
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to purge sync queue:', e); }

  // 4. Record durable permanent-delete tombstones locally.
  try {
    const perm = JSON.parse(localStorage.getItem(_PERMANENT_DELETED_LS_KEY) || '[]') || [];
    const permSet = new Set(perm.map(id => String(id)));
    let changed = false;
    idSet.forEach(id => { if (!permSet.has(id)) { permSet.add(id); changed = true; } });
    if (changed) {
      localStorage.setItem(_PERMANENT_DELETED_LS_KEY, JSON.stringify(Array.from(permSet)));
    }
  } catch (e) { console.warn('[DataIntegrity] Failed to record permanent-delete tombstone:', e); }

  // 5. Write durable tombstones to the cloud (best-effort).
  if (writeCloudTombstone && state.supabaseClient && state.currentUser) {
    writeSyncTombstones('transactions', Array.from(idSet)).catch(err => {
      console.warn('[DataIntegrity] Failed to write permanent-delete tombstone to cloud:', err);
    });
  }
}

async function autoSyncMissingTransactionsToCloud(cloudTransactions, userId) {
  if (!state.supabaseClient || !userId) return [];
  const cloudIds = new Set((cloudTransactions || []).map(t => String(t.id)));

  // Collect deleted IDs from trash and sync queue so we NEVER resurrect deleted items.
  // Uses the defensive helper (correct key + deleted-status cache + tombstones).
  const excludedIds = collectPermanentlyDeletedTxIds();

  // Only consider active transactions currently in state.transactions
  const localTxs = Array.isArray(state.transactions) ? state.transactions : [];
  const missingInCloud = [];
  const seenMissingIds = new Set();
  localTxs.forEach(t => {
    if (t && t.id && !cloudIds.has(String(t.id)) && !seenMissingIds.has(String(t.id)) && !t.is_demo && !String(t.id).startsWith('demo_')) {
      if (t.status !== 'deleted' && !excludedIds.has(String(t.id))) {
        seenMissingIds.add(String(t.id));
        missingInCloud.push(t);
      }
    }
  });

  if (missingInCloud.length > 0) {
    console.info(`[AutoSync] Uploading ${missingInCloud.length} active local transactions to cloud...`);
    const dbPayloads = missingInCloud.map(mapTransactionToDb).filter(Boolean);
    for (let i = 0; i < dbPayloads.length; i += 50) {
      const batch = dbPayloads.slice(i, i + 50);
      try {
        const { error } = await _promiseTimeout(
          state.supabaseClient.from('transactions').upsert(batch, { onConflict: 'id' }),
          30000
        );
        if (error) {
          console.error('[AutoSync] Cloud batch upload failed:', error);
        } else {
          console.info(`[AutoSync] Successfully uploaded batch of ${batch.length} transactions.`);
        }
      } catch (err) {
        console.error('[AutoSync] Cloud batch upload exception:', err);
      }
    }
    return missingInCloud;
  }
  return [];
}
window.autoSyncMissingTransactionsToCloud = autoSyncMissingTransactionsToCloud;

  // Global browser exports
  if (typeof window !== 'undefined') {
    window._PERMANENT_DELETED_LS_KEY = _PERMANENT_DELETED_LS_KEY;
    window.cleanDuplicateCategories = cleanDuplicateCategories;
    window.cleanDuplicateTransactions = cleanDuplicateTransactions;
    window.getPendingLocalTransactions = getPendingLocalTransactions;
    window.collectPermanentlyDeletedTxIds = collectPermanentlyDeletedTxIds;
    window.reconcileStaleTombstones = reconcileStaleTombstones;
    window.purgePermanentlyDeletedTxIds = purgePermanentlyDeletedTxIds;
    window.autoSyncMissingTransactionsToCloud = autoSyncMissingTransactionsToCloud;
  }

  return {
    _PERMANENT_DELETED_LS_KEY,
    _RECENTLY_DELETED_LS_KEY,
    cleanDuplicateCategories,
    cleanDuplicateTransactions,
    getPendingLocalTransactions,
    collectPermanentlyDeletedTxIds,
    reconcileStaleTombstones,
    purgePermanentlyDeletedTxIds,
    autoSyncMissingTransactionsToCloud
  };
}));
