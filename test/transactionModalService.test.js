const { test } = require('node:test');
const assert = require('node:assert');

// Mock minimal DOM
const formAttributes = {};
const mockElements = {
  'transaction-form': {
    reset: () => {},
    setAttribute: (k, v) => { formAttributes[k] = v; },
    removeAttribute: (k) => { delete formAttributes[k]; },
    getAttribute: (k) => formAttributes[k],
    parentNode: { insertBefore: () => {} }
  },
  'trans-id': { value: '' },
  'trans-category': { value: '' },
  'trans-category-display': { innerHTML: '' },
  'trans-delete-btn': { style: {} },
  'trans-creator-row': { style: {} },
  'trans-date': { value: '' },
  'trans-date-display': { textContent: '' },
  'trans-account-from': { value: '' },
  'trans-account-to': { value: '' }
};

const genericElement = () => ({
  value: '',
  style: {},
  classList: { add: () => {}, remove: () => {} },
  querySelector: () => ({ textContent: '' })
});

global.document = {
  getElementById: (id) => {
    if (id === 'trans-readonly-warning') return mockElements[id] || null;
    if (!mockElements[id]) mockElements[id] = genericElement();
    return mockElements[id];
  },
  querySelector: () => null,
  createElement: (tag) => {
    const el = genericElement();
    el.id = '';
    return el;
  }
};

global.window = global;
global.state = {
  lang: 'el',
  accounts: [{ name: 'Cash', type: 'cash' }]
};

global.TRANSLATIONS = { el: { only_creator_edit_warning: 'Προειδοποίηση' } };
global._pendingReceiptFiles = [];

const TransactionModalService = require('../js/transactionModalService.js');

test('TransactionModalService exports all expected functions', () => {
  assert.strictEqual(typeof TransactionModalService.toggleTransactionFormLock, 'function');
  assert.strictEqual(typeof TransactionModalService.openAddTransactionModal, 'function');
  assert.strictEqual(typeof TransactionModalService.openEditTransactionModal, 'function');
});

global.setTransactionType = (type) => { global._lastSetType = type; };
global.setTransactionFormType = (type) => { global._lastSetType = type; };
global.clearRecurringSettings = () => {};
global.renderAccountSelectors = () => {};
global.renderReceiptPreviews = () => {};
global.updateTransactionModalHeader = (title) => { global._lastModalTitle = title; };
global.initNoteAutocomplete = () => {};
global.updateAmountCurrencySymbol = () => {};
global.openModal = (id, opts) => { global._lastOpenedModal = id; };
global.hideSubcategorySelect = () => {};
global.updateAccountDropdowns = () => {};
global.initTransactionCurrency = () => {};
global.formatGreekDateTime = (d) => d;
global.resolveRecurringTemplateForTx = () => null;
global.resetRepInstButton = () => {};
global.openRecurringModal = () => {};
global.updateCategoryDisplay = () => {};
global.updateSubcategorySuggestions = () => {};
global.updateSubcategoryRowVisibility = () => {};
global.syncActualAmountRowVisibility = () => {};
global.getTransactionCurrency = () => 'EUR';
global.CurrencyService = { updateAmountCurrencySymbol: () => {}, isEnabled: () => false };
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.DEFAULT_ACCOUNTS = [{ name: 'Cash', type: 'cash' }];
global._pendingReceiptDeleted = false;
global.formatCalcDisplay = (v) => String(v);

test('TransactionModalService.toggleTransactionFormLock toggles readonly state', () => {
  TransactionModalService.toggleTransactionFormLock(true);
  assert.strictEqual(mockElements['transaction-form'].getAttribute('data-readonly'), 'true');

  TransactionModalService.toggleTransactionFormLock(false);
  assert.strictEqual(mockElements['transaction-form'].getAttribute('data-readonly'), undefined);
});

test('TransactionModalService.openAddTransactionModal initializes add transaction flow', () => {
  TransactionModalService.openAddTransactionModal();
  assert.strictEqual(global._lastOpenedModal, 'transaction-modal');
  assert.strictEqual(global._lastSetType, 'expense');
  assert.strictEqual(mockElements['trans-id'].value, '');
});

test('TransactionModalService.openEditTransactionModal sets transaction data', () => {
  const sampleTx = {
    id: 'tx-123',
    type: 'income',
    category: 'Salary',
    amount: 1000,
    date: '2026-09-01',
    description: 'Work',
    account: 'Bank'
  };
  TransactionModalService.openEditTransactionModal(sampleTx);
  assert.strictEqual(global._lastOpenedModal, 'transaction-modal');
  assert.strictEqual(mockElements['trans-id'].value, 'tx-123');
});


