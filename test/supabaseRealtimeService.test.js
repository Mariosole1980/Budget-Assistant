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
  currentUser: null,
  isSupabaseEnabled: false,
  supabaseClient: null,
  lang: 'el'
};

const SupabaseRealtimeService = require('../js/supabaseRealtimeService.js');

test('SupabaseRealtimeService exports all expected functions', () => {
  assert.strictEqual(typeof SupabaseRealtimeService.setupSupabaseRealtimeSubscription, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.stopSupabaseRealtimeSubscription, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.suppressRealtimeFor, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.handleRealtimeTransactionChange, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.handleRealtimeCategoryChange, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.updateSyncStatusIndicator, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.isIncrementalSyncEnabled, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.setIncrementalSyncEnabled, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.getSyncCursors, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.saveSyncCursors, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.forceSyncNow, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.startPartnerSyncPolling, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService.stopPartnerSyncPolling, 'function');
});

test('SupabaseRealtimeService manages incremental sync toggle in localStorage', () => {
  global.localStorage.clear();
  SupabaseRealtimeService.setIncrementalSyncEnabled(true);
  assert.strictEqual(SupabaseRealtimeService.isIncrementalSyncEnabled(), true);

  SupabaseRealtimeService.setIncrementalSyncEnabled(false);
  assert.strictEqual(SupabaseRealtimeService.isIncrementalSyncEnabled(), false);
});

test('SupabaseRealtimeService manages sync cursors correctly', () => {
  global.localStorage.clear();
  const cursors = SupabaseRealtimeService.getSyncCursors();
  assert.deepStrictEqual(cursors, {});

  const sampleCursors = {
    transactions: { updated_at: '2026-09-07T10:00:00Z', id: 'tx-1' },
    transactions_tombstones: { deleted_at: '2026-09-07T10:05:00Z', id: 'tx-2' }
  };

  SupabaseRealtimeService.saveSyncCursors(sampleCursors);
  const retrieved = SupabaseRealtimeService.getSyncCursors();
  assert.deepStrictEqual(retrieved, sampleCursors);

  SupabaseRealtimeService.resetSyncCursors();
  assert.deepStrictEqual(SupabaseRealtimeService.getSyncCursors(), {});
});

test('SupabaseRealtimeService.suppressRealtimeFor toggles _suppressRealtimeEvents correctly', async () => {
  SupabaseRealtimeService.suppressRealtimeFor(50);
  assert.strictEqual(global.window._suppressRealtimeEvents, true);

  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(global.window._suppressRealtimeEvents, false);
});
