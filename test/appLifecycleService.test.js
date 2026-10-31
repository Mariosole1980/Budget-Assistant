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
  lang: 'el'
};

const AppLifecycleService = require('../js/appLifecycleService.js');

test('AppLifecycleService exports all expected functions', () => {
  assert.strictEqual(typeof AppLifecycleService.saveCurrentUIStateToStorage, 'function');
  assert.strictEqual(typeof AppLifecycleService._handleAppBackgrounded, 'function');
  assert.strictEqual(typeof AppLifecycleService._refreshSessionIfNeeded, 'function');
  assert.strictEqual(typeof AppLifecycleService.handleAppForegroundSync, 'function');
  assert.strictEqual(typeof AppLifecycleService._handleAppResumed, 'function');
  assert.strictEqual(typeof AppLifecycleService.initLifecycleListeners, 'function');
});

test('AppLifecycleService returns accurate guard windows', () => {
  assert.strictEqual(AppLifecycleService.getResumeGuardMs(), 1700);
  assert.strictEqual(AppLifecycleService.getRealtimeResumeGuardMs(), 10000);
});

test('AppLifecycleService.saveCurrentUIStateToStorage saves background timestamp', () => {
  global.localStorage.clear();
  AppLifecycleService.saveCurrentUIStateToStorage();
  const ts = global.localStorage.getItem('app_background_timestamp');
  assert.ok(ts, 'app_background_timestamp should be saved');
  assert.ok(Number(ts) > 0, 'timestamp should be a positive number');
});

test('AppLifecycleService._handleAppBackgrounded stops realtime and saves state', () => {
  let realtimeStopped = false;
  global.stopSupabaseRealtimeSubscription = () => { realtimeStopped = true; };
  global.localStorage.clear();

  AppLifecycleService._handleAppBackgrounded();

  assert.strictEqual(realtimeStopped, true, 'stopSupabaseRealtimeSubscription should be called on backgrounding');
  const ts = global.localStorage.getItem('app_background_timestamp');
  assert.ok(ts, 'background timestamp should be recorded');
  delete global.stopSupabaseRealtimeSubscription;
});

test('AppLifecycleService._handleAppResumed executes safely', () => {
  assert.doesNotThrow(() => {
    AppLifecycleService._handleAppResumed();
  });
});

// ---------------------------------------------------------------------------
// REGRESSION: resume tap latency.
// handleAppForegroundSync() used to fire the heavy sync at a hard 1500ms after
// the resume, which landed exactly on the first tap after returning from the
// background (Περισσότερα / Επισκόπηση). forceSyncNow() + a full updateUI()
// render then blocked the main thread, so the tap only opened 1-2s later with
// no press feedback. The sync must now wait for the resume guard, then for a
// quiet screen (no touch/scroll for _FOREGROUND_SYNC_QUIET_MS), and keep being
// pushed back every _FOREGROUND_SYNC_POLL_MS while the user is interacting.
// ---------------------------------------------------------------------------
test('handleAppForegroundSync defers the heavy sync while the screen is being touched', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() });

  const syncCalls = [];
  global.state.currentUser = { id: 'user-1' };
  global.state.supabaseClient = {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) }
  };
  global.state.lastSyncTime = Date.now() - 60000; // stale -> a sync is allowed
  global.forceSyncNow = async (opts) => { syncCalls.push({ at: Date.now(), opts }); };
  global.window._lastUserActivity = Date.now();

  try {
    AppLifecycleService.handleAppForegroundSync();
    const scheduledAt = Date.now();

    // 1) Nothing may run during the resume guard / minimum-delay window,
    //    which is exactly where the old 1500ms timer fired.
    t.mock.timers.tick(1500);
    assert.strictEqual(syncCalls.length, 0, 'sync must not run 1.5s after resume (the old bug)');

    // 2) The user taps Περισσότερα right then.
    global.window._lastUserActivity = Date.now();

    // 3) The minimum delay elapses (2100ms) but the screen is not quiet yet.
    t.mock.timers.tick(600);
    assert.strictEqual(syncCalls.length, 0, 'sync must not start under the user finger');

    // 4) The next poll (700ms later) sees a quiet screen and starts the sync.
    t.mock.timers.tick(700);
    t.mock.timers.tick(0); // flush the queued setTimeout(..., 0)
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(syncCalls.length, 1, 'sync must run once the screen is quiet');
    assert.strictEqual(syncCalls[0].opts, true, 'the foreground sync must pass force=true');
    assert.ok(
      syncCalls[0].at - scheduledAt >= 2800,
      `sync must wait for a quiet screen (ran after ${syncCalls[0].at - scheduledAt}ms)`
    );
  } finally {
    delete global.forceSyncNow;
    global.state.currentUser = null;
    delete global.state.supabaseClient;
    delete global.state.lastSyncTime;
    global.window._lastUserActivity = 0;
    t.mock.timers.reset();
  }
});

