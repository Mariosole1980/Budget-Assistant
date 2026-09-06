const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  visibilityState: 'visible',
  addEventListener() {},
  getElementById(id) {
    return { id, checked: false };
  }
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};
global.state = { lang: 'el' };
global.showSyncToast = () => {};
global.updateSettingsDisplay = () => {};
global.openPinModal = () => {};
global.showLockScreen = () => {};

const SecurityLockService = require('../js/securityLockService.js');

test('SecurityLockService exports all required functions', () => {
  assert.strictEqual(typeof SecurityLockService.changeAutoLockSetting, 'function');
  assert.strictEqual(typeof SecurityLockService._getAutoLockDelayMs, 'function');
  assert.strictEqual(typeof SecurityLockService._recordUserActivity, 'function');
  assert.strictEqual(typeof SecurityLockService._resetAutoLockTimer, 'function');
  assert.strictEqual(typeof SecurityLockService._triggerAutoLock, 'function');
  assert.strictEqual(typeof SecurityLockService._initAutoLock, 'function');
});

test('SecurityLockService._getAutoLockDelayMs resolves configured timeouts accurately', () => {
  global.localStorage.setItem('settings_auto_lock_delay', 'immediate');
  assert.strictEqual(SecurityLockService._getAutoLockDelayMs(), 0);

  global.localStorage.setItem('settings_auto_lock_delay', '1');
  assert.strictEqual(SecurityLockService._getAutoLockDelayMs(), 60000);

  global.localStorage.setItem('settings_auto_lock_delay', '5');
  assert.strictEqual(SecurityLockService._getAutoLockDelayMs(), 300000);

  global.localStorage.setItem('settings_auto_lock_delay', '10');
  assert.strictEqual(SecurityLockService._getAutoLockDelayMs(), 600000);

  global.localStorage.setItem('settings_auto_lock_delay', 'disabled');
  assert.strictEqual(SecurityLockService._getAutoLockDelayMs(), -1);
});

test('SecurityLockService._recordUserActivity records timestamp to memory and storage', () => {
  const before = Date.now();
  SecurityLockService._recordUserActivity();
  const stored = Number(global.localStorage.getItem('last_user_activity_timestamp'));
  assert.ok(stored >= before);
  assert.strictEqual(window._lastUserActivity, stored);
});
