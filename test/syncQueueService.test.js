const { test } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock window and state
global.window = global;
global.state = {
  currentUser: { id: 'user-1' },
  isSupabaseEnabled: false,
  supabaseClient: null
};

global.generateUUID = () => 'uuid-' + Math.random().toString(36).substr(2, 9);
global.updateSyncStatusIndicator = () => {};

const SyncQueueService = require('../js/syncQueueService.js');

test('SyncQueueService exports all expected functions', () => {
  assert.strictEqual(typeof SyncQueueService.enqueueSyncMutation, 'function');
  assert.strictEqual(typeof SyncQueueService.dequeueSyncMutation, 'function');
  assert.strictEqual(typeof SyncQueueService.processSyncQueue, 'function');
  assert.strictEqual(typeof SyncQueueService.isProcessingSyncQueue, 'function');
});

test('SyncQueueService enqueues and dequeues mutations correctly', () => {
  global.localStorage.clear();
  SyncQueueService.enqueueSyncMutation('save', { id: 'tx-1', amount: 50 });

  let raw = global.localStorage.getItem('money_manager_sync_queue');
  let q = JSON.parse(raw);
  assert.strictEqual(q.length, 1);
  assert.strictEqual(q[0].action, 'save');
  assert.strictEqual(q[0].payload.id, 'tx-1');

  // Dequeue
  SyncQueueService.dequeueSyncMutation('save', 'tx-1');
  raw = global.localStorage.getItem('money_manager_sync_queue');
  q = JSON.parse(raw);
  assert.strictEqual(q.length, 0);
});

test('SyncQueueService cleans up duplicate saves when deleting', () => {
  global.localStorage.clear();
  SyncQueueService.enqueueSyncMutation('save', { id: 'tx-2', amount: 100 });
  SyncQueueService.enqueueSyncMutation('delete', 'tx-2');

  const raw = global.localStorage.getItem('money_manager_sync_queue');
  const q = JSON.parse(raw);
  assert.strictEqual(q.length, 1);
  assert.strictEqual(q[0].action, 'delete');
  assert.strictEqual(q[0].payload, 'tx-2');
});

test('SyncQueueService.processSyncQueue does not throw when Supabase is disabled', async () => {
  global.localStorage.clear();
  await assert.doesNotReject(async () => {
    await SyncQueueService.processSyncQueue();
  });
  assert.strictEqual(SyncQueueService.isProcessingSyncQueue(), false);
});

// ---------------------------------------------------------------------------
// Regression tests for the "stuck sync queue" bug:
// un-syncable mutations must be quarantined (not retried forever) and
// transient failures must back off instead of hitting Supabase every tick.
// ---------------------------------------------------------------------------

const QUEUE_KEY = 'money_manager_sync_queue';
const DEAD_KEY = 'money_manager_sync_queue_dead';
const TX_ID = '11111111-1111-4111-8111-111111111111';
const TX_ID_2 = '22222222-2222-4222-8222-222222222222';

function readQueue() {
  return JSON.parse(global.localStorage.getItem(QUEUE_KEY) || '[]');
}

function seedQueue(items) {
  global.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function resetTestEnv() {
  global.localStorage.clear();
  global.promiseTimeout = (promise) => Promise.resolve(promise);
  global.mapTransactionToDb = (t) => Object.assign({}, t);
  global.mapTemplateToDb = (t) => Object.assign({}, t);
  global.mapNoteToDb = (n, userId, familyId) => Object.assign({}, n, { user_id: userId, family_id: familyId });
  global.isPremium = () => true;
  global.PREMIUM_LIMITS = { cloudTxPerMonth: 75 };
  global.collectPermanentlyDeletedTxIds = () => [];
  global.showSyncToast = () => {};
  global.updateSyncStatusIndicator = () => {};
  global.loadData = async () => {};
  global.updateUI = () => {};
  global.loadUserProfiles = async () => {};
  global.deleteTransactionOffline = () => {};

  global.state.isSupabaseEnabled = true;
  global.state.currentUser = { id: 'user-1' };
  global.state.userProfile = { family_id: null };
  global.state.transactions = [];
  global.state.lang = 'en';
  global.state.syncPendingCount = 0;
  global.state.supabaseClient = null;
}

// Minimal PostgREST-like builder: every chain is awaitable, and every call is
// recorded so tests can assert how many Supabase requests were made.
function createSupabaseMock(resolveResult) {
  const calls = [];
  function makeBuilder(table) {
    const ctx = { table, op: null };
    const builder = {
      upsert(payload) { ctx.op = 'upsert'; calls.push({ table, op: 'upsert' }); return builder; },
      update(payload) { ctx.op = 'update'; calls.push({ table, op: 'update' }); return builder; },
      delete() { ctx.op = 'delete'; calls.push({ table, op: 'delete' }); return builder; },
      select(cols, opts) { ctx.op = 'select'; calls.push({ table, op: 'select', count: opts && opts.count }); return builder; },
      eq() { return builder; },
      gte() { return builder; },
      or() { return builder; },
      then(onFulfilled, onRejected) {
        return Promise.resolve(resolveResult({ table, op: ctx.op })).then(onFulfilled, onRejected);
      }
    };
    return builder;
  }
  return {
    calls,
    from(table) { return makeBuilder(table); }
  };
}

function countOps(client, op) {
  return client.calls.filter((c) => c.op === op).length;
}

test('classifySyncError marks schema/constraint errors permanent and network errors transient', () => {
  assert.strictEqual(SyncQueueService.classifySyncError({ code: 'PGRST204', message: 'column missing' }), 'permanent');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '23514', message: 'check constraint violated' }), 'permanent');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '23505', message: 'duplicate key' }), 'permanent');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '42P01', message: 'relation missing' }), 'permanent');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '22P02', message: 'invalid input syntax' }), 'permanent');
  assert.strictEqual(SyncQueueService.classifySyncError({ message: 'TypeError: Failed to fetch' }), 'transient');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '57014', message: 'statement timeout' }), 'transient');
  assert.strictEqual(SyncQueueService.classifySyncError({ code: '42501', message: 'permission denied' }), 'auth');
});

test('a save rejected with PGRST204 is quarantined, not retried and not deleted locally', async () => {
  resetTestEnv();
  let locallyDeleted = false;
  global.deleteTransactionOffline = () => { locallyDeleted = true; };
  global.state.supabaseClient = createSupabaseMock(() => ({
    error: { code: 'PGRST204', message: "Could not find the 'transfer_rate' column of 'transactions' in the schema cache" }
  }));
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 10 });

  const result = await SyncQueueService.processSyncQueue({ skipReload: true });

  assert.strictEqual(result.quarantined, 1);
  assert.strictEqual(result.pending, 0);
  assert.strictEqual(readQueue().length, 0);
  assert.strictEqual(locallyDeleted, false, 'local transaction must never be deleted on a permanent sync error');
  const dead = SyncQueueService.getQuarantinedSyncItems();
  assert.strictEqual(dead.length, 1);
  assert.strictEqual(dead[0].errorCode, 'PGRST204');
  assert.strictEqual(dead[0].payloadId, TX_ID);
  assert.strictEqual(JSON.parse(global.localStorage.getItem(DEAD_KEY) || '[]').length, 1);
});

test('quarantined items keep their payload and can be requeued manually', async () => {
  resetTestEnv();
  global.state.supabaseClient = createSupabaseMock(() => ({
    error: { code: 'PGRST204', message: 'column missing in schema cache' }
  }));
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 42 });

  await SyncQueueService.processSyncQueue({ skipReload: true });
  assert.strictEqual(readQueue().length, 0);

  const requeued = SyncQueueService.requeueQuarantinedSyncItems();
  assert.strictEqual(requeued, 1);
  const queue = readQueue();
  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].payload.amount, 42);
  assert.strictEqual(queue[0].attempts, 0);
  assert.strictEqual(SyncQueueService.getQuarantinedSyncItems().length, 0);
});

test('a save rejected by a 23514 check constraint is quarantined (queue does not stay stuck)', async () => {
  resetTestEnv();
  global.state.supabaseClient = createSupabaseMock(() => ({
    error: { code: '23514', message: 'new row for relation "transactions" violates check constraint "transactions_rate_source_check"' }
  }));
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 12 });

  const result = await SyncQueueService.processSyncQueue({ skipReload: true });

  assert.strictEqual(result.quarantined, 1);
  assert.strictEqual(readQueue().length, 0);
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), false);
});

test('a delete_template rejected with 22P02 is quarantined instead of re-queued forever', async () => {
  resetTestEnv();
  global.state.supabaseClient = createSupabaseMock(() => ({
    error: { code: '22P02', message: 'invalid input syntax for type uuid: "undefined"' }
  }));
  SyncQueueService.enqueueSyncMutation('delete_template', TX_ID_2);

  const result = await SyncQueueService.processSyncQueue({ skipReload: true });

  assert.strictEqual(result.quarantined, 1);
  assert.strictEqual(readQueue().length, 0);
  assert.strictEqual(SyncQueueService.getQuarantinedSyncItems()[0].action, 'delete_template');
});

test('a transient failure backs off and the second run makes no Supabase request', async () => {
  resetTestEnv();
  const client = createSupabaseMock(() => ({ error: { code: '57014', message: 'canceling statement due to statement timeout' } }));
  global.state.supabaseClient = client;
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 7 });

  const first = await SyncQueueService.processSyncQueue({ skipReload: true });
  assert.strictEqual(first.retryScheduled, 1);
  assert.strictEqual(first.pending, 1);
  assert.strictEqual(countOps(client, 'upsert'), 1);

  const queue = readQueue();
  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].attempts, 1);
  assert.ok(queue[0].nextAttemptAt > Date.now(), 'item must carry a future retry timestamp');
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), false);

  // A worker tick immediately afterwards must not touch the network at all.
  const second = await SyncQueueService.processSyncQueue({ skipReload: true });
  assert.strictEqual(second.pending, 1);
  assert.strictEqual(countOps(client, 'upsert'), 1, 'backed-off items must not be retried on every tick');
});

test('a network error is retried later with backoff instead of every worker tick', async () => {
  resetTestEnv();
  const client = createSupabaseMock(() => ({ error: { message: 'TypeError: Failed to fetch' } }));
  global.state.supabaseClient = client;
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 3 });

  await SyncQueueService.processSyncQueue({ skipReload: true });
  const queue = readQueue();
  assert.strictEqual(queue.length, 1);
  assert.ok(queue[0].attempts >= 1);
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), false);
  assert.strictEqual(countOps(client, 'upsert'), 1);
});

test('the processing flag is released even when the post-sync reload throws', async () => {
  resetTestEnv();
  const client = createSupabaseMock(() => ({ error: null }));
  global.state.supabaseClient = client;
  global.loadData = async () => { throw new Error('loadData boom'); };
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 9 });

  const result = await SyncQueueService.processSyncQueue();

  assert.strictEqual(result.processed, 1);
  assert.strictEqual(SyncQueueService.isProcessingSyncQueue(), false, 'flag must be reset in finally');

  // A later, healthy run must actually sync again.
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID_2, amount: 11 });
  const second = await SyncQueueService.processSyncQueue({ skipReload: true });
  assert.strictEqual(second.processed, 1);
  assert.strictEqual(countOps(client, 'upsert'), 2);
});

test('repeated saves for the same transaction are deduped in the queue', async () => {
  resetTestEnv();
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 1 });
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 2 });

  const queue = readQueue();
  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].payload.amount, 2);
  assert.strictEqual(queue[0].attempts, 0);
});

test('hasDueSyncItems ignores items whose retry window has not arrived yet', () => {
  resetTestEnv();
  seedQueue([
    { id: 'q1', action: 'save', payload: { id: TX_ID }, attempts: 2, nextAttemptAt: Date.now() + 60000 },
    { id: 'q2', action: 'save', payload: { id: TX_ID_2 }, attempts: 0 }
  ]);
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), true);

  // Only backed-off items left -> the worker must skip the cycle entirely.
  seedQueue([
    { id: 'q3', action: 'save', payload: { id: TX_ID }, attempts: 1, nextAttemptAt: Date.now() + 60000 }
  ]);
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), false);
});

test('resetSyncQueueBackoff clears retry windows but keeps premium deferrals', () => {
  resetTestEnv();
  seedQueue([
    { id: 'q1', action: 'save', payload: { id: TX_ID }, attempts: 3, nextAttemptAt: Date.now() + 600000 },
    { id: 'q2', action: 'save', payload: { id: TX_ID_2 }, attempts: 1, nextAttemptAt: Date.now() + 600000, deferredReason: 'premium' }
  ]);

  const changed = SyncQueueService.resetSyncQueueBackoff();
  assert.strictEqual(changed, 1);

  const queue = readQueue();
  assert.strictEqual(queue[0].attempts, 0);
  assert.strictEqual(queue[0].nextAttemptAt, undefined);
  assert.strictEqual(queue[1].deferredReason, 'premium');
  assert.ok(queue[1].nextAttemptAt > Date.now());
});

test('free-plan limit defers the saves, caches the usage query and sets a retry window', async () => {
  resetTestEnv();
  global.isPremium = () => false;
  global.state.currentUser = { id: 'user-free-plan' };
  const client = createSupabaseMock((ctx) => (ctx.op === 'select' ? { count: 75, error: null } : { error: null }));
  global.state.supabaseClient = client;
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID, amount: 1 });
  SyncQueueService.enqueueSyncMutation('save', { id: TX_ID_2, amount: 2 });

  const result = await SyncQueueService.processSyncQueue({ skipReload: true });

  assert.strictEqual(result.deferredPremium, 2);
  assert.strictEqual(result.pending, 2);
  assert.strictEqual(countOps(client, 'select'), 1, 'usage query must be cached across queued items');
  assert.strictEqual(countOps(client, 'upsert'), 0);
  const queue = readQueue();
  assert.strictEqual(queue[0].deferredReason, 'premium');
  assert.ok(queue[0].nextAttemptAt > Date.now());
  assert.strictEqual(SyncQueueService.hasDueSyncItems(), false);
});

