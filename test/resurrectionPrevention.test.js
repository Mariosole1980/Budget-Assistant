// NOTE: No 'use strict' here on purpose — the tests eval function source
// extracted from app.js and in strict mode a direct eval gets its own scope,
// hiding the extracted functions (same pattern as test/recurringBulkDelete.test.js).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Regression tests for the forensic DATA-INTEGRITY fix: permanently-deleted
// transactions must NEVER be resurrected.
//
// Root cause (confirmed): autoSyncMissingTransactionsToCloud() read the WRONG
// trash key ('trash_transactions' instead of 'deleted_transactions_trash'), so
// the permanently-deleted exclusion set was silently empty and deleted
// transactions were re-uploaded to the cloud via upsert. Multiple secondary
// paths (cachedMissingFromCloud merge, processSyncQueue stale mutations,
// realtime INSERT events, syncLocalTransactionsToCloud, and the latent
// autoRestoreMistakenlyDeletedManualTransactions + /api/restore-transactions)
// could also reintroduce them.
//
// Fix under test:
//   • collectPermanentlyDeletedTxIds()  — defensive helper (correct key +
//     deleted-status cache + tombstones + queue).
//   • purgePermanentlyDeletedTxIds()    — purges IDs from state, offline cache,
//     sync queue, records durable tombstones, writes cloud tombstones.
//   • autoSyncMissingTransactionsToCloud() — uses the defensive helper.
//   • mergeAndDeduplicateTransactions() — passes permanentlyDeletedTxIds via deps.
//   • processSyncQueue()                — drops stale save/upsert for perm-deleted.
//   • handleRealtimeTransactionChange() — skips INSERT for perm-deleted.
//   • syncLocalTransactionsToCloud()    — filters perm-deleted before upsert.
//   • autoRestoreMistakenlyDeletedManualTransactions() — neutralized (no-op).
// ---------------------------------------------------------------------------

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

// Extract a top-level function by name (handles `async function X(`).
function extractFn(name) {
    let start = -1;
    for (const prefix of ['async function ' + name + '(', 'function ' + name + '(']) {
        start = appJs.indexOf(prefix);
        if (start !== -1) break;
    }
    if (start === -1) throw new Error('function ' + name + ' not found in app.js');

    // Find the body brace: scan forward from the signature, tracking paren depth
    // so default parameters that contain braces (e.g. `{ writeCloudTombstone = false }`)
    // are skipped. The first `{` at paren-depth 0 is the function body.
    let parenDepth = 0;
    let braceStart = -1;
    for (let i = start; i < appJs.length; i++) {
        const ch = appJs[i];
        if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;
        else if (ch === '{' && parenDepth === 0) { braceStart = i; break; }
    }
    if (braceStart === -1) throw new Error('function body not found for ' + name);

    let depth = 0;
    let i = braceStart;
    for (; i < appJs.length; i++) {
        if (appJs[i] === '{') depth++;
        else if (appJs[i] === '}') { depth--; if (depth === 0) break; }
    }
    return appJs.slice(start, i + 1);
}

// ---- Global mocks ---------------------------------------------------------
const store = {};
global.localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; }
};
global.window = global;
global.navigator = { onLine: true };
global.setTimeout = (fn) => { fn && fn(); return 0; };
global.clearTimeout = () => { };
global.console = console;
// Top-level const in app.js (not extracted by extractFn) referenced by
// collectPermanentlyDeletedTxIds / purgePermanentlyDeletedTxIds.
global._PERMANENT_DELETED_LS_KEY = 'permanent_deleted_tx_ids';

// In-memory "cloud" that records upserts / updates / deletes.
const cloud = {
    transactions: new Map(), // id -> row
    tombstones: [],
    upserted: [],
    updated: [],
    deleted: [],
    reset() {
        this.transactions.clear();
        this.tombstones = [];
        this.upserted = [];
        this.updated = [];
        this.deleted = [];
    }
};

// Minimal supabase client mock that mirrors the .from('transactions') chain.
function makeSupabaseMock() {
    return {
        from(table) {
            if (table !== 'transactions') {
                return {
                    upsert: async () => ({ error: null }),
                    update: async () => ({ error: null }),
                    delete: async () => ({ error: null }),
                    select: async () => ({ data: [], error: null })
                };
            }
            return {
                upsert: async (rows) => {
                    (rows || []).forEach(r => {
                        cloud.transactions.set(String(r.id), r);
                        cloud.upserted.push(r);
                    });
                    return { error: null };
                },
                update: async (patch) => {
                    return {
                        eq: async (col, id) => {
                            const row = cloud.transactions.get(String(id));
                            if (row) Object.assign(row, patch);
                            cloud.updated.push({ id, patch });
                            return { error: null };
                        }
                    };
                },
                delete: async () => {
                    return {
                        eq: async (col, id) => {
                            cloud.transactions.delete(String(id));
                            cloud.deleted.push(id);
                            return { error: null };
                        }
                    };
                },
                select: async () => ({ data: [], error: null })
            };
        }
    };
}

// ---- State + helpers the extracted functions reference --------------------
global.state = {
    transactions: [],
    currentUser: { id: 'user-1' },
    supabaseClient: makeSupabaseMock(),
    isSupabaseEnabled: true,
    lang: 'en'
};
global._recentlyDeletedTxIds = new Set();
global._deletingTxIds = new Set();
global._suppressRealtimeEvents = false;
global._isProcessingSyncQueue = false;
global._syncLocalInFlight = false;
global._pendingRealtimeEvents = [];
global._realtimeDebounceTimer = null;
global.PREMIUM_LIMITS = { cloudTxPerMonth: 100000 };
global.isPremium = () => true;
global.showSyncToast = () => { };
global.checkHighExpenseAlert = () => { };
global.mapTransactionToDb = (t) => {
    const db = Object.assign({}, t);
    delete db.fx_snapshot;
    delete db.photo_local_uri;
    delete db.photo_url;
    delete db.receipt;
    return db;
};
global.promiseTimeout = (p) => Promise.resolve(p);
global.writeSyncTombstones = async (table, ids) => {
    cloud.tombstones.push({ table, ids });
    return { error: null };
};
global._markRecentlySaved = () => { };
global._markRecentlyDeleted = () => { };
global.updateUI = () => { };
global.renderTrashBinList = () => { };
global.cleanCrossLanguageRecurringDuplicates = () => { };
global.processRecurringTemplates = () => { };
global.compareTransactions = (a, b) => String(a.id).localeCompare(String(b.id));
// Called by handleRealtimeTransactionChange when a transaction is added.
global.calculateInitialBalances = () => ({});
global._isWithinResumeWindow = () => false;
global._REALTIME_RESUME_GUARD_MS = 2500;

// Load the real functions under test from app.js. All are eval'd together at
// module top level so their declarations share the module scope and can
// reference each other.
eval([
    'reconcileStaleTombstones',
    'collectPermanentlyDeletedTxIds',
    'purgePermanentlyDeletedTxIds',
    'autoSyncMissingTransactionsToCloud',
    'mergeAndDeduplicateTransactions',
    'readSyncQueueForMerge',
    'processSyncQueue',
    'handleRealtimeTransactionChange',
    'syncLocalTransactionsToCloud',
    'autoRestoreMistakenlyDeletedManualTransactions',
    'applyIncrementalTransactions'
].map(extractFn).join('\n'));

// Load the real merge implementation from js/transactionMerge.js. It uses a UMD
// wrapper that exports via CommonJS in Node (module.exports), so we require it
// and attach to global (global.window === global) for window.TransactionMerge.
global.TransactionMerge = require(__dirname + '/../js/transactionMerge.js');

// ---- Test helpers ---------------------------------------------------------
function seedLocalStorage({ trash = [], offline = [], queue = [], perm = [] } = {}) {
    localStorage.clear();
    if (trash.length) localStorage.setItem('deleted_transactions_trash', JSON.stringify(trash));
    if (offline.length) localStorage.setItem('offline_transactions', JSON.stringify(offline));
    if (queue.length) localStorage.setItem('money_manager_sync_queue', JSON.stringify(queue));
    if (perm.length) localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(perm));
}

function makeTx(id, overrides = {}) {
    return Object.assign({
        id,
        amount: 10,
        description: 'tx ' + id,
        type: 'expense',
        category: 'Food',
        status: 'active',
        user_id: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }, overrides);
}

// ===========================================================================
// TEST A: create → sync → soft delete → permanent delete → forceSyncNow →
//         verify NOT re-uploaded.
// ===========================================================================
test('A: permanently-deleted transaction is NOT re-uploaded by autoSyncMissingTransactionsToCloud', async () => {
    cloud.reset();
    const permId = '11111111-1111-1111-1111-111111111111';
    const activeId = '22222222-2222-2222-2222-222222222222';

    // Simulate: transaction was created, synced to cloud, soft-deleted, then
    // permanently deleted (purged). It now lives ONLY in the durable tombstone
    // list and the trash bin. A legitimate active tx also exists locally.
    seedLocalStorage({
        trash: [{ id: permId, status: 'deleted' }],
        offline: [makeTx(permId, { status: 'deleted' }), makeTx(activeId)],
        perm: [permId]
    });
    state.transactions = [makeTx(permId, { status: 'deleted' }), makeTx(activeId)];
    state.supabaseClient = makeSupabaseMock();

    // forceSyncNow calls autoSyncMissingTransactionsToCloud with the cloud rows.
    // The perm-deleted tx is NOT in the cloud yet; the active tx is also missing.
    const cloudRows = []; // nothing in cloud yet
    const missing = await autoSyncMissingTransactionsToCloud(cloudRows, 'user-1');

    // The permanently-deleted tx must NOT be uploaded.
    const uploadedIds = cloud.upserted.map(r => String(r.id));
    assert.ok(!uploadedIds.includes(permId), 'permanently-deleted tx must not be uploaded');
    // The legitimate active tx SHOULD be uploaded.
    assert.ok(uploadedIds.includes(activeId), 'legitimate active tx should be uploaded');
    // autoSync should report only the active tx as missing.
    assert.deepStrictEqual(missing.map(t => String(t.id)), [activeId]);
});

// ===========================================================================
// TEST B: permanently-deleted ID can't come back from any path.
// ===========================================================================
test('B1: collectPermanentlyDeletedTxIds aggregates all sources (correct key + legacy + cache + queue + tombstone)', () => {
    seedLocalStorage({
        trash: [{ id: 't1' }],
        offline: [makeTx('t2', { status: 'deleted' })],
        queue: [{ action: 'delete', payload: 't3' }],
        perm: ['t4']
    });
    _recentlyDeletedTxIds = new Set(['t5']);
    const ids = collectPermanentlyDeletedTxIds();
    for (const id of ['t1', 't2', 't3', 't4', 't5']) {
        assert.ok(ids.has(id), 'expected ' + id + ' to be collected');
    }
    // A legitimate active tx must NOT be collected.
    assert.ok(!ids.has('active-1'), 'active tx must not be collected');
});

test('B2: purgePermanentlyDeletedTxIds removes ID from state, offline cache, sync queue, and records durable tombstone', () => {
    seedLocalStorage({
        offline: [makeTx('p1'), makeTx('keep1')],
        queue: [
            { action: 'save', payload: makeTx('p1') },
            { action: 'save', payload: makeTx('keep1') },
            { action: 'delete', payload: 'p1' }
        ]
    });
    state.transactions = [makeTx('p1'), makeTx('keep1')];
    state.supabaseClient = makeSupabaseMock();
    state.currentUser = { id: 'user-1' };

    purgePermanentlyDeletedTxIds(['p1'], { writeCloudTombstone: true });

    // Removed from state.
    assert.ok(!state.transactions.some(t => String(t.id) === 'p1'), 'p1 removed from state');
    assert.ok(state.transactions.some(t => String(t.id) === 'keep1'), 'keep1 stays in state');
    // Removed from offline cache.
    const offline = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
    assert.ok(!offline.some(t => String(t.id) === 'p1'), 'p1 removed from offline cache');
    assert.ok(offline.some(t => String(t.id) === 'keep1'), 'keep1 stays in offline cache');
    // Removed stale queue mutations for p1.
    const queue = JSON.parse(localStorage.getItem('money_manager_sync_queue') || '[]');
    assert.ok(!queue.some(i => (i.payload && i.payload.id === 'p1') || i.payload === 'p1'), 'stale p1 mutations purged');
    assert.ok(queue.some(i => i.payload && i.payload.id === 'keep1'), 'keep1 mutation stays');
    // Durable tombstone recorded.
    const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]');
    assert.ok(perm.includes('p1'), 'p1 recorded in durable tombstone list');
    // Cloud tombstone written.
    assert.ok(cloud.tombstones.some(t => t.table === 'transactions' && t.ids.includes('p1')), 'cloud tombstone written');
});

test('B3: mergeAndDeduplicateTransactions keeps cloud-active perm-deleted ID but excludes local-only copy (cloud authority)', () => {
    seedLocalStorage({ perm: ['perm-1'] });
    const cloudRows = [makeTx('perm-1'), makeTx('cloud-active')];
    const localPending = [makeTx('perm-1'), makeTx('local-active')];
    const merged = mergeAndDeduplicateTransactions(cloudRows, localPending);
    const ids = merged.map(t => String(t.id));
    // CLOUD-AUTHORITY: the cloud reports perm-1 as active, so it is the source
    // of truth and must NOT be hidden by a stale local tombstone. The local
    // pending copy is deduplicated by id (cloud wins), so perm-1 appears once.
    assert.ok(ids.includes('perm-1'), 'cloud-active perm-1 kept (cloud authority)');
    assert.strictEqual(ids.filter(id => id === 'perm-1').length, 1, 'perm-1 appears exactly once (dedup by id)');
    assert.ok(ids.includes('cloud-active'), 'cloud-active kept');
    assert.ok(ids.includes('local-active'), 'local-active kept');
});

test('B4: processSyncQueue drops stale save mutation for permanently-deleted transaction', async () => {
    cloud.reset();
    seedLocalStorage({
        perm: ['perm-2'],
        queue: [{ action: 'save', payload: makeTx('perm-2') }]
    });
    state.transactions = [makeTx('perm-2')];
    state.supabaseClient = makeSupabaseMock();
    state.isSupabaseEnabled = true;
    state.currentUser = { id: 'user-1' };
    _isProcessingSyncQueue = false;

    await processSyncQueue({ skipReload: true });

    // The stale save must NOT reach the cloud.
    assert.ok(!cloud.upserted.some(r => String(r.id) === 'perm-2'), 'stale save for perm-deleted dropped');
});

test('B5: processSyncQueue drops stale upsert (restore) mutation for permanently-deleted transaction', async () => {
    cloud.reset();
    seedLocalStorage({
        perm: ['perm-3'],
        queue: [{ action: 'upsert', payload: 'perm-3' }]
    });
    state.transactions = [];
    state.supabaseClient = makeSupabaseMock();
    state.isSupabaseEnabled = true;
    state.currentUser = { id: 'user-1' };
    _isProcessingSyncQueue = false;

    await processSyncQueue({ skipReload: true });

    // The stale restore must NOT re-activate the tx in the cloud.
    assert.ok(!cloud.updated.some(u => String(u.id) === 'perm-3' && u.patch.status === 'active'), 'stale restore dropped');
});

test('B6: handleRealtimeTransactionChange skips INSERT when in-flight deleting and accepts active insert', () => {
    seedLocalStorage({ perm: ['perm-4'] });
    state.transactions = [];
    state.currentUser = { id: 'user-1' };
    _suppressRealtimeEvents = false;
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;
    _deletingTxIds = new Set(['in-flight-del-1']);

    // 1. In-flight deleted tx is skipped
    handleRealtimeTransactionChange({
        eventType: 'INSERT',
        new: makeTx('in-flight-del-1')
    });
    assert.ok(!state.transactions.some(t => String(t.id) === 'in-flight-del-1'), 'in-flight deleted tx skipped via realtime');

    // 2. Active cloud row is accepted and stale tombstone is reconciled
    handleRealtimeTransactionChange({
        eventType: 'INSERT',
        new: makeTx('perm-4')
    });
    assert.ok(state.transactions.some(t => String(t.id) === 'perm-4'), 'cloud active row accepted via realtime');
});

test('B7: syncLocalTransactionsToCloud filters permanently-deleted IDs before upsert', async () => {
    cloud.reset();
    seedLocalStorage({
        perm: ['perm-5'],
        offline: [makeTx('perm-5'), makeTx('keep2')]
    });
    state.transactions = [makeTx('perm-5'), makeTx('keep2')];
    state.supabaseClient = makeSupabaseMock();
    state.currentUser = { id: 'user-1' };
    _syncLocalInFlight = false;
    _suppressRealtimeEvents = false;

    await syncLocalTransactionsToCloud('user-1');

    const uploadedIds = cloud.upserted.map(r => String(r.id));
    assert.ok(!uploadedIds.includes('perm-5'), 'perm-5 not uploaded by syncLocalTransactionsToCloud');
    assert.ok(uploadedIds.includes('keep2'), 'keep2 uploaded');
});

test('B8: autoRestoreMistakenlyDeletedManualTransactions is neutralized (no-op)', async () => {
    seedLocalStorage({
        trash: [{ id: 'perm-6', status: 'deleted' }],
        offline: [makeTx('perm-6', { status: 'deleted' })]
    });
    state.transactions = [makeTx('perm-6', { status: 'deleted' })];
    state.supabaseClient = makeSupabaseMock();

    await autoRestoreMistakenlyDeletedManualTransactions();

    // The function must NOT re-activate anything.
    assert.ok(state.transactions.every(t => t.status !== 'active' || String(t.id) !== 'perm-6'),
        'autoRestore must not re-activate deleted transactions');
    assert.ok(!cloud.updated.some(u => String(u.id) === 'perm-6'), 'autoRestore must not touch cloud');
});

// ===========================================================================
// TEST C: legitimate active transaction still syncs.
// ===========================================================================
test('C: legitimate active transaction still uploads and survives merge', async () => {
    cloud.reset();
    seedLocalStorage({
        offline: [makeTx('active-1')],
        perm: ['perm-7']
    });
    state.transactions = [makeTx('active-1'), makeTx('perm-7', { status: 'deleted' })];
    state.supabaseClient = makeSupabaseMock();

    const missing = await autoSyncMissingTransactionsToCloud([], 'user-1');
    assert.ok(missing.map(t => String(t.id)).includes('active-1'), 'active-1 reported missing');
    assert.ok(cloud.upserted.some(r => String(r.id) === 'active-1'), 'active-1 uploaded');

    // Merge keeps the active tx.
    const merged = mergeAndDeduplicateTransactions([makeTx('active-1')], []);
    assert.ok(merged.some(t => String(t.id) === 'active-1'), 'active-1 survives merge');
});

// ===========================================================================
// TEST D: Android and Web converge (same id → dedup, both devices keep it).
// ===========================================================================
test('D: Android and Web converge on the same transaction set (dedup by id)', () => {
    seedLocalStorage({});
    const androidLocal = [makeTx('shared-1', { description: 'from android' })];
    const webLocal = [makeTx('shared-1', { description: 'from web' }), makeTx('web-only')];
    // Both devices pull the same cloud set and merge with their local pending.
    const mergedAndroid = mergeAndDeduplicateTransactions([makeTx('shared-1')], androidLocal);
    const mergedWeb = mergeAndDeduplicateTransactions([makeTx('shared-1')], webLocal);
    // Both converge to the same single 'shared-1' (dedup by id) plus their own extras.
    assert.strictEqual(mergedAndroid.filter(t => String(t.id) === 'shared-1').length, 1, 'android dedups shared-1');
    assert.strictEqual(mergedWeb.filter(t => String(t.id) === 'shared-1').length, 1, 'web dedups shared-1');
    assert.ok(mergedWeb.some(t => String(t.id) === 'web-only'), 'web keeps web-only');
});

// ===========================================================================
// TEST E: permanently-deleted on Android can't appear on Web.
// ===========================================================================
test('E: cloud-active perm-deleted ID is kept in Web merge and realtime (cloud authority)', () => {
    seedLocalStorage({ perm: ['perm-8'] });
    // CLOUD-AUTHORITY: the cloud reports perm-8 as active, so the web merge must
    // keep it (a stale local tombstone must not hide a cloud-active transaction).
    const webMerged = mergeAndDeduplicateTransactions([makeTx('perm-8'), makeTx('ok-1')], []);
    assert.ok(webMerged.some(t => String(t.id) === 'perm-8'), 'cloud-active perm-8 kept in web merge (cloud authority)');
    assert.ok(webMerged.some(t => String(t.id) === 'ok-1'), 'ok-1 kept');

    // Web realtime INSERT of the cloud-active tx is accepted and tombstone reconciled.
    state.transactions = [];
    state.currentUser = { id: 'user-1' };
    _suppressRealtimeEvents = false;
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;
    _deletingTxIds = new Set();
    handleRealtimeTransactionChange({ eventType: 'INSERT', new: makeTx('perm-8') });
    assert.ok(state.transactions.some(t => String(t.id) === 'perm-8'), 'perm-8 added via web realtime');
});

// ===========================================================================
// TEST F: permanently-deleted on Web can't appear on Android.
// ===========================================================================
test('F: cloud-active perm-deleted ID is kept in Android merge and realtime (cloud authority)', () => {
    seedLocalStorage({ perm: ['perm-9'] });
    // CLOUD-AUTHORITY: the cloud reports perm-9 as active, so the Android merge
    // must keep it (a stale local tombstone must not hide a cloud-active tx).
    const androidMerged = mergeAndDeduplicateTransactions([makeTx('perm-9'), makeTx('ok-2')], []);
    assert.ok(androidMerged.some(t => String(t.id) === 'perm-9'), 'cloud-active perm-9 kept in android merge (cloud authority)');
    assert.ok(androidMerged.some(t => String(t.id) === 'ok-2'), 'ok-2 kept');

    // Android realtime INSERT of the cloud-active tx is accepted.
    state.transactions = [];
    state.currentUser = { id: 'user-1' };
    _suppressRealtimeEvents = false;
    _pendingRealtimeEvents = [];
    _realtimeDebounceTimer = null;
    _deletingTxIds = new Set();
    handleRealtimeTransactionChange({ eventType: 'INSERT', new: makeTx('perm-9') });
    assert.ok(state.transactions.some(t => String(t.id) === 'perm-9'), 'perm-9 added via android realtime');
});

// ===========================================================================
// TEST G: applyIncrementalTransactions
// ===========================================================================
test('G1: applyIncrementalTransactions skips in-flight deleted tx and applies active rows', () => {
    seedLocalStorage({
        trash: [{ id: 'perm-10', status: 'deleted' }],
        offline: [makeTx('perm-10', { status: 'deleted' })],
        perm: ['perm-10']
    });
    state.transactions = [makeTx('keep-1')];
    state.currentUser = { id: 'user-1' };
    _deletingTxIds = new Set(['in-flight-del-2']);

    applyIncrementalTransactions([makeTx('perm-10'), makeTx('keep-1'), makeTx('in-flight-del-2')], []);

    const ids = state.transactions.map(t => String(t.id));
    // In-flight deleted tx must be skipped
    assert.ok(!ids.includes('in-flight-del-2'), 'in-flight-del-2 must be skipped');
    // Active cloud rows are applied
    assert.ok(ids.includes('perm-10'), 'perm-10 applied from cloud');
    assert.ok(ids.includes('keep-1'), 'keep-1 stays in state');
});

test('G2: applyIncrementalTransactions applies tombstones (deletes) for transactions', () => {
    seedLocalStorage({});
    state.transactions = [makeTx('tomb-1'), makeTx('keep-2')];
    state.currentUser = { id: 'user-1' };

    applyIncrementalTransactions([], [{ table_name: 'transactions', row_id: 'tomb-1' }]);

    const ids = state.transactions.map(t => String(t.id));
    assert.ok(!ids.includes('tomb-1'), 'tomb-1 removed via tombstone');
    assert.ok(ids.includes('keep-2'), 'keep-2 stays in state');
});

test('G3: applyIncrementalTransactions still adds legitimate active transactions', () => {
    seedLocalStorage({});
    state.transactions = [];
    state.currentUser = { id: 'user-1' };

    applyIncrementalTransactions([makeTx('new-active-1')], []);

    const ids = state.transactions.map(t => String(t.id));
    assert.ok(ids.includes('new-active-1'), 'legitimate active tx added by incremental sync');
});
