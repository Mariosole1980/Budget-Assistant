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

test('AppLifecycleService._handleAppResumed executes safely', () => {
  assert.doesNotThrow(() => {
    AppLifecycleService._handleAppResumed();
  });
});
