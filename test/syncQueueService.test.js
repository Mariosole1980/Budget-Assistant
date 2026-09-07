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
