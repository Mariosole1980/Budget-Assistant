const { test } = require('node:test');
const assert = require('node:assert');

// Mock globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

global.state = {
  lang: 'el',
  transactions: [{ id: '1' }],
  trashTransactions: [{ id: '2' }],
  accounts: [{ name: 'Cash' }],
  categories: [{ name: 'Food' }],
  notes: [{ text: 'note' }],
  recurringTemplates: [{ id: 'rec-1' }],
  deletedRecurringDates: [],
  notifications: [],
  currentUser: null
};

global.document = {
  querySelectorAll() {
    return [];
  },
  getElementById() {
    return null;
  },
  body: {
    classList: {
      remove() {}
    }
  }
};

let toastMessages = [];
global.showSyncToast = (msg) => {
  toastMessages.push(msg);
};

global.updateUI = () => {};

const DangerZoneService = require('../js/dangerZoneService.js');

test('DangerZoneService: exports all expected functions', () => {
  assert.strictEqual(typeof DangerZoneService.clearCacheAndReset, 'function');
  assert.strictEqual(typeof DangerZoneService.clearLocalDataConfirm, 'function');
  assert.strictEqual(typeof DangerZoneService.deleteAccountConfirm, 'function');
});

test('DangerZoneService: clearCacheAndReset invokes forceAppUpdate if available', () => {
  let invoked = false;
  global.forceAppUpdate = () => { invoked = true; };
  DangerZoneService.clearCacheAndReset();
  assert.strictEqual(invoked, true);
  delete global.forceAppUpdate;
});

test('DangerZoneService: clearLocalDataConfirm rejects incorrect PIN', async () => {
  localStorage.setItem('app_pin', '1234');
  localStorage.setItem('app_lock_enabled', 'true');

  global.promptForPin = async () => '9999'; // wrong PIN
  toastMessages = [];

  await DangerZoneService.clearLocalDataConfirm();

  assert.ok(toastMessages.some(m => m.includes('Λάθος PIN') || m.includes('Incorrect PIN')));
  // state should NOT be wiped
  assert.strictEqual(state.transactions.length, 1);
});

test('DangerZoneService: clearLocalDataConfirm wipes data when valid PIN entered', async () => {
  localStorage.setItem('app_pin', '1234');
  localStorage.setItem('app_lock_enabled', 'true');
  localStorage.setItem('offline_transactions', JSON.stringify([{ id: '1' }]));

  global.promptForPin = async () => '1234'; // correct PIN
  toastMessages = [];

  await DangerZoneService.clearLocalDataConfirm();

  assert.strictEqual(state.transactions.length, 0);
  assert.strictEqual(state.accounts.length, 0);
  assert.strictEqual(localStorage.getItem('offline_transactions'), null);
  assert.ok(toastMessages.some(m => m.includes('εκκαθαρίστηκαν') || m.includes('cleared')));
});
