const { test } = require('node:test');
const assert = require('node:assert');

// DOM Mocks
const bodyClassList = new Set();
const docClassList = new Set();
global.document = {
  body: {
    classList: {
      add: (c) => bodyClassList.add(c),
      remove: (c) => bodyClassList.delete(c),
      contains: (c) => bodyClassList.has(c)
    }
  },
  documentElement: {
    classList: {
      add: (c) => docClassList.add(c),
      remove: (c) => docClassList.delete(c),
      contains: (c) => docClassList.has(c)
    }
  }
};

global.window = global;
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.state = {
  currentUser: { id: 'u1' },
  partnerProfile: null,
  userProfile: { id: 'u1', family_id: 'fam1' },
  familyProfiles: [{ id: 'u1' }, { id: 'u2' }],
  activeAccountMode: 'family',
  transactions: [],
  accounts: []
};

global.CurrencyService = {
  displayAmount: (t) => parseFloat(t.amount) || 0
};
global.sanitizeFloat = (v) => Math.round(v * 100) / 100;

const TransactionScopeService = require('../js/transactionScopeService.js');

test('TransactionScopeService exports all expected functions', () => {
  assert.strictEqual(typeof TransactionScopeService.applyWalletTheme, 'function');
  assert.strictEqual(typeof TransactionScopeService.getActiveTransactions, 'function');
  assert.strictEqual(typeof TransactionScopeService.isTransferTransaction, 'function');
  assert.strictEqual(typeof TransactionScopeService.calculateInitialBalances, 'function');
});

test('TransactionScopeService.isTransferTransaction accurately identifies transfers', () => {
  assert.strictEqual(TransactionScopeService.isTransferTransaction({ type: 'transfer' }), true);
  assert.strictEqual(TransactionScopeService.isTransferTransaction({ type: 'expense', category: 'ΜΕΤΑΦΟΡΑ ΣΕ ΤΡΑΠΕΖΑ' }), true);
  assert.strictEqual(TransactionScopeService.isTransferTransaction({ type: 'expense', category: 'Internal Transfer' }), true);
  assert.strictEqual(TransactionScopeService.isTransferTransaction({ type: 'expense', category: 'Supermarket' }), false);
  assert.strictEqual(TransactionScopeService.isTransferTransaction({ type: 'income', category: 'Salary' }), false);
  assert.strictEqual(TransactionScopeService.isTransferTransaction(null), false);
});

test('TransactionScopeService.getActiveTransactions scopes and deduplicates correctly', () => {
  global.state.activeAccountMode = 'family';
  global.state.transactions = [
    { id: 'tx1', user_id: 'u1', amount: 50 },
    { id: 'tx2', user_id: 'u2', family_id: 'fam1', amount: 20 },
    { id: 'tx3', user_id: 'stranger', family_id: 'other', amount: 100 },
    { id: 'tx1', user_id: 'u1', amount: 50 } // duplicate ID
  ];

  const active = TransactionScopeService.getActiveTransactions();
  assert.strictEqual(active.length, 2);
  assert.strictEqual(active[0].id, 'tx1');
  assert.strictEqual(active[1].id, 'tx2');
});

test('TransactionScopeService.calculateInitialBalances computes correct account starting balances', () => {
  global.state.activeAccountMode = 'family';
  global.state.accounts = [
    { name: 'Cash', balance: 200, initial_balance: 0 }
  ];
  global.state.transactions = [
    { id: 'tx1', type: 'expense', account_from: 'Cash', amount: 50, user_id: 'u1' },
    { id: 'tx2', type: 'income', account_from: 'Cash', amount: 100, user_id: 'u1' }
  ];

  TransactionScopeService.calculateInitialBalances();
  // netSum = income(100) - expense(50) = +50
  // initial_balance = balance(200) - netSum(50) = 150
  assert.strictEqual(global.state.accounts[0].initial_balance, 150);
});

test('TransactionScopeService.applyWalletTheme toggles shared wallet class', () => {
  global.state.partnerProfile = { id: 'u2' };
  TransactionScopeService.applyWalletTheme();
  assert.strictEqual(bodyClassList.has('shared-wallet-active'), true);

  global.state.partnerProfile = null;
  TransactionScopeService.applyWalletTheme();
  assert.strictEqual(bodyClassList.has('shared-wallet-active'), false);
});

test('TransactionScopeService resolves state from window.state resiliently', () => {
  const origState = global.state;
  delete global.state;
  global.window.state = {
    currentUser: { id: 'u1' },
    activeAccountMode: 'personal',
    transactions: [
      { id: 'tx-win1', user_id: 'u1', amount: 35 }
    ]
  };

  const active = TransactionScopeService.getActiveTransactions();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].id, 'tx-win1');

  global.state = origState;
  global.window.state = origState;
});

