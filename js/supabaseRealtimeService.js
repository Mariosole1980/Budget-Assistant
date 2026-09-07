/**
 * Supabase Realtime & Incremental Sync Engine Subsystem
 * Extracted from app.js (Phase 20A Architectural Modularization)
 * Handles Supabase realtime subscriptions, event listeners, debounce, watchdog,
 * incremental sync cursors, full sync fallback, and partner sync polling.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SupabaseRealtimeService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let _supabaseRealtimeChannel = null;
let _realtimeReconnectTimer = null;
let _realtimeWatchdogInterval = null;
let _syncQueueWorkerInterval = null;

function _scheduleRealtimeReconnect(delayMs = 3000) {
  if (_realtimeReconnectTimer) return;
  _realtimeReconnectTimer = setTimeout(() => {
    _realtimeReconnectTimer = null;
    if (state.supabaseClient && state.currentUser && navigator.onLine !== false) {
      console.info('[Realtime] Attempting automatic reconnect...');
      setupSupabaseRealtimeSubscription();
    }
  }, delayMs);
}

function _startRealtimeWatchdog() {
  if (_realtimeWatchdogInterval) return;
  _realtimeWatchdogInterval = setInterval(() => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    if (document.visibilityState === 'hidden') return;

    const isJoined = _supabaseRealtimeChannel && _supabaseRealtimeChannel.state === 'joined';
    if (!isJoined) {
      console.info('[RealtimeWatchdog] Channel not joined (state=' + (_supabaseRealtimeChannel ? _supabaseRealtimeChannel.state : 'null') + '), reconnecting...');
      setupSupabaseRealtimeSubscription();
    }
  }, 25000);
}

function _startSyncQueueWorker() {
  if (_syncQueueWorkerInterval) return;
  _syncQueueWorkerInterval = setInterval(async () => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    try {
      const queueStr = localStorage.getItem('money_manager_sync_queue');
      if (queueStr) {
        const q = JSON.parse(queueStr) || [];
        if (q.length > 0 && typeof processSyncQueue === 'function' && !_isProcessingSyncQueue) {
          console.info(`[SyncQueueWorker] Flushing ${q.length} pending mutations...`);
          await processSyncQueue({ skipReload: true });
        }
      }
    } catch (_) {}
  }, 12000);
}

function setupSupabaseRealtimeSubscription() {
  if (!state.supabaseClient || !state.currentUser) return;

  if (_supabaseRealtimeChannel) {
    try {
      state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    } catch (_) {}
    _supabaseRealtimeChannel = null;
  }

  const userId = state.currentUser.id;
  let partnerId = state.partnerProfile ? (state.partnerProfile.id || state.partnerProfile.user_id) : null;
  let familyId = state.userProfile ? state.userProfile.family_id : null;

  // Fallback to cached profiles if not yet loaded in memory
  if (!familyId) {
    try {
      const cached = JSON.parse(localStorage.getItem('cached_user_profile') || '{}');
      if (cached && cached.family_id) familyId = cached.family_id;
    } catch (_) {}
  }
  if (!partnerId) {
    try {
      const cachedPartner = JSON.parse(localStorage.getItem('cached_partner_profile') || '{}');
      if (cachedPartner && (cachedPartner.id || cachedPartner.user_id)) {
        partnerId = cachedPartner.id || cachedPartner.user_id;
      }
    } catch (_) {}
  }

  _supabaseRealtimeChannel = state.supabaseClient.channel('realtime-sync-' + Date.now());

  // 1. Always listen for personal changes by user_id
  _supabaseRealtimeChannel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
    handleRealtimeTransactionChange
  ).on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
    handleRealtimeCategoryChange
  );

  // 2. If in family, also listen for family changes
  if (familyId) {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `family_id=eq.${familyId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `family_id=eq.${familyId}` },
      handleRealtimeCategoryChange
    );
  }

  // 3. If partner present, also listen for partner changes
  if (partnerId && partnerId !== userId) {
    _supabaseRealtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${partnerId}` },
      handleRealtimeTransactionChange
    ).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${partnerId}` },
      handleRealtimeCategoryChange
    );
  }

  _supabaseRealtimeChannel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') {
      console.info('[Realtime] Subscribed to sync channel successfully');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.warn(`[Realtime] Subscription status: ${status}`, err);
      _scheduleRealtimeReconnect(3000);
    }
  });

  _startRealtimeWatchdog();
  _startSyncQueueWorker();
}

function stopSupabaseRealtimeSubscription() {
  if (_supabaseRealtimeChannel && state.supabaseClient) {
    try {
      state.supabaseClient.removeChannel(_supabaseRealtimeChannel);
    } catch (_) {}
    _supabaseRealtimeChannel = null;
  }
  if (_realtimeWatchdogInterval) {
    clearInterval(_realtimeWatchdogInterval);
    _realtimeWatchdogInterval = null;
  }
  if (_realtimeReconnectTimer) {
    clearTimeout(_realtimeReconnectTimer);
    _realtimeReconnectTimer = null;
  }
}

// Debounce timer for realtime changes — prevents rapid-fire UI re-renders when
// multiple INSERT/UPDATE/DELETE events arrive in quick succession (e.g. after bulk upsert).
let _realtimeDebounceTimer = null;
let _pendingRealtimeEvents = [];

// Flag: set to true during internal cleanup (e.g. duplicate deletion) so that
// the resulting DB DELETE events do NOT trigger a UI re-render / flicker.
let _suppressRealtimeEventsCount = 0;
Object.defineProperty(window, '_suppressRealtimeEvents', {
  get: () => _suppressRealtimeEventsCount > 0,
  set: (val) => {
    if (val) {
      _suppressRealtimeEventsCount++;
    } else {
      _suppressRealtimeEventsCount = Math.max(0, _suppressRealtimeEventsCount - 1);
    }
  },
  configurable: true
});

// Increment the suppression counter and ALWAYS schedule a matching decrement
// after delayMs. Safe to call multiple times concurrently — each call adds its
// own independent decrement, so the counter can never get stuck.
function suppressRealtimeFor(delayMs) {
  _suppressRealtimeEvents = true;
  setTimeout(() => {
    _suppressRealtimeEvents = false;
  }, delayMs);
}

function handleRealtimeTransactionChange(payload) {
  const isDelete = payload.eventType === 'DELETE';
  const eventId = isDelete ? (payload.old && payload.old.id) : (payload.new && payload.new.id);

  // 1. If it's a delete event of a transaction we are actively deleting locally, always suppress it
  if (isDelete && eventId && _deletingTxIds.has(String(eventId))) {
    return;
  }

  // 2. If global suppression is active, only suppress our own events, let partner events pass
  if (_suppressRealtimeEvents) {
    const isPartnerEvent = isDelete
      ? true // Since it's a delete and not in our deleting set, it's a partner delete
      : (payload.new && state.currentUser && payload.new.user_id !== state.currentUser.id);

    if (!isPartnerEvent) {
      return;
    }
  }

  // Accumulate events, then apply them all at once after a short delay (150ms for near-instant cross-device updates).
  _pendingRealtimeEvents.push(payload);

  const _realtimeDebounceMs = 150;

  if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(() => {
    const events = _pendingRealtimeEvents.slice();
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;

    let trans = [...state.transactions];
    let changed = false;
    let insertedByPartner = false;

    // Collect active in-flight deletions
    const inFlightDeletionIds = new Set();
    const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
    if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
    if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
    try {
      const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
      queue.forEach(item => {
        if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
          addInFlight(item.payload);
        }
      });
    } catch (_) { }

    events.forEach(ev => {
      const eventType = ev.eventType;
      if (eventType === 'INSERT') {
        const newTrans = ev.new;
        if (newTrans && newTrans.id) {
          const idStr = String(newTrans.id);
          if (inFlightDeletionIds.has(idStr)) {
            return;
          }
          // Reconcile stale tombstone
          try {
            reconcileStaleTombstones([newTrans]);
          } catch (_) { }
        }
        if (!trans.some(t => t.id === newTrans.id)) {
          trans.unshift(newTrans);
          changed = true;
          if (newTrans && state.currentUser && newTrans.user_id !== state.currentUser.id) {
            insertedByPartner = true;
            if (newTrans.type === 'expense') {
              checkHighExpenseAlert(newTrans);
            }
          }
        }
      } else if (eventType === 'UPDATE') {
        const updatedTrans = ev.new;
        const idx = trans.findIndex(t => t.id === updatedTrans.id);
        if (idx !== -1) {
          if (updatedTrans.status === 'deleted') {
            trans.splice(idx, 1);
            changed = true;
          } else {
            trans[idx] = updatedTrans;
            changed = true;
            if (updatedTrans && state.currentUser && updatedTrans.user_id !== state.currentUser.id && updatedTrans.type === 'expense') {
              checkHighExpenseAlert(updatedTrans);
            }
          }
        }
      } else if (eventType === 'DELETE') {
        const deletedId = ev.old && ev.old.id;
        if (deletedId && trans.some(t => t.id === deletedId)) {
          trans = trans.filter(t => t.id !== deletedId);
          changed = true;
        }
      }
    });

    // Only update UI if something actually changed
    if (!changed) {
      return;
    }

    trans.sort(compareTransactions);

    state.transactions = trans;
    localStorage.setItem('offline_transactions', JSON.stringify(trans));

    calculateInitialBalances();
    // ANTI-FLICKER FIX (resume flash): Wrap the re-render in no-transition so a
    // realtime event arriving during the resume cycle (after re-subscribing) does
    // not cause a visible flash. Previously this was gated only on the short-lived
    // _appJustResumed flag, which expires at _RESUME_GUARD_MS (~1.7s) while the
    // 5s debounce below still fires - leaving the reconnect batch re-render
    // UNCOVERED with transitions enabled. _isWithinResumeWindow() covers the full
    // reconnect window. Uses the reference-counted guard so guards never race.
    const _inResumeWindow = _isWithinResumeWindow(_REALTIME_RESUME_GUARD_MS);
    if (_inResumeWindow) pushNoTransition();
    updateUI();
    if (_inResumeWindow) {
      setTimeout(() => {
        popNoTransition();
      }, 800);
    }

    if (insertedByPartner) {
      showSyncToast('📥 Νέα κίνηση προστέθηκε από άλλο μέλος', 3000);
    }
  }, _realtimeDebounceMs); // 300ms for partner events (near-instant), 5000ms for own bulk events (anti-flicker batching)
}

function handleRealtimeCategoryChange(payload) {
  // Ignore events generated by our own internal cleanup operations.
  if (_suppressRealtimeEvents) {
    return;
  }

  let cats = [...state.categories];
  const eventType = payload.eventType;

  if (eventType === 'INSERT') {
    const newCat = payload.new;
    if (!cats.some(c => c.id === newCat.id)) {
      cats.push(newCat);
    }
  } else if (eventType === 'UPDATE') {
    const updatedCat = payload.new;
    cats = cats.map(c => c.id === updatedCat.id ? updatedCat : c);
  } else if (eventType === 'DELETE') {
    const deletedId = payload.old.id;
    cats = cats.filter(c => c.id !== deletedId);
  }

  state.categories = cats;
  localStorage.setItem('offline_categories', JSON.stringify(cats));

  // ANTI-FLICKER FIX (resume flash): Same resume-cycle guard as
  // handleRealtimeTransactionChange (see there for details). Covers the full
  // 5s reconnect debounce window instead of the short-lived _appJustResumed flag.
  // Uses the reference-counted guard so overlapping guards never race.
  const _inResumeWindow = _isWithinResumeWindow(_REALTIME_RESUME_GUARD_MS);
  if (_inResumeWindow) pushNoTransition();
  updateUI();
  if (_inResumeWindow) {
    setTimeout(() => {
      popNoTransition();
    }, 800);
  }
}

if (typeof generateUUID !== 'undefined') window.generateUUID = generateUUID;
if (typeof enqueueSyncMutation !== 'undefined') window.enqueueSyncMutation = enqueueSyncMutation;
if (typeof processSyncQueue !== 'undefined') window.processSyncQueue = processSyncQueue;
window.setupSupabaseRealtimeSubscription = setupSupabaseRealtimeSubscription;
window.stopSupabaseRealtimeSubscription = stopSupabaseRealtimeSubscription;

// Handle online connectivity restore events
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('online', () => {

  // Re-establish the Supabase session now that we are online again. If the
  // access token expired while offline (which triggered a null-session auth
  // event that we intentionally ignored), this refresh restores a valid
  // session so cloud sync resumes. If the refresh token itself was rejected,
  // getSession() returns no session and the normal auth flow takes over.
  const refreshSessionAndProfile = async () => {
    if (!state.supabaseClient) return;
    try {
      const { data } = await state.supabaseClient.auth.getSession();
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        updateHeaderSyncIcon('synced');
        // PREMIUM FIX: Refresh the authoritative user profile BEFORE replaying
        // the sync queue. Without this, isPremium() can read a stale/null
        // state.userProfile (e.g. from before Premium was activated) and
        // incorrectly trigger the monthly cloud-limit toast for a Premium user.
        if (typeof loadUserProfiles === 'function') {
          await loadUserProfiles(data.session.user);
        }
      }
    } catch (err) {
      // Session refresh failed; fall through to queue replay which will
      // surface any auth errors gracefully.
      console.warn('Online session/profile refresh failed:', err);
    }
  };

  refreshSessionAndProfile().finally(() => {
    processSyncQueue();
    if (typeof setupSupabaseRealtimeSubscription === 'function') {
      setupSupabaseRealtimeSubscription();
    }
  });
});

// ============================================================
// REAL-TIME PARTNER SYNC POLLING
// Every 15 seconds, if logged in, silently refresh data
// ============================================================
let _partnerSyncInterval = null;

// Sync status tracking
state.lastSyncTime = state.lastSyncTime || null;
state.syncStatus = state.syncStatus || 'idle'; // 'idle' | 'syncing' | 'success' | 'error'
state.syncPendingCount = state.syncPendingCount || 0;

function updateSyncStatusIndicator() {
  const dot = document.getElementById('header-sync-dot');
  const icon = document.getElementById('header-sync-cloud-icon');
  const btn = document.getElementById('header-sync-icon');

  if (state.currentUser) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state.syncStatus = 'offline';
    } else if (state.syncStatus === 'error') {
      if (!state._syncErrorTimestamp) state._syncErrorTimestamp = Date.now();
      if (Date.now() - state._syncErrorTimestamp > 4000) {
        state.syncStatus = 'synced';
        state._syncErrorTimestamp = null;
      }
    } else if (!state.syncStatus || state.syncStatus === 'idle' || state.syncStatus === 'offline') {
      state.syncStatus = 'synced';
    }
  } else {
    state.syncStatus = 'offline';
  }

  const colors = {
    idle: '#9e9e9e',
    offline: '#9e9e9e',
    syncing: '#ffb300',
    success: '#4caf50',
    synced: '#4caf50',
    error: '#e05e55'
  };

  if (dot) {
    dot.style.background = colors[state.syncStatus] || colors.idle;
    // Animate dot on sync
    if (state.syncStatus === 'syncing') {
      dot.style.animation = 'syncDotPulse 0.8s infinite alternate';
    } else {
      dot.style.animation = 'none';
    }

    // Inject dot keyframes once
    if (!document.getElementById('sync-dot-styles')) {
      const s = document.createElement('style');
      s.id = 'sync-dot-styles';
      s.innerHTML = `@keyframes syncDotPulse { from { transform: scale(1); opacity: 0.6; } to { transform: scale(1.4); opacity: 1; } }`;
      document.head.appendChild(s);
    }
  }

  if (icon) {
    if (state.syncStatus === 'syncing') {
      icon.className = 'fa-solid fa-cloud-arrow-up';
    } else if (state.syncStatus === 'error') {
      icon.className = 'fa-solid fa-cloud-bolt';
    } else {
      icon.className = 'fa-solid fa-cloud';
    }
  }

  // Update tooltip with last sync time
  if (btn) {
    let tooltip = state.lang === 'en' ? 'Cloud Account' : 'Λογαριασμός Cloud';
    if (state.lastSyncTime) {
      const d = new Date(state.lastSyncTime);
      const timeStr = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      tooltip += ' • ' + (state.lang === 'en' ? 'Last sync: ' : 'Τελ. συγχρονισμός: ') + timeStr;
    }
    if (state.syncPendingCount > 0) {
      tooltip += ' • ' + state.syncPendingCount + ' ' + (state.lang === 'en' ? 'pending' : 'εκκρεμούν');
    }
    btn.title = tooltip;
  }

  // Update sync status text in settings (check both element IDs)
  const syncStatusEl = document.getElementById('sync-status-label') || document.getElementById('val_sync_status');
  if (syncStatusEl) {
    const lang = state.lang || 'el';
    if (!state.currentUser) {
      syncStatusEl.textContent = lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση';
      syncStatusEl.style.color = 'var(--text-muted)';
    } else {
      const email = state.currentUser.email ? state.currentUser.email.split('@')[0] : '';
      if (state.syncStatus === 'syncing') {
        syncStatusEl.textContent = lang === 'en' ? 'Syncing...' : 'Συγχρονισμός...';
        syncStatusEl.style.color = '#ffb300';
      } else if (state.syncStatus === 'error') {
        syncStatusEl.textContent = lang === 'en' ? 'Sync Error' : 'Σφάλμα Συγχρονισμού';
        syncStatusEl.style.color = '#ef5350';
      } else {
        const userLabel = email ? ` (${email})` : '';
        syncStatusEl.textContent = lang === 'en' ? `Cloud Active${userLabel}` : `Cloud Ενεργός${userLabel}`;
        syncStatusEl.style.color = '#4caf50';
      }
    }
  }
}

// ============================================================
// INCREMENTAL SYNC INFRASTRUCTURE
// ============================================================
// Lossless incremental sync using a composite cursor (updated_at, id) for
// keyset pagination. The full re-fetch in forceSyncNow() remains the durable
// fallback; incremental is an optimization layered on top, gated by a flag.
// ============================================================

const SYNC_CURSORS_KEY = 'sync_cursors_v1';
const SYNC_INCREMENTAL_FLAG = 'sync_incremental_enabled';
const SYNC_FULL_INTERVAL_MS = 24 * 60 * 60 * 1000; // full reconcile every 24h (was 7 days) to self-heal lost realtime events faster

function isIncrementalSyncEnabled() {
  try {
    return localStorage.getItem(SYNC_INCREMENTAL_FLAG) === '1';
  } catch (e) { return false; }
}

function setIncrementalSyncEnabled(enabled) {
  try {
    localStorage.setItem(SYNC_INCREMENTAL_FLAG, enabled ? '1' : '0');
  } catch (e) { /* ignore */ }
}

// Probe whether the live schema supports incremental sync (i.e. the migration
// has been applied and transactions.updated_at exists). If it does, auto-enable
// the flag so rollout is automatic once the migration is deployed. If the probe
// fails or the column is absent, keep the flag off (full sync remains safe).
// Cached per session to avoid a probe on every sync.
let _incrementalCapabilityChecked = false;
async function ensureIncrementalSyncCapability() {
  if (_incrementalCapabilityChecked) return isIncrementalSyncEnabled();
  _incrementalCapabilityChecked = true;
  if (!state.supabaseClient || !state.currentUser) return false;
  try {
    const { data, error } = await promiseTimeout(
      state.supabaseClient
        .from('transactions')
        .select('updated_at')
        .limit(1),
      8000
    );
    // If the column exists, the query succeeds (even with 0 rows). If the
    // migration hasn't been applied, PostgREST returns a 42703 column error.
    if (error) {
      console.warn('[IncrementalSync] schema probe failed, keeping full sync:', error.message || error);
      setIncrementalSyncEnabled(false);
      return false;
    }
    setIncrementalSyncEnabled(true);
    return true;
  } catch (err) {
    console.warn('[IncrementalSync] schema probe error, keeping full sync:', err);
    setIncrementalSyncEnabled(false);
    return false;
  }
}

function getSyncCursors() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_CURSORS_KEY) || '{}');
  } catch (e) { return {}; }
}

function saveSyncCursors(cursors) {
  try {
    localStorage.setItem(SYNC_CURSORS_KEY, JSON.stringify(cursors));
  } catch (e) { /* ignore */ }
}

// A cursor is { ts: <ISO string>, id: <uuid> }. Returns null if not set.
function getTableCursor(cursors, table) {
  const c = cursors && cursors[table];
  if (!c || !c.ts || !c.id) return null;
  return c;
}

// Write durable tombstones for deleted rows so other devices can apply the
// deletion without a full re-fetch. Best-effort; never throws.
async function writeSyncTombstones(tableName, rowIds) {
  if (!state.supabaseClient || !state.currentUser) return;
  if (!Array.isArray(rowIds) || rowIds.length === 0) return;
  const userId = state.currentUser.id;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  const rows = rowIds.map(rid => ({
    table_name: tableName,
    row_id: rid,
    user_id: userId,
    family_id: familyId
  }));
  try {
    await promiseTimeout(
      state.supabaseClient.from('sync_tombstones').upsert(rows, { onConflict: 'table_name,row_id' }),
      8000
    );
  } catch (err) {
    console.warn('[IncrementalSync] tombstone write failed:', err);
  }
}

function resetSyncCursors() {
  try {
    localStorage.removeItem(SYNC_CURSORS_KEY);
    localStorage.removeItem('sync_last_full_ts');
  } catch (e) { /* ignore */ }
}

// Should we run a full re-fetch this cycle instead of incremental?
function shouldFullSync() {
  // If local transactions array is empty or offline_transactions is missing,
  // incremental sync CANNOT work (there is no local baseline to apply diffs to).
  // A full re-fetch is mandatory to load all transactions from the cloud.
  const offlineTrans = localStorage.getItem('offline_transactions');
  if (!offlineTrans || !Array.isArray(state.transactions) || state.transactions.length === 0) {
    return true;
  }
  // No cursor baseline yet → must full sync to establish it.
  const cursors = getSyncCursors();
  if (!getTableCursor(cursors, 'transactions')) return true;
  // Periodic full reconcile to catch any drift / lost realtime events.
  const lastFull = parseInt(localStorage.getItem('sync_last_full_ts') || '0', 10);
  if (Date.now() - lastFull > SYNC_FULL_INTERVAL_MS) return true;
  return false;
}

function markFullSyncDone() {
  try {
    localStorage.setItem('sync_last_full_ts', String(Date.now()));
  } catch (e) { /* ignore */ }
}

// Build the scope filter string (family/partner/user) reused by incremental
// queries. Returns a PostgREST or-filter string (comma-separated OR list).
function buildIncrementalScopeString() {
  const userId = state.currentUser.id;
  const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;
  if (familyId && partnerId) {
    return `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
  } else if (familyId) {
    return `family_id.eq.${familyId},user_id.eq.${userId}`;
  } else if (partnerId) {
    return `user_id.eq.${userId},user_id.eq.${partnerId}`;
  }
  return `user_id.eq.${userId}`;
}

// Combine the scope OR-list with an optional keyset predicate into a single
// PostgREST or-filter. The keyset predicate is:
//   updated_at > ts OR (updated_at = ts AND id > lastId)
// ANDed with the scope. PostgREST supports nested and()/or().
function buildIncrementalFilter(scopeStr, tsCol, ts, id) {
  if (!ts || !id) return scopeStr; // first page: scope only
  const keyset = `or(${tsCol}.gt.${ts},and(${tsCol}.eq.${ts},id.gt.${id}))`;
  return `and(${scopeStr},${keyset})`;
}

// Keyset-paginated incremental fetch of transactions changed since the cursor.
// Returns { rows, nextCursor } where nextCursor is the last consumed (updated_at, id).
async function fetchIncrementalTransactions(cursor) {
  const pageSize = 1000;
  let allRows = [];
  let lastTs = cursor ? cursor.ts : null;
  let lastId = cursor ? cursor.id : null;
  let hasMore = true;
  const scopeStr = buildIncrementalScopeString();

  while (hasMore) {
    let q = state.supabaseClient
      .from('transactions')
      .select('*')
      .eq('status', 'active')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(pageSize);

    q = q.or(buildIncrementalFilter(scopeStr, 'updated_at', lastTs, lastId));

    const { data, error } = await promiseTimeout(q, 15000);
    if (error) throw error;

    const page = data || [];
    if (page.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(page);
      const lastRow = page[page.length - 1];
      lastTs = lastRow.updated_at;
      lastId = lastRow.id;
      if (page.length < pageSize) hasMore = false;
    }
  }

  return {
    rows: allRows,
    nextCursor: allRows.length > 0 ? { ts: lastTs, id: lastId } : (cursor || null)
  };
}

// Pull tombstones newer than the cursor and apply local deletions.
async function fetchIncrementalTombstones(cursor) {
  const pageSize = 1000;
  let allTombstones = [];
  let lastTs = cursor ? cursor.ts : null;
  let lastId = cursor ? cursor.id : null;
  let hasMore = true;
  const scopeStr = buildIncrementalScopeString();

  while (hasMore) {
    let q = state.supabaseClient
      .from('sync_tombstones')
      .select('*')
      .order('deleted_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(pageSize);

    q = q.or(buildIncrementalFilter(scopeStr, 'deleted_at', lastTs, lastId));

    const { data, error } = await promiseTimeout(q, 15000);
    if (error) throw error;

    const page = data || [];
    if (page.length === 0) {
      hasMore = false;
    } else {
      allTombstones = allTombstones.concat(page);
      const lastRow = page[page.length - 1];
      lastTs = lastRow.deleted_at;
      lastId = lastRow.id;
      if (page.length < pageSize) hasMore = false;
    }
  }

  return {
    rows: allTombstones,
    nextCursor: allTombstones.length > 0 ? { ts: lastTs, id: lastId } : (cursor || null)
  };
}

// Apply incremental transaction rows + tombstones into local state.
function applyIncrementalTransactions(newRows, tombstones) {
  const current = Array.isArray(state.transactions) ? state.transactions : [];
  const byId = new Map(current.map(t => [String(t.id), t]));

  // CLOUD-AUTHORITY PRINCIPLE: Rows returned by incremental fetch are active in
  // the cloud (status='active'). Only skip if actively being deleted right now
  // (in-flight, 30s grace window, or pending in sync queue).
  const inFlightDeletionIds = new Set();
  const addInFlight = (id) => { if (id !== null && id !== undefined && id !== '') inFlightDeletionIds.add(String(id)); };
  if (typeof _deletingTxIds !== 'undefined' && _deletingTxIds) _deletingTxIds.forEach(addInFlight);
  if (typeof _recentlyDeletedTxIds !== 'undefined' && _recentlyDeletedTxIds) _recentlyDeletedTxIds.forEach(addInFlight);
  try {
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]') || [];
    queue.forEach(item => {
      if (item && (item.action === 'delete' || item.action === 'permanent_delete_tx') && item.payload) {
        addInFlight(item.payload);
      }
    });
  } catch (_) { }

  // Reconcile stale tombstones for incoming active cloud rows
  if (newRows && newRows.length > 0) {
    try {
      reconcileStaleTombstones(newRows);
    } catch (_) { }
  }

  // Upsert changed/new rows, skipping only those actively being deleted.
  (newRows || []).forEach(t => {
    if (t && t.id && inFlightDeletionIds.has(String(t.id))) {
      return;
    }
    byId.set(String(t.id), t);
  });

  // Apply deletions from tombstones (only for transactions).
  (tombstones || []).forEach(tb => {
    if (tb.table_name === 'transactions') {
      byId.delete(String(tb.row_id));
    }
  });

  const merged = Array.from(byId.values());
  merged.sort(compareTransactions);
  state.transactions = merged;
  localStorage.setItem('offline_transactions', JSON.stringify(merged));
  if (state.currentUser && state.currentUser.id) {
    localStorage.setItem('offline_transactions_owner', state.currentUser.id);
  }
}

let _forceSyncInFlight = null;

async function forceSyncNow(silent = false) {
  if (!state.supabaseClient || !state.currentUser) {
    if (!silent) {
      const msg = (state.lang === 'el')
        ? '☁️ Παρακαλώ συνδεθείτε πρώτα για συγχρονισμό στο Cloud.'
        : '☁️ Please log in first to sync to the Cloud.';
      if (typeof showSyncToast === 'function') {
        showSyncToast(msg, 3500);
      }
      if (typeof openSupabaseSettings === 'function') {
        openSupabaseSettings();
      }
    }
    return false;
  }

  if (_forceSyncInFlight) {
    return _forceSyncInFlight;
  }

  _forceSyncInFlight = (async () => {
    state.syncStatus = 'syncing';
    updateSyncStatusIndicator();

    // Suppress realtime events for the duration of this sync
    suppressRealtimeFor(4000);

    try {
      const userId = state.currentUser.id;

      // Auto-sync any stuck local transactions (e.g. from guest mode or legacy local_ items)
      await syncLocalTransactionsToCloud(userId, { silent: true });

      // Process offline sync queue (applies offline deletes/saves to cloud) before fetching
      await processSyncQueue({ skipReload: true });

      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
      const familyId = state.userProfile ? state.userProfile.family_id : null;

      let catsQuery = state.supabaseClient.from('categories').select('*');
      let accsQuery = state.supabaseClient.from('accounts').select('*');
      let tempsQuery = state.supabaseClient.from('recurring_templates').select('*');

      if (familyId && partnerId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (familyId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (partnerId) {
        const filter = `user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else {
        catsQuery = catsQuery.eq('user_id', userId);
        accsQuery = accsQuery.eq('user_id', userId);
        tempsQuery = tempsQuery.eq('user_id', userId);
      }

      // 1. Fetch categories, accounts, and recurring templates
      const [catsRes, accsRes, tempsRes] = await promiseTimeout(
        Promise.all([
          catsQuery,
          accsQuery,
          tempsQuery.then(r => r, () => ({ data: [], error: null }))
        ]),
        15000
      );

      if (!catsRes.error && catsRes.data) {
        if (Array.isArray(catsRes.data) && catsRes.data.length > 0) {
          // Cloud has categories -> keep cloud categories, and merge any unsynced local custom categories
          const cloudNames = new Set(catsRes.data.map(c => (c && c.name ? c.name.trim().toLowerCase() : '')));
          const localCustom = (state.categories || []).filter(c => c && c.name && !cloudNames.has(c.name.trim().toLowerCase()) && !c.is_deleted);
          state.categories = [...catsRes.data, ...localCustom];
          deduplicateCategories();
        } else {
          // Cloud categories empty (e.g. newly registered account) -> preserve local categories or seed with defaults
          if (!state.categories || state.categories.length === 0) {
            state.categories = DEFAULT_CATEGORIES.slice();
          }
          // Seed defaults in Supabase in background for this new user
          if (state.currentUser && state.currentUser.id && state.categories.length > 0) {
            const now = new Date().toISOString();
            const catsToInsert = state.categories.map(c => ({
              id: c.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
              name: c.name,
              type: c.type || 'expense',
              icon: c.icon || 'fa-solid fa-shapes',
              color: c.color || '#78909c',
              user_id: state.currentUser.id,
              family_id: state.userProfile ? state.userProfile.family_id : null,
              created_at: c.created_at || now,
              updated_at: now
            }));
            state.supabaseClient.from('categories').insert(catsToInsert).then(({ error }) => {
              if (error) console.warn('Background category seeding warning:', error);
            });
          }
        }
        localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      }
      if (!accsRes.error && accsRes.data) {
        state.accounts = accsRes.data;
        localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      }
      if (tempsRes && tempsRes.data) {
        const cloudTemps = tempsRes.data.map(mapTemplateFromDb);
        state.recurringTemplates = mergeAndDeduplicateTemplates(cloudTemps, state.recurringTemplates);
        cleanDuplicateTemplates();
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      }

      // 2. Fetch transactions — INCREMENTAL (fast) or FULL (fallback)
      // Incremental uses a composite cursor (updated_at, id) for lossless
      // keyset pagination. Full re-fetch remains the durable fallback and is
      // used on first run, after N days, or whenever the flag is off.
      let allTransactions = [];
      let usedIncremental = false;

      // Auto-detect incremental capability: if the migration has been applied
      // (transactions.updated_at exists), the probe enables the flag so rollout
      // is automatic. If the probe fails or the column is absent, the flag stays
      // off and we fall through to the durable full re-fetch.
      const incrementalReady = (await ensureIncrementalSyncCapability()) && !shouldFullSync();
      if (incrementalReady) {
        try {
          const cursors = getSyncCursors();
          const txCursor = getTableCursor(cursors, 'transactions');
          const tombCursor = getTableCursor(cursors, 'transactions_tombstones');

          const [txResult, tombResult] = await Promise.all([
            fetchIncrementalTransactions(txCursor),
            fetchIncrementalTombstones(tombCursor)
          ]);

          // Apply incremental changes into local state (upserts + deletions).
          applyIncrementalTransactions(txResult.rows, tombResult.rows);

          // Advance cursors to the last consumed row (composite cursor).
          const nextCursors = { ...cursors };
          nextCursors.transactions = txResult.nextCursor;
          nextCursors.transactions_tombstones = tombResult.nextCursor;
          saveSyncCursors(nextCursors);

          // Keep local pending transactions (never dropped).
          const localPending = getPendingLocalTransactions(state.transactions);
          allTransactions = mergeAndDeduplicateTransactions(state.transactions, localPending);
          usedIncremental = true;
        } catch (incErr) {
          // Any incremental failure → fall back to full re-fetch (data safety).
          console.warn('[IncrementalSync] incremental fetch failed, falling back to full sync:', incErr);
          usedIncremental = false;
        }
      }

      if (!usedIncremental) {
        // FULL re-fetch (existing behavior) — also establishes the cursor baseline.
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let transQuery = state.supabaseClient
            .from('transactions')
            .select('*')
            .eq('status', 'active')
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          // FIX: Use proper Supabase .or() syntax with individual conditions
          if (familyId && partnerId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else if (familyId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
          } else if (partnerId) {
            transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else {
            transQuery = transQuery.eq('user_id', userId);
          }

          const { data: pageData, error: pageErr } = await promiseTimeout(
            transQuery,
            15000
          );
          if (pageErr) throw pageErr;

          if (pageData && pageData.length > 0) {
            allTransactions = allTransactions.concat(pageData);
            page++;
            if (pageData.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        // Establish the incremental cursor baseline from the full fetch.
        const cursors = getSyncCursors();
        const nextCursors = { ...cursors };
        if (allTransactions.length > 0) {
          let maxTs = '';
          let maxId = '';
          for (let i = 0; i < allTransactions.length; i++) {
            const tx = allTransactions[i];
            const txTs = tx.updated_at || tx.created_at || '';
            if (txTs && (!maxTs || txTs > maxTs)) {
              maxTs = txTs;
              maxId = tx.id || '';
            }
          }
          nextCursors.transactions = maxTs ? { ts: maxTs, id: maxId } : { ts: new Date().toISOString(), id: '00000000-0000-0000-0000-000000000000' };
        } else {
          nextCursors.transactions = { ts: new Date(0).toISOString(), id: '00000000-0000-0000-0000-000000000000' };
        }
        saveSyncCursors(nextCursors);
        markFullSyncDone();
      }

      // DATA-INTEGRITY SELF-HEALING: The cloud is the source of truth for what is
      // active. Clean any stale local tombstone/trash entries that claim a
      // cloud-active transaction was permanently deleted.
      try {
        reconcileStaleTombstones(allTransactions);
      } catch (reconcileErr) {
        console.warn('[DataIntegrity] reconcileStaleTombstones failed in forceSyncNow:', reconcileErr);
      }

      // Auto-rescue & sync any local transactions missing in the cloud
      const missingSynced = await autoSyncMissingTransactionsToCloud(allTransactions, userId);
      if (missingSynced && missingSynced.length > 0) {
        allTransactions = [...allTransactions, ...missingSynced];
      }

      // 4. Keep local pending transactions
      const localPending = getPendingLocalTransactions(state.transactions);

      // 5. Update state
      const cachedForMerge = (JSON.parse(localStorage.getItem('offline_transactions') || '[]') || []);
      const updatedCloudIds = new Set(allTransactions.map(t => String(t.id)));
      let cachedMissingFromCloud = cachedForMerge.filter(t => !(t && t.id && updatedCloudIds.has(String(t.id))));
      // Defense-in-depth: never reintroduce a permanently-deleted transaction from the offline cache.
      const permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(id => String(id)));
      if (permanentlyDeletedSet.size > 0) {
        cachedMissingFromCloud = cachedMissingFromCloud.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))));
      }
      const dedupedCombined = mergeAndDeduplicateTransactions(allTransactions, [...localPending, ...cachedMissingFromCloud]);
      dedupedCombined.sort(compareTransactions);

      // Snapshot IDs that existed BEFORE the sync to detect truly new entries
      const prevIdSet = new Set((state.transactions || []).map(t => String(t.id || '')));

      // === ANTI-FLICKER GUARD ===
      const newIds = dedupedCombined.map(t => t.id || '').join(',');
      const oldIds = (state.transactions || []).map(t => t.id || '').join(',');
      const dataChanged = newIds !== oldIds;

      state.transactions = dedupedCombined;
      cleanCrossLanguageRecurringDuplicates();
      processRecurringTemplates();
      cleanCrossLanguageRecurringDuplicates();
      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      if (state.currentUser && state.currentUser.id) {
        localStorage.setItem('offline_transactions_owner', state.currentUser.id);
      }

      // Sync notes, budgets & AI conversations. These are independent of each
      // other, so run them concurrently to cut total sync time (previously they
      // ran sequentially, adding each network round-trip's latency together).
      await Promise.all([
        syncNotes(),
        syncBudgets(),
        syncAdvisorConversations()
      ]);

      // 6. Check sync queue status
      const queueStr = localStorage.getItem('money_manager_sync_queue');
      if (queueStr) {
        try {
          const queue = JSON.parse(queueStr) || [];
          state.syncPendingCount = queue.length;
        } catch (e) { state.syncPendingCount = 0; }
      } else {
        state.syncPendingCount = 0;
      }

      state.lastSyncTime = Date.now();
      state.syncStatus = 'success';
      updateSyncStatusIndicator();

      // Update last sync time display in settings
      const lastSyncEl = document.getElementById('val_last_sync_time');
      if (lastSyncEl) {
        const d = new Date(state.lastSyncTime);
        lastSyncEl.textContent = d.toLocaleTimeString(state.lang === 'el' ? 'el-GR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      calculateInitialBalances();
      pushNoTransition();
      updateUI();
      setTimeout(() => {
        popNoTransition();
      }, 1000);

      // Compute how many transactions are genuinely new
      const newCount = dedupedCombined.filter(t => !prevIdSet.has(String(t.id || ''))).length;
      if (!silent && newCount > 0) {
        showSyncToast('✅ +' + newCount + ' ' + (state.lang === 'en' ? 'new transactions synced' : 'νέες κινήσεις συγχρονίστηκαν'), 3000);
      } else if (!silent && newCount === 0) {
        showSyncToast('✅ ' + (state.lang === 'en' ? 'Everything is up to date' : 'Όλα είναι ενημερωμένα'), 2000);
      }

      return true;
    } catch (e) {
      console.error('Force sync failed:', e);
      state.syncStatus = 'error';
      updateSyncStatusIndicator();
      if (!silent) {
        showSyncToast('❌ ' + (state.lang === 'en' ? 'Sync failed: ' : 'Αποτυχία συγχρονισμού: ') + (e.message || e), 4000);
      }
      return false;
    } finally {
      _forceSyncInFlight = null;
      suppressRealtimeFor(4000);
    }
  })();

  return _forceSyncInFlight;
}

function stopPartnerSyncPolling() {
  if (_partnerSyncInterval) {
    clearInterval(_partnerSyncInterval);
    _partnerSyncInterval = null;
  }
}

function startPartnerSyncPolling() {
  if (_partnerSyncInterval) clearInterval(_partnerSyncInterval);
  _partnerSyncInterval = setInterval(async () => {
    if (!state.supabaseClient || !state.currentUser || navigator.onLine === false) return;
    if (document.visibilityState === 'hidden') return;
    // Quiet partner sync: only runs if user is not currently interacting or submitting
    if (typeof _isSubmittingTransaction !== 'undefined' && _isSubmittingTransaction) return;
    if (typeof _isProcessingSyncQueue !== 'undefined' && _isProcessingSyncQueue) return;
    try {
      if (typeof forceSyncNow === 'function') {
        await forceSyncNow(true);
      }
    } catch (_) {}
  }, 90000); // every 90 seconds as gentle fallback
}

  return {
    setupSupabaseRealtimeSubscription,
    stopSupabaseRealtimeSubscription,
    _scheduleRealtimeReconnect,
    _startRealtimeWatchdog,
    _startSyncQueueWorker,
    suppressRealtimeFor,
    handleRealtimeTransactionChange,
    handleRealtimeCategoryChange,
    updateSyncStatusIndicator,
    isIncrementalSyncEnabled,
    setIncrementalSyncEnabled,
    getSyncCursors,
    saveSyncCursors,
    getTableCursor,
    resetSyncCursors,
    shouldFullSync,
    markFullSyncDone,
    buildIncrementalScopeString,
    buildIncrementalFilter,
    applyIncrementalTransactions,
    fetchIncrementalTransactions,
    fetchIncrementalTombstones,
    ensureIncrementalSyncCapability,
    forceSyncNow,
    startPartnerSyncPolling,
    stopPartnerSyncPolling,
    getChannel: function () { return _supabaseRealtimeChannel; },
    isForceSyncInFlight: function () { return !!_forceSyncInFlight; }
  };
}));
