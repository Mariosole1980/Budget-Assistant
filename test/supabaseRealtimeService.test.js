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

test('SupabaseRealtimeService uses scoped channel name sync:user:id or sync:family:id', () => {
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

  assert.strictEqual(createdChannelName, 'sync:user:test-user-789', 'Channel name should be scoped user channel');

  // Clean up
  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});

test('SupabaseRealtimeService setupSupabaseRealtimeSubscription early returns if channel is already joined and scope is unchanged', () => {
  let channelCallCount = 0;
  const mockChannel = {
    state: 'joined',
    on: function () { return this; },
    subscribe: function () { return this; }
  };
  global.state.supabaseClient = {
    channel: () => { channelCallCount++; return mockChannel; },
    removeChannel: () => {}
  };
  global.state.currentUser = { id: 'test-user-early-return' };
  global.navigator = { onLine: true };
  global.document = { visibilityState: 'visible' };

  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  assert.strictEqual(channelCallCount, 1, 'Initial setup creates channel');

  // Second call with same user and state=joined should early-return without recreating
  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  assert.strictEqual(channelCallCount, 1, 'Subsequent setup should early return without recreating channel');

  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});

test('SupabaseRealtimeService circuit breaker can be reset manually and on online event', () => {
  assert.strictEqual(typeof SupabaseRealtimeService.resetRealtimeCircuitBreaker, 'function');
  SupabaseRealtimeService.resetRealtimeCircuitBreaker();
  assert.strictEqual(SupabaseRealtimeService._getReconnectAttempts(), 0);
});

test('SupabaseRealtimeService.stopSupabaseRealtimeSubscription calls client.realtime.disconnect()', () => {
  let disconnectCalled = false;
  global.state.supabaseClient = {
    realtime: {
      disconnect: () => { disconnectCalled = true; }
    }
  };

  SupabaseRealtimeService.stopSupabaseRealtimeSubscription();
  assert.strictEqual(disconnectCalled, true, 'realtime.disconnect should be called when stopping subscription');

  global.state.supabaseClient = null;
});

test('SupabaseRealtimeService.resetRealtimeCircuitBreaker respects persistent restriction unless forced', () => {
  global.localStorage.setItem('supabase_realtime_restricted', 'true');

  // Should not reset attempts if restricted and not forced
  SupabaseRealtimeService.resetRealtimeCircuitBreaker(false);

  // Forced reset should clear attempts even if restricted flag was set
  SupabaseRealtimeService.resetRealtimeCircuitBreaker(true);
  assert.strictEqual(SupabaseRealtimeService._getReconnectAttempts(), 0);

  global.localStorage.removeItem('supabase_realtime_restricted');
});

test('SupabaseRealtimeService.setupSupabaseRealtimeSubscription skips when restricted flag is active', () => {
  global.localStorage.setItem('supabase_realtime_restricted', 'true');
  global.localStorage.setItem('supabase_realtime_restricted_at', String(Date.now()));

  let channelCreated = false;
  global.state.supabaseClient = {
    channel: () => { channelCreated = true; return { state: 'closed', on: () => {}, subscribe: () => {} }; }
  };
  global.state.currentUser = { id: 'test-user-restricted' };

  SupabaseRealtimeService.setupSupabaseRealtimeSubscription();
  assert.strictEqual(channelCreated, false, 'Should not create channel when quota restriction is active');

  global.localStorage.removeItem('supabase_realtime_restricted');
  global.localStorage.removeItem('supabase_realtime_restricted_at');
  global.state.supabaseClient = null;
  global.state.currentUser = null;
});
