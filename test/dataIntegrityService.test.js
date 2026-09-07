const { test } = require('node:test');
const assert = require('node:assert');

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; }
};

global.window = global;
global.state = {
  transactions: [],
  categories: [],
  currentUser: { id: 'u1' },
  supabaseClient: null
};

global.compareTransactions = (a, b) => String(a.id).localeCompare(String(b.id));
global.calculateInitialBalances = () => {};
global.updateUI = () => {};

const DataIntegrityService = require('../js/dataIntegrityService.js');

test('DataIntegrityService exports all expected functions and constants', () => {
  assert.strictEqual(typeof DataIntegrityService.cleanDuplicateCategories, 'function');
  assert.strictEqual(typeof DataIntegrityService.cleanDuplicateTransactions, 'function');
  assert.strictEqual(typeof DataIntegrityService.getPendingLocalTransactions, 'function');
  assert.strictEqual(typeof DataIntegrityService.collectPermanentlyDeletedTxIds, 'function');
  assert.strictEqual(typeof DataIntegrityService.reconcileStaleTombstones, 'function');
  assert.strictEqual(typeof DataIntegrityService.purgePermanentlyDeletedTxIds, 'function');
  assert.strictEqual(typeof DataIntegrityService.autoSyncMissingTransactionsToCloud, 'function');
  assert.strictEqual(DataIntegrityService._PERMANENT_DELETED_LS_KEY, 'permanent_deleted_tx_ids');
});

test('DataIntegrityService.cleanDuplicateTransactions deduplicates by ID only', async () => {
  global.state.transactions = [
    { id: 'tx-1', amount: 50, category: 'Food' },
    { id: 'tx-2', amount: 30, category: 'Transport' },
    { id: 'tx-1', amount: 50, category: 'Food' }, // duplicate id
    { id: 'tx-3', amount: 50, category: 'Food' }  // identical content, distinct id -> kept
  ];

  await DataIntegrityService.cleanDuplicateTransactions();
  assert.strictEqual(global.state.transactions.length, 3);
  const ids = global.state.transactions.map(t => t.id);
  assert.deepStrictEqual(ids.sort(), ['tx-1', 'tx-2', 'tx-3']);
});

test('DataIntegrityService.collectPermanentlyDeletedTxIds collects from trash and tombstones', () => {
  localStorage.clear();
  localStorage.setItem('deleted_transactions_trash', JSON.stringify([{ id: 'del-1' }]));
  localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(['perm-1']));
  localStorage.setItem('offline_transactions', JSON.stringify([{ id: 'off-del', status: 'deleted' }]));

  const collected = DataIntegrityService.collectPermanentlyDeletedTxIds();
  assert.strictEqual(collected.has('del-1'), true);
  assert.strictEqual(collected.has('perm-1'), true);
  assert.strictEqual(collected.has('off-del'), true);
  assert.strictEqual(collected.has('other'), false);
});

test('DataIntegrityService.reconcileStaleTombstones cleans stale tombstones for cloud-active items', () => {
  localStorage.clear();
  localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(['active-cloud-1', 'real-perm-2']));
  localStorage.setItem('deleted_transactions_trash', JSON.stringify([{ id: 'active-cloud-1' }, { id: 'other-trash' }]));

  const cloudActive = [{ id: 'active-cloud-1' }];
  const cleaned = DataIntegrityService.reconcileStaleTombstones(cloudActive);
  assert.strictEqual(cleaned > 0, true);

  const permAfter = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids'));
  assert.strictEqual(permAfter.includes('active-cloud-1'), false);
  assert.strictEqual(permAfter.includes('real-perm-2'), true);
});

test('DataIntegrityService.purgePermanentlyDeletedTxIds removes IDs from state and local storage', () => {
  global.state.transactions = [
    { id: 'keep-1' },
    { id: 'purge-me' }
  ];
  localStorage.setItem('offline_transactions', JSON.stringify(global.state.transactions));

  DataIntegrityService.purgePermanentlyDeletedTxIds(['purge-me']);
  assert.strictEqual(global.state.transactions.length, 1);
  assert.strictEqual(global.state.transactions[0].id, 'keep-1');

  const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]');
  assert.strictEqual(perm.includes('purge-me'), true);
});
