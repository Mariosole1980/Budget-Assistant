/**
 * transactionMerge.js
 *
 * Pure, testable transaction-merge logic extracted from app.js.
 *
 * DATA-INTEGRITY PRINCIPLE (project policy):
 *   "Never delete, overwrite or migrate user financial data based on heuristics
 *    unless the identity of the record is provably established. Prefer preserving
 *    data over deduplicating uncertain records."
 *
 * The ONLY safe way to deduplicate two transaction records is by a provable
 * identity: the primary key `id`. Content-based "duplicate" matching
 * (same date/amount/category/note) is NOT a proof of identity — two legitimate,
 * distinct transactions can be identical in every visible field (e.g. two
 * identical coffees on the same day, or a recurring bill entered twice).
 * Collapsing or deleting them destroys real financial data.
 *
 * This module therefore implements an ID-based UNION only. It never drops a
 * record based on its contents. It can only ever KEEP MORE rows than the old
 * content-dedup logic, never fewer.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (used by node:test)
        module.exports = factory();
    } else {
        // Browser global
        root.TransactionMerge = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Build the set of transaction IDs that must be excluded from the merge
     * because they are being deleted (in-flight, recently deleted, or queued).
     *
     * @param {object} deps
     * @param {Set|Array} [deps.deletingTxIds]   IDs actively being deleted right now
     * @param {Set|Array} [deps.recentlyDeletedTxIds] IDs deleted in the last ~30s
     * @param {Array} [deps.syncQueue]           pending sync-queue mutations
     * @returns {Set<string>}
     */
    function collectDeletedIds(deps) {
        const deletedIds = new Set();
        const add = (id) => {
            if (id !== null && id !== undefined && id !== '') {
                deletedIds.add(String(id));
            }
        };

        if (deps && deps.deletingTxIds) {
            deps.deletingTxIds.forEach(add);
        }
        if (deps && deps.recentlyDeletedTxIds) {
            deps.recentlyDeletedTxIds.forEach(add);
        }
        if (deps && Array.isArray(deps.syncQueue)) {
            deps.syncQueue.forEach((item) => {
                if (item && item.action === 'delete' && item.payload) {
                    add(item.payload);
                }
            });
        }
        // DATA-INTEGRITY FIX: exclude permanently-deleted / trashed IDs so the
        // merge can never reintroduce a transaction the user permanently deleted.
        if (deps && deps.permanentlyDeletedTxIds) {
            deps.permanentlyDeletedTxIds.forEach(add);
        }
        return deletedIds;
    }

    /**
     * Merge cloud and local-pending transactions into a single de-duplicated list.
     *
     * Deduplication is performed ONLY by primary key `id` (provable identity).
     * Two records with DIFFERENT ids are always both kept, even if their visible
     * contents are identical. This is the correct, data-preserving behaviour.
     *
     * @param {Array} cloudTransactions
     * @param {Array} localPendingTransactions
     * @param {object} [deps]
     * @param {Set|Array} [deps.deletingTxIds]
     * @param {Set|Array} [deps.recentlyDeletedTxIds]
     * @param {Array} [deps.syncQueue]
     * @returns {Array}
     */
    function mergeAndDeduplicateTransactions(cloudTransactions, localPendingTransactions, deps) {
        const deletedIds = collectDeletedIds(deps || {});

        const idMap = {};

        (cloudTransactions || []).forEach((t) => {
            if (t && t.id && !deletedIds.has(String(t.id))) {
                idMap[t.id] = t;
            }
        });

        (localPendingTransactions || []).forEach((t) => {
            if (t && t.id && !deletedIds.has(String(t.id))) {
                idMap[t.id] = t;
            }
        });

        // NOTE: No content-based dedup here. Records with distinct ids are all kept.
        return Object.values(idMap);
    }

    /**
     * Determine which locally-cached transactions are still "pending" and must be
     * preserved through a sync (they are not yet safely stored in the cloud).
     *
     * @param {Array} cachedTransactions
     * @param {object} [deps]
     * @param {Array} [deps.syncQueue]   pending sync-queue mutations
     * @param {Set|Array} [deps.recentlySavedTxIds] ids saved within the grace window
     * @returns {Array}
     */
    function getPendingLocalTransactions(cachedTransactions, deps) {
        if (!cachedTransactions || !Array.isArray(cachedTransactions)) return [];

        const queuedIds = new Set();
        if (deps && Array.isArray(deps.syncQueue)) {
            deps.syncQueue.forEach((item) => {
                if (item && item.action === 'save' && item.payload && item.payload.id) {
                    queuedIds.add(item.payload.id);
                }
            });
        }

        const recentlySaved = deps && deps.recentlySavedTxIds
            ? deps.recentlySavedTxIds
            : new Set();

        return cachedTransactions.filter((t) => {
            if (!t || typeof t !== 'object') return false;
            if (!t.id) return true;
            if (String(t.id).startsWith('local_')) return true;
            if (t.user_id === null || t.user_id === undefined) return true;

            // Keep if in the offline sync queue (not yet successfully uploaded)
            if (queuedIds.has(t.id)) return true;

            // Keep if recently saved (within the grace window). This protects a just-saved
            // transaction from being dropped when a re-fetch races ahead of the cloud write
            // propagation, even after it has been dequeued from the sync queue.
            if (recentlySaved.has(String(t.id))) return true;

            // If it is not a valid UUID, it is local
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(String(t.id))) return true;

            return false;
        });
    }

    return {
        collectDeletedIds: collectDeletedIds,
        mergeAndDeduplicateTransactions: mergeAndDeduplicateTransactions,
        getPendingLocalTransactions: getPendingLocalTransactions,
    };
});
