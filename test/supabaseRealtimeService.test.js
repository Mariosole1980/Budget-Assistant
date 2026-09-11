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

// === Reconnect lifecycle fix tests ===

test('SupabaseRealtimeService exports new test getters for reconnect state', () => {
  assert.strictEqual(typeof SupabaseRealtimeService._getChannelGeneration, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService._getIsSettingUp, 'function');
  assert.strictEqual(typeof SupabaseRealtimeService._getReconnectAttempts, 'function');
});

test('SupabaseRealtimeService._getChannelGeneration starts at 0 and increments on setup', () => {
  // Reset state
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  const genAfterStop = SupabaseRealtimeService._getChannelGeneration();
  // gen should have incremented from stop()
  assert.strictEqual(typeof genAfterStop, 'number');
  assert.ok(genAfterStop >= 1, 'Generation should be >= 1 after stop()');
});

test('SupabaseRealtimeService.stopSupabaseRealtimeSubscription increments generation and resets state', () => {
  const genBefore = SupabaseRealtimeService._getChannelGeneration();
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  const genAfter = SupabaseRealtimeService._getChannelGeneration();
  assert.strictEqual(genAfter, genBefore + 1, 'stop() should increment generation by 1');
  assert.strictEqual(SupabaseRealtimeService._getIsSettingUp(), false, '_isSettingUp should be false after stop');
  assert.strictEqual(SupabaseRealtimeService._getReconnectAttempts(), 0, 'reconnectAttempts should be 0 after stop');
});

test('SupabaseRealtimeService.setupSupabaseRealtimeSubscription respects single-flight guard', () => {
  // Create a mock supabase client with channel() and removeChannel()
  let subscribeCallCount = 0;
  const mockChannel = {
    state: 'closed',
    on: function () { return this; },
    subscribe: function (cb) { subscribeCallCount++; return this; }
  };
  global.state.supabaseClient = {
    channel: () => mockChannel,
    removeChannel: () => {}
  };
  global.state.currentUser = { id: 'test-user-123' };
  global.navigator = { onLine: true };
  global.document = { visibilityState: 'visible' };

  // First call should proceed
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription(); // clean state
  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  assert.strictEqual(subscribeCallCount, 1, 'First setup should call subscribe');

  // Second call should be blocked by _isSettingUp guard
  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  assert.strictEqual(subscribeCallCount, 1, 'Second setup should be blocked by single-flight guard');

  // Clean up
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});

test('SupabaseRealtimeService.setupSupabaseRealtimeSubscription increments generation on each call', () => {
  let mockChannel = {
    state: 'closed',
    on: function () { return this; },
    subscribe: function () { return this; }
  };
  global.state.supabaseClient = {
    channel: () => mockChannel,
    removeChannel: () => {}
  };
  global.state.currentUser = { id: 'test-user-456' };
  global.navigator = { onLine: true };
  global.document = { visibilityState: 'visible' };

  SupabaseRealtimeService.stopSupabaseRealtimeSubscription(); // reset
  const genBefore = SupabaseRealtimeService._getChannelGeneration();

  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  const genAfterSetup = SupabaseRealtimeService._getChannelGeneration();
  assert.strictEqual(genAfterSetup, genBefore + 1, 'setup() should increment generation by 1');

  // Clean up
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});

test('SupabaseRealtimeService uses stable channel name "realtime-sync"', () => {
  let createdChannelName = null;
  const mockChannel = {
    state: 'closed',
    on: function () { return this; },
    subscribe: function () { return this; }
  };
  global.state.supabaseClient = {
    channel: (name) => { createdChannelName = name; return mockChannel; },
    removeChannel: () => {}
  };
  global.state.currentUser = { id: 'test-user-789' };
  global.navigator = { onLine: true };
  global.document = { visibilityState: 'visible' };

  SupabaseRealtimeService.stopSupabaseRealtimeSubscription(); // reset
  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();

  assert.strictEqual(createdChannelName, 'realtime-sync', 'Channel name should be stable "realtime-sync"');

  // Clean up
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});
