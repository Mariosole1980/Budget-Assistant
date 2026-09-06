const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  getElementById: (id) => {
    return {
      innerHTML: '',
      style: {},
      classList: { contains: () => false },
      insertAdjacentHTML: () => {},
      addEventListener: () => {}
    };
  },
  documentElement: {
    style: {}
  }
};
global.getComputedStyle = () => ({
  getPropertyValue: () => '#7c6af7'
});
global.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = String(val); },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; }
};
global.TRANSLATIONS = {
  el: {
    restore: 'Επαναφορά',
    permanent_delete: 'Οριστική Διαγραφή',
    no_trash_items: 'Ο κάδος είναι άδειος.'
  },
  en: {
    restore: 'Restore',
    permanent_delete: 'Permanent Delete',
    no_trash_items: 'The trash bin is empty.'
  }
};
global.state = {
  lang: 'el',
  trashTransactions: [],
  transactions: [],
  isSupabaseEnabled: false,
  supabaseClient: null,
  currentUser: null
};
global.getCurrencySymbol = () => '€';
global.formatDisplayAmount = (amt) => String(amt);
global.calculateInitialBalances = () => {};
global.updateUI = () => {};
global.showConfirm = async () => true;
global.showSyncToast = () => {};
global.openModal = () => {};
global.purgePermanentlyDeletedTxIds = () => {};

const TrashBinService = require('../js/trashBinService.js');

test('TrashBinService exports all required functions', () => {
  assert.strictEqual(typeof TrashBinService.openTrashBinModal, 'function');
  assert.strictEqual(typeof TrashBinService.fetchTrashFromCloud, 'function');
  assert.strictEqual(typeof TrashBinService.renderTrashBinList, 'function');
  assert.strictEqual(typeof TrashBinService.restoreTransaction, 'function');
  assert.strictEqual(typeof TrashBinService.emptyTrashBin, 'function');
  assert.strictEqual(typeof TrashBinService.deleteSingleTrashItem, 'function');
  assert.strictEqual(typeof TrashBinService.restoreTrashGroup, 'function');
});

test('TrashBinService.restoreTransaction restores an item and flips status to active', async () => {
  global.state.trashTransactions = [
    { id: 'tx-123', amount: 50, note: 'Groceries', category: 'Food', status: 'deleted', deleted_at: '2026-09-01' }
  ];
  global.state.transactions = [];

  await TrashBinService.restoreTransaction('tx-123');

  assert.strictEqual(global.state.trashTransactions.length, 0);
  assert.strictEqual(global.state.transactions.length, 1);
  assert.strictEqual(global.state.transactions[0].id, 'tx-123');
  assert.strictEqual(global.state.transactions[0].status, 'active');
  assert.strictEqual(global.state.transactions[0].deleted_at, undefined);
});

test('TrashBinService.deleteSingleTrashItem permanently removes an item from trash', async () => {
  global.state.trashTransactions = [
    { id: 'tx-456', amount: 20, note: 'Coffee', status: 'deleted' }
  ];

  await TrashBinService.deleteSingleTrashItem('tx-456');

  assert.strictEqual(global.state.trashTransactions.length, 0);
  const stored = JSON.parse(global.localStorage.getItem('deleted_transactions_trash') || '[]');
  assert.strictEqual(stored.length, 0);
});

test('TrashBinService.emptyTrashBin clears all trash items', async () => {
  global.state.trashTransactions = [
    { id: 'tx-1', amount: 10, note: 'Item 1' },
    { id: 'tx-2', amount: 20, note: 'Item 2' }
  ];

  await TrashBinService.emptyTrashBin();

  assert.strictEqual(global.state.trashTransactions.length, 0);
  const stored = JSON.parse(global.localStorage.getItem('deleted_transactions_trash') || '[]');
  assert.strictEqual(stored.length, 0);
});

test('TrashBinService.restoreTrashGroup restores recurring snapshot and template backup', async () => {
  global.state.trashTransactions = [
    {
      id: 'group-1',
      is_recurring_group: true,
      templateId: 'tmpl-1',
      templateBackup: { id: 'tmpl-1', name: 'Rent Template' },
      affectedTransactionsSnapshot: [
        { id: 'tx-r1', amount: 500, note: 'Rent Sept', _synthetic: false },
        { id: 'tx-r2-synth', amount: 500, note: 'Rent Oct', _synthetic: true }
      ]
    }
  ];
  global.state.transactions = [];
  global.state.recurringTemplates = [];

  await TrashBinService.restoreTrashGroup('group-1');

  assert.strictEqual(global.state.trashTransactions.length, 0);
  assert.strictEqual(global.state.recurringTemplates.length, 1);
  assert.strictEqual(global.state.recurringTemplates[0].name, 'Rent Template');
  // Synthetic item skipped, real item restored
  assert.strictEqual(global.state.transactions.length, 1);
  assert.strictEqual(global.state.transactions[0].id, 'tx-r1');
  assert.strictEqual(global.state.transactions[0].status, 'active');
});
