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
  currentUser: { id: 'test-user-123', email: 'test@example.com' },
  lang: 'el',
  supabaseClient: null
};

const OfflineImportService = require('../js/offlineImportService.js');

test('OfflineImportService exports all expected functions', () => {
  assert.strictEqual(typeof OfflineImportService.getOfflineGuestTransactions, 'function');
  assert.strictEqual(typeof OfflineImportService.saveOfflineGuestTransactions, 'function');
  assert.strictEqual(typeof OfflineImportService.updateOfflineImportSettingsRow, 'function');
  assert.strictEqual(typeof OfflineImportService.ensureOfflineImportModal, 'function');
  assert.strictEqual(typeof OfflineImportService.showOfflineImportPrompt, 'function');
  assert.strictEqual(typeof OfflineImportService.triggerManualOfflineImport, 'function');
  assert.strictEqual(typeof OfflineImportService.transferOfflineDataToAccount, 'function');
  assert.strictEqual(typeof OfflineImportService.syncLocalTransactionsToCloud, 'function');
});

test('OfflineImportService saves and retrieves guest transactions excluding demo ones', () => {
  global.localStorage.clear();
  assert.deepStrictEqual(OfflineImportService.getOfflineGuestTransactions(), []);

  const sample = [
    { id: 'guest-1', amount: 42, is_demo: false },
    { id: 'demo_123', amount: 10, is_demo: true },
    { id: 'guest-2', amount: 84 }
  ];

  OfflineImportService.saveOfflineGuestTransactions(sample);
  const retrieved = OfflineImportService.getOfflineGuestTransactions();
  assert.strictEqual(retrieved.length, 2);
  assert.strictEqual(retrieved[0].id, 'guest-1');
  assert.strictEqual(retrieved[1].id, 'guest-2');

  // Saving empty array removes the item
  OfflineImportService.saveOfflineGuestTransactions([]);
  assert.deepStrictEqual(OfflineImportService.getOfflineGuestTransactions(), []);
});

test('OfflineImportService.showOfflineImportPrompt returns null when count is zero', async () => {
  global.localStorage.clear();
  const res = await OfflineImportService.showOfflineImportPrompt('user-1', 'test@test.com', false);
  assert.strictEqual(res, null);
});

test('OfflineImportService.syncLocalTransactionsToCloud handles empty cache gracefully', async () => {
  global.localStorage.clear();
  await assert.doesNotReject(async () => {
    await OfflineImportService.syncLocalTransactionsToCloud('user-1');
  });
});
