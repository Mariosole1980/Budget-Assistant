const test = require('node:test');
const assert = require('node:assert/strict');
const DataLoaderService = require('../js/dataLoaderService.js');

test('DataLoaderService exports loadData and loadOfflineData', () => {
  assert.equal(typeof DataLoaderService.loadData, 'function');
  assert.equal(typeof DataLoaderService.loadOfflineData, 'function');
});

test('loadOfflineData in guest mode provides clean slate with demo filter and defaults', () => {
  const storage = new Map([
    ['offline_transactions', JSON.stringify([{ id: 'tx1' }, { id: 'demo_1', is_demo: true }])],
    ['cached_budgets', JSON.stringify([{ id: 'b1' }, { id: 'demo_b1', is_demo: true }])]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [{ id: 'cat1', name: 'Food' }];

  global.state = {
    guestMode: true,
    transactions: [],
    budgets: [],
    accounts: [],
    categories: []
  };
  global.window = { state: global.state };

  DataLoaderService.loadOfflineData();

  assert.equal(global.state.guestMode, true);
  assert.equal(global.state.currentUser, null);
  // Only the demo items should be retained
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'demo_1');
  assert.equal(global.state.budgets.length, 1);
  assert.equal(global.state.budgets[0].id, 'demo_b1');
  assert.equal(global.state.accounts.length, 1);
  assert.equal(global.state.categories.length, 1);
});

test('loadOfflineData restores cached user profile and transactions for authenticated session', () => {
  const mockUser = { id: 'user_123', email: 'user@example.com' };
  const mockTxs = [{ id: 'tx_auth_1', amount: 45 }];
  const storage = new Map([
    ['cached_current_user', JSON.stringify(mockUser)],
    ['cached_user_profile', JSON.stringify({ id: 'user_123', full_name: 'Test User' })],
    ['offline_transactions', JSON.stringify(mockTxs)]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };

  global.state = {
    guestMode: false,
    currentUser: null,
    transactions: []
  };
  global.window = { state: global.state };

  DataLoaderService.loadOfflineData();

  assert.equal(global.state.currentUser.id, 'user_123');
  assert.equal(global.state.userProfile.full_name, 'Test User');
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'tx_auth_1');
});

test('loadData handles guestMode by setting offline sync status and populating state', async () => {
  let syncStatus = null;
  const storage = new Map([
    ['offline_transactions', JSON.stringify([{ id: 'demo_tx', is_demo: true }])]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [{ id: 'cat1', name: 'Food' }];

  global.state = {
    guestMode: true,
    transactions: []
  };
  global.window = {
    state: global.state,
    updateHeaderSyncIcon: (s) => { syncStatus = s; }
  };
  global.updateHeaderSyncIcon = (s) => { syncStatus = s; };

  await DataLoaderService.loadData();

  assert.equal(syncStatus, 'offline');
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'demo_tx');
});
