const test = require('node:test');
const assert = require('node:assert/strict');
const TransactionMutationService = require('../js/transactionMutationService.js');

test('TransactionMutationService exports all expected functions', () => {
  assert.equal(typeof TransactionMutationService.saveTransaction, 'function');
  assert.equal(typeof TransactionMutationService.saveTransactionOffline, 'function');
  assert.equal(typeof TransactionMutationService.deleteTransaction, 'function');
  assert.equal(typeof TransactionMutationService.deleteTransactionOffline, 'function');
});

test('saveTransactionOffline assigns UUID and stamps created_at/updated_at', () => {
  const storage = new Map();
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.generateUUID = () => 'test-uuid-1234';
  global.state = {
    transactions: [],
    currentUser: null
  };
  global.window = { state: global.state };

  const tx = { amount: 25.5, category: 'Food', date: '2026-09-07' };
  TransactionMutationService.saveTransactionOffline(tx);

  assert.equal(tx.id, 'test-uuid-1234');
  assert.ok(tx.created_at);
  assert.ok(tx.updated_at);
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'test-uuid-1234');
  assert.ok(storage.has('offline_transactions'));
});

test('saveTransaction updates balances and optimistic local storage', async () => {
  let balancesCalculated = false;
  let uiUpdated = false;
  let recentlySavedId = null;

  global.state = {
    transactions: [],
    currentUser: null,
    isSupabaseEnabled: false
  };
  global.window = {
    state: global.state,
    _markRecentlySaved: (id) => { recentlySavedId = id; },
    calculateInitialBalances: () => { balancesCalculated = true; },
    updateUI: () => { uiUpdated = true; }
  };
  global.generateUUID = () => 'tx-save-999';

  const tx = { amount: '50.00', category: 'Shopping' };
  const res = await TransactionMutationService.saveTransaction(tx);

  assert.equal(res, true);
  assert.equal(tx.amount, 50.00);
  assert.equal(balancesCalculated, true);
  assert.equal(uiUpdated, true);
  assert.equal(recentlySavedId, 'tx-save-999');
});

test('deleteTransaction removes transaction and archives to trash', () => {
  const storage = new Map();
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.state = {
    transactions: [{ id: 'tx-to-delete', amount: 10 }],
    trashTransactions: [],
    currentUser: null,
    isSupabaseEnabled: false
  };
  global.window = {
    state: global.state,
    calculateInitialBalances: () => {},
    updateUI: () => {}
  };
  global.ReceiptStorage = {
    remove: async () => {}
  };

  TransactionMutationService.deleteTransaction('tx-to-delete');

  assert.equal(global.state.transactions.length, 0);
  assert.equal(global.state.trashTransactions.length, 1);
  assert.equal(global.state.trashTransactions[0].id, 'tx-to-delete');
  assert.ok(storage.has('deleted_transactions_trash'));
});
