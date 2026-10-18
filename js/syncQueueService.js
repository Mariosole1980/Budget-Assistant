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

  // ---------------------------------------------------------------------------
  // Queue storage keys, retry policy and shared helpers
  // ---------------------------------------------------------------------------
  // Every Supabase call costs quota/egress, so the queue must never hammer the
  // backend with a mutation that cannot succeed. Failed items get an exponential
  // backoff (persisted in localStorage) and, when the error is permanent, they
  // are moved to a local quarantine list instead of being retried forever.
  const SYNC_QUEUE_KEY = 'money_manager_sync_queue';
  const SYNC_DEAD_QUEUE_KEY = 'money_manager_sync_queue_dead';
  const MAX_QUARANTINED_ITEMS = 25;
  const RETRY_BASE_DELAY_MS = 15000;            // 15 seconds
  const RETRY_MAX_DELAY_MS = 30 * 60 * 1000;    // 30 minutes
  const CLOUD_TX_LIMIT_TTL_MS = 10 * 60 * 1000; // cache the free-plan usage check
  const QUARANTINE_TOAST_THROTTLE_MS = 10 * 60 * 1000;
  const PREMIUM_TOAST_THROTTLE_MS = 30 * 60 * 1000;

  const SAVE_LIKE_ACTIONS = ['save', 'save_template', 'save_note', 'restore_note'];
  const DELETE_LIKE_ACTIONS = ['delete', 'delete_template', 'delete_note', 'permanent_delete_note', 'delete_category', 'upsert'];

  let _cloudTxLimitCache = { key: null, at: 0, atLimit: false };
  let _lastQuarantineToastAt = 0;
  let _lastPremiumDeferralToastAt = 0;

  function _queueItemId(payload) {
    if (payload && typeof payload === 'object') {
      return payload.id != null ? String(payload.id) : '';
    }
    return payload != null ? String(payload) : '';
  }

  function _readQueue() {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Failed to parse sync queue:', err);
      return [];
    }
  }

  function _errorText(error) {
    if (!error) return '';
    return [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  // Errors that may succeed on a later attempt (network hiccups, server overload,
  // schema-cache reloads). Recognised in one place so every queue action behaves
  // the same way.
  function _isConnectivityError(error) {
    if (!error) return false;
    const code = String(error.code || '').toUpperCase();
    if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND' ||
        code === '57014' || code === '53300' || code === '40001' || code === '40P01' ||
        code === '429' || code === '500' || code === '502' || code === '503' || code === '504' ||
        code === 'PGRST000' || code === 'PGRST002' || code === 'PGRST003') {
      return true;
    }
    const text = _errorText(error);
    return text.includes('fetch') || text.includes('network') || text.includes('timeout') ||
      text.includes('timed out') || text.includes('abort') || text.includes('connection') ||
      text.includes('econnreset');
  }

  function _isAuthError(error) {
    if (!error) return false;
    const code = String(error.code || '');
    if (code === '401' || code === '403' || code === '42501') return true;
    const text = _errorText(error);
    return text.includes('row-level security') || text.includes('jwt') ||
      text.includes('token') || text.includes('security policy') ||
      text.includes('permission denied');
  }

  /**
   * Returns 'permanent' when retrying can never succeed (schema/constraint/data
   * errors), 'auth' for expired sessions and 'transient' for everything else.
   * Unknown errors are treated as transient but still get exponential backoff,
   * so they can never cause a request storm.
   */
  function _classifySyncError(error) {
    if (!error) return 'transient';
    if (_isAuthError(error)) return 'auth';

    const code = String(error.code || '').toUpperCase();
    const text = _errorText(error);

    // PostgREST: 204 = column not found, 205 = table not found, 202/102 = cache/signature mismatch.
    if (code === 'PGRST204' || code === 'PGRST205' || code === 'PGRST202' || code === 'PGRST102') {
      return 'permanent';
    }
    // Postgres 22xxx = data exception, 23xxx = integrity constraint, 42xxx = syntax/undefined object.
    if (/^(22|23|42)/.test(code)) return 'permanent';

    if (text.includes('schema cache') || text.includes('invalid input syntax') ||
        text.includes('violates ') || text.includes('does not exist') ||
        text.includes('syntax error') || text.includes('null value in column') ||
        text.includes('value too long')) {
      return 'permanent';
    }

    if (_isConnectivityError(error)) return 'transient';
    return 'transient';
  }

  // Persist the next allowed attempt time on the item itself. Because the queue
  // is serialised to localStorage, the backoff survives reloads/app restarts.
  function _scheduleRetry(item) {
    item.attempts = (item.attempts || 0) + 1;
    const delay = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, item.attempts - 1), RETRY_MAX_DELAY_MS);
    item.nextAttemptAt = Date.now() + delay;
    return delay;
  }

  function _isItemDue(item, now) {
    if (!item) return false;
    return !item.nextAttemptAt || item.nextAttemptAt <= now;
  }

  // Move an un-syncable item to a local quarantine list. The user's data is NOT
  // deleted locally - it simply stops being pushed to the cloud.
  function _quarantineItem(item, error) {
    try {
      let dead = [];
      try {
        const raw = localStorage.getItem(SYNC_DEAD_QUEUE_KEY);
        dead = raw ? JSON.parse(raw) : [];
      } catch (e) {
        dead = [];
      }
      if (!Array.isArray(dead)) dead = [];
      dead.push({
        action: item && item.action,
        payloadId: _queueItemId(item && item.payload),
        // Full payload is kept so a future fix (e.g. a schema migration) can
        // requeue these items without any data loss.
        payload: item ? item.payload : null,
        attempts: (item && item.attempts) || 0,
        errorCode: error && error.code ? String(error.code) : '',
        errorMessage: error ? String(error.message || error).slice(0, 300) : '',
        quarantinedAt: Date.now()
      });
      while (dead.length > MAX_QUARANTINED_ITEMS) dead.shift();
      localStorage.setItem(SYNC_DEAD_QUEUE_KEY, JSON.stringify(dead));
    } catch (e) {
      console.warn('[SyncQueue] Failed to persist quarantined item:', e);
    }
    console.error('[SyncQueue] Quarantined un-syncable mutation (will not be retried):',
      item && item.action, error && error.code, error && error.message);
  }

  function _notifyQuarantine(count) {
    if (!count || count <= 0) return;
    const now = Date.now();
    if (now - _lastQuarantineToastAt < QUARANTINE_TOAST_THROTTLE_MS) return;
    if (typeof showSyncToast !== 'function') return;
    _lastQuarantineToastAt = now;
    const lang = (typeof state !== 'undefined' && state && state.lang) || 'el';
    const msg = lang === 'en'
      ? `⚠️ ${count} change(s) could not be synced (data error). They stay saved on this device.`
      : `⚠️ ${count} αλλαγή(-ές) δεν μπόρεσαν να συγχρονιστούν (σφάλμα δεδομένων). Παραμένουν αποθηκευμένες σε αυτή τη συσκευή.`;
    try {
      showSyncToast(msg, 6000);
    } catch (e) { /* a toast must never break the queue */ }
  }

  /**
   * Free-plan guard, cached for CLOUD_TX_LIMIT_TTL_MS. Without the cache every
   * queued save would run a count(*) query on every worker tick.
   */
  async function _freeCloudTxLimitReached(userId) {
    if (typeof isPremium === 'function' && isPremium()) return false;
    if (typeof PREMIUM_LIMITS === 'undefined' || !PREMIUM_LIMITS || !PREMIUM_LIMITS.cloudTxPerMonth) return false;
    if (!state.supabaseClient || !state.currentUser) return false;

    const now = new Date();
    const cacheKey = `${userId}:${now.getFullYear()}-${now.getMonth() + 1}`;
    if (_cloudTxLimitCache.key === cacheKey && (Date.now() - _cloudTxLimitCache.at) < CLOUD_TX_LIMIT_TTL_MS) {
      return _cloudTxLimitCache.atLimit;
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const timeoutFn = typeof promiseTimeout === 'function' ? promiseTimeout : function (p) { return p; };
    try {
      const res = await timeoutFn(
        state.supabaseClient
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .gte('created_at', monthStart.toISOString()),
        8000
      );
      if (res && res.error) throw res.error;
      const reached = ((res && res.count) || 0) >= PREMIUM_LIMITS.cloudTxPerMonth;
      _cloudTxLimitCache = { key: cacheKey, at: Date.now(), atLimit: reached };
      return reached;
    } catch (err) {
      // Never block syncing because the usage check failed.
      console.warn('[SyncQueue] Cloud usage check failed, allowing sync attempt:', err);
      return false;
    }
  }

  /**
   * True when at least one queued mutation may hit the network now. Used by the
   * background worker to skip whole cycles while items are in exponential
   * backoff (zero Supabase requests, zero quota consumption).
   */
  function hasDueSyncItems(now) {
    const at = typeof now === 'number' ? now : Date.now();
    const queue = _readQueue();
    if (queue.length === 0) return false;
    return queue.some(function (item) { return _isItemDue(item, at); });
  }

  function getQuarantinedSyncItems() {
    try {
      const raw = localStorage.getItem(SYNC_DEAD_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function clearQuarantinedSyncItems() {
    try {
      localStorage.removeItem(SYNC_DEAD_QUEUE_KEY);
    } catch (e) {}
  }

  /**
   * Clears the per-item backoff so pending mutations retry immediately. Used when
   * connectivity is restored. Premium deferrals are preserved so the free-plan
   * usage query is not repeated without reason.
   */
  function resetSyncQueueBackoff() {
    try {
      const queue = _readQueue();
      let changed = 0;
      queue.forEach(function (item) {
        if (!item || item.deferredReason === 'premium') return;
        if (item.nextAttemptAt || item.attempts) {
          delete item.nextAttemptAt;
          item.attempts = 0;
          changed++;
        }
      });
      if (changed > 0) localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      return changed;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Moves quarantined mutations back into the active queue (e.g. after a schema
   * migration fixed the underlying error). Returns the number of requeued items.
   * Never called automatically, so it cannot create request storms.
   */
  function requeueQuarantinedSyncItems() {
    try {
      const dead = getQuarantinedSyncItems();
      if (dead.length === 0) return 0;
      const queue = _readQueue();
      let requeued = 0;
      dead.forEach(function (entry) {
        if (!entry || !entry.action || entry.payload === undefined || entry.payload === null) return;
        queue.push({
          id: generateUUID(),
          action: entry.action,
          payload: entry.payload,
          timestamp: Date.now(),
          attempts: 0
        });
        requeued++;
      });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      localStorage.removeItem(SYNC_DEAD_QUEUE_KEY);
      return requeued;
    } catch (e) {
      console.warn('[SyncQueue] Failed to requeue quarantined items:', e);
      return 0;
    }
  }

  function enqueueSyncMutation(action, payload) {
  try {
    const queue = _readQueue();
    const isDelete = DELETE_LIKE_ACTIONS.indexOf(action) !== -1;
    const isSave = SAVE_LIKE_ACTIONS.indexOf(action) !== -1;
    const itemId = _queueItemId(payload);

    // Dedupe so the queue cannot grow with redundant work (each redundant item
    // costs a Supabase request):
    //  - a pending save for the same entity is replaced by the newest payload;
    //  - a delete/restore supersedes any queued save of the same entity;
    //  - repeated deletes/restores of the same entity collapse into one item.
    let cleanQueue = queue;
    if (itemId) {
      cleanQueue = queue.filter(item => {
        if (!item || item.action == null) return true;
        if (_queueItemId(item.payload) !== itemId) return true;

        const itemIsDelete = DELETE_LIKE_ACTIONS.indexOf(item.action) !== -1;
        const itemIsSave = SAVE_LIKE_ACTIONS.indexOf(item.action) !== -1;

        if (isDelete) {
          // Drop queued saves and duplicate delete/restore items for this entity.
          return !(itemIsDelete || itemIsSave);
        }
        if (isSave) {
          // Replace an earlier queued write of the same kind for this entity.
          return item.action !== action;
        }
        return item.action !== action;
      });
    }

    cleanQueue.push({
      id: generateUUID(),
      action,
      payload,
      timestamp: Date.now(),
      attempts: 0
    });

    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to enqueue sync mutation:', err);
  }
}

function dequeueSyncMutation(action, itemId) {
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    const cleanQueue = queue.filter(item => {
      const itemIsDelete = item.action === 'delete' || item.action === 'delete_template' || item.action === 'delete_note' || item.action === 'permanent_delete_note' || item.action === 'restore_note' || item.action === 'upsert' || item.action === 'delete_category';
      const itemKey = itemIsDelete ? (item.payload && item.payload.id ? item.payload.id : item.payload) : (item.payload && item.payload.id ? item.payload.id : item.payload);
      return !(item.action === action && itemKey === itemId);
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(cleanQueue));
  } catch (err) {
    console.error('Failed to dequeue sync mutation:', err);
  }
}

let _isProcessingSyncQueue = false;

// skipReload: when true, do NOT call loadData/updateUI after processing (used by forceSyncNow
// which handles its own full re-fetch and UI update, preventing double renders).
async function processSyncQueue(options = {}) {
  const skipReload = !!options.skipReload;
  const summary = { processed: 0, quarantined: 0, deferredPremium: 0, retryScheduled: 0, pending: 0, skipped: false };

  if (_isProcessingSyncQueue) { summary.skipped = true; return summary; }
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) { summary.skipped = true; return summary; }

  const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
  if (!queueStr) return summary;

  let queue = [];
  try {
    queue = JSON.parse(queueStr) || [];
  } catch (e) {
    console.error('Failed to parse sync queue:', e);
    return summary;
  }

  if (!Array.isArray(queue) || queue.length === 0) return summary;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { summary.skipped = true; return summary; }

  _isProcessingSyncQueue = true;

  try {
  // A Premium upgrade must immediately release items that were deferred by the
  // free-plan limit, otherwise they would wait for the next limit-cache expiry.
  const premiumUser = (typeof isPremium === 'function') ? !!isPremium() : true;
  if (premiumUser) {
    queue.forEach(item => {
      if (item && item.deferredReason === 'premium') {
        delete item.deferredReason;
        delete item.nextAttemptAt;
      }
    });
  }

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
  let quarantinedCount = 0;
  let premiumDeferredCount = 0;
  let retryScheduledCount = 0;
  let anyAttempted = false;
  const runStartedAt = Date.now();
  const remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (!item) continue;
    // Exponential backoff: skip items whose next attempt is still in the future
    // WITHOUT touching the network. This is what stops a single un-syncable row
    // from generating a Supabase request on every worker tick.
    if (!_isItemDue(item, runStartedAt)) {
      remaining.push(item);
      continue;
    }
    anyAttempted = true;
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

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (state.currentUser && state.currentUser.id) {
          dbPayload.user_id = state.currentUser.id;
          if (transaction) transaction.user_id = state.currentUser.id;
        }
        if (!uuidRegex.test(String(dbPayload.id))) {
          const genUuid = typeof generateUUID === 'function' ? generateUUID : (typeof FormatUtils !== 'undefined' && typeof FormatUtils.generateUUID === 'function' ? FormatUtils.generateUUID : null);
          const newId = genUuid ? genUuid() : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'));
          dbPayload.id = newId;
          if (transaction) transaction.id = newId;
        }

        // PREMIUM GATE: Free plan allows up to PREMIUM_LIMITS.cloudTxPerMonth
        // cloud-synced transactions per month. If at the limit and not Premium,
        // defer this save (keep it in the queue for later) instead of syncing.
        const premiumNow = (typeof isPremium === 'function') ? isPremium() : true;
        const freeLimitReached = !premiumNow && await _freeCloudTxLimitReached(state.currentUser.id);
        if (freeLimitReached) {
              // Keep the item queued for later (do not drop it) and re-check the
              // usage only after the cache expires, so the count query is not
              // repeated for every queued transaction on every tick.
              item.deferredReason = 'premium';
              item.nextAttemptAt = Date.now() + CLOUD_TX_LIMIT_TTL_MS;
              remaining.push(item);
              premiumDeferredCount++;
              if (typeof showSyncToast === 'function' && (Date.now() - _lastPremiumDeferralToastAt) > PREMIUM_TOAST_THROTTLE_MS) {
                _lastPremiumDeferralToastAt = Date.now();
                try {
                  showSyncToast(
                state.lang === 'el'
                  ? `⭐ Έφτασες το μηνιαίο όριο cloud (${PREMIUM_LIMITS.cloudTxPerMonth}). Η κίνηση μένει τοπικά. Αναβάθμισε σε Premium για απεριόριστες κινήσεις!`
                  : `⭐ You reached the monthly cloud limit (${PREMIUM_LIMITS.cloudTxPerMonth}). The transaction stays local. Upgrade to Premium for unlimited transactions!`,
                    4000
                  );
                } catch (e) { /* a toast must never break the queue */ }
              }
              continue;
        }

        let { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .upsert([dbPayload]),
          15000
        );

        if (error) {
          const isAuthOrRls = (
            (typeof isSupabaseAuthOrRlsError === 'function' && isSupabaseAuthOrRlsError(error)) ||
            (typeof window !== 'undefined' && typeof window.isSupabaseAuthOrRlsError === 'function' && window.isSupabaseAuthOrRlsError(error)) ||
            error.code === '401' || error.code === '403' || error.code === '42501' ||
            (error.message && (error.message.includes('row-level security') || error.message.includes('JWT') || error.message.includes('token') || error.message.includes('auth') || error.message.includes('security policy')))
          );
          if (isAuthOrRls) {
            try {
              let refreshedSession = null;
              if (typeof ensureAuthenticatedSession === 'function') {
                refreshedSession = await ensureAuthenticatedSession();
              } else if (typeof window !== 'undefined' && typeof window.ensureAuthenticatedSession === 'function') {
                refreshedSession = await window.ensureAuthenticatedSession();
              } else if (state.supabaseClient?.auth) {
                const r = await state.supabaseClient.auth.refreshSession();
                refreshedSession = r?.data?.session;
              }
              if (refreshedSession) {
                const retryRes = await promiseTimeout(
                  state.supabaseClient.from('transactions').upsert([dbPayload]),
                  15000
                );
                error = retryRes.error;
              }
            } catch (_) {}
          }
        }

        if (error) {
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue item:`, error);
          
          const isFkFamily = error.message && error.message.includes('transactions_family_id_fkey');
          if (isFkFamily && state.currentUser && !item.familyHealAttempted) {
            // Auto-heal once per queued item: the profile refresh below costs an
            // extra query, so a permanently broken row must never trigger it on
            // every worker tick.
            item.familyHealAttempted = true;
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
            
            // Push back to remaining to retry later, with exponential backoff.
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
            continue;
          }

          if (_classifySyncError(error) === 'permanent') {
            // Un-syncable row (schema / constraint / data error). Stop retrying
            // it, keep the local data untouched and show one throttled notice.
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete') {
        const transId = item.payload;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!transId || String(transId).startsWith('recurring_') || !uuidRegex.test(String(transId))) {
          console.warn('Skipping invalid or non-UUID sync queue delete item:', item);
          itemSucceeded = true;
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue delete item:`, error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'save_template') {
        const template = item.payload;
        const dbTemplate = mapTemplateToDb(template);
        if (state.currentUser && state.currentUser.id && dbTemplate) {
          dbTemplate.user_id = state.currentUser.id;
          if (template) template.user_id = state.currentUser.id;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('recurring_templates')
            .upsert([dbTemplate]),
          15000
        );
        if (error) {
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn(`Skipping invalid save_template queue item:`, error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn(`Skipping invalid delete_template queue item:`, error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn(`Skipping invalid sync queue upsert item:`, error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn('Skipping invalid save_note queue item:', error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn('Skipping invalid delete_note queue item:', error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn('Skipping invalid permanent_delete_note queue item:', error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
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
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn('Skipping invalid restore_note queue item:', error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }
          continue;
        }
        itemSucceeded = true;
      } else if (item.action === 'delete_category') {
        const catPayload = item.payload;
        const catId = (catPayload && typeof catPayload === 'object' && catPayload.id) ? catPayload.id : catPayload;
        if (!catId) {
          console.warn('Skipping invalid delete_category queue item:', item);
          continue;
        }
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('categories')
            .delete()
            .eq('id', catId),
          15000
        );
        if (error) {
          if (_isConnectivityError(error)) {
            throw error;
          }
          console.warn('Skipping invalid delete_category queue item:', error);
          if (_classifySyncError(error) === 'permanent') {
            _quarantineItem(item, error);
            quarantinedCount++;
          } else {
            _scheduleRetry(item);
            retryScheduledCount++;
            remaining.push(item);
          }

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
      // The failing item is backed off so an unreachable backend is not hammered
      // on every worker tick; the items after it keep their own schedule.
      _scheduleRetry(item);
      retryScheduledCount++;
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

  // Persist the queue whenever we actually touched an item (backoff timestamps,
  // quarantine removals, successes). Purely skipped cycles do not write.
  if (anyAttempted) {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    } catch (err) {
      console.error('Failed to persist sync queue:', err);
    }
  }
  state.syncPendingCount = remaining.length;
  try {
    updateSyncStatusIndicator();
  } catch (err) {
    console.warn('[SyncQueue] Failed to update sync indicator:', err);
  }

  summary.processed = successCount;
  summary.quarantined = quarantinedCount;
  summary.deferredPremium = premiumDeferredCount;
  summary.retryScheduled = retryScheduledCount;
  summary.pending = remaining.length;

  if (quarantinedCount > 0) {
    _notifyQuarantine(quarantinedCount);
  }

  // Only reload and render here if the caller didn't request to skip it.
  // When called from forceSyncNow, skipReload=true because forceSyncNow does its own
  // full fetch + UI update immediately after, so we avoid a double render.
  if (successCount > 0 && !skipReload) {
    try {
      await loadData();
      updateUI();
    } catch (err) {
      // A failed reload must not leave the processing flag stuck.
      console.warn('[SyncQueue] Post-sync reload failed:', err);
    }
  }

  return summary;
  } catch (err) {
    console.error('[SyncQueue] Unexpected failure while processing the sync queue:', err);
    summary.pending = summary.pending || 0;
    return summary;
  } finally {
    _isProcessingSyncQueue = false;
  }
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
    isProcessingSyncQueue: function () { return _isProcessingSyncQueue; },
    hasDueSyncItems,
    resetSyncQueueBackoff,
    getQuarantinedSyncItems,
    clearQuarantinedSyncItems,
    requeueQuarantinedSyncItems,
    classifySyncError: _classifySyncError
  };
}));
