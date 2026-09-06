const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  _elements: {},
  getElementById(id) {
    if (!this._elements[id]) {
      this._elements[id] = {
        id,
        innerHTML: '',
        value: '',
        style: {},
        classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
        appendChild: () => {},
        matches: () => false
      };
    }
    return this._elements[id];
  },
  querySelector() {
    return { style: {}, classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} } };
  },
  querySelectorAll() {
    return [];
  },
  createElement(tag) {
    return {
      tag,
      style: {},
      className: '',
      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
      setAttribute: () => {},
      appendChild: () => {},
      addEventListener: () => {}
    };
  }
};

global.state = {
  lang: 'el',
  accounts: [
    { id: 'acc-1', name: 'Alpha Bank', balance: 1500, type: 'bank' }
  ],
  transactions: []
};

global.TRANSLATIONS = require('../js/translations.js');
global.localStorage = { getItem: () => null, setItem: () => {} };
global.getActiveTransactions = () => [];
global.getDisplayCurrency = () => 'EUR';
global.getCurrencySymbol = () => '€';
global.formatDisplayAmount = (v) => String(v);
global.updateSafeToSpendUI = () => {};
global.getTransactionsBaseCurrency = () => 'EUR';
global.getAccountBalanceInBase = (acc) => acc ? (acc.balance || 0) : 0;
global.computeNetWorth = () => 1500;
global.renderIconGlyph = () => '🏦';
global.isTransferTransaction = () => false;
global.CurrencyService = {
  toBase: (t) => typeof t === 'object' ? (t.amount || 0) : (t || 0),
  displayAmount: (t) => typeof t === 'object' ? (t.amount || 0) : (t || 0),
  convert: (a) => a
};
global.displayAmountInDisplayCurrency = (amount) => amount;
global.getAccountDisplayName = (acc) => (acc ? acc.name : '');

const FHE = require('../js/financialHealthEngine.js');
global.calculateFinancialHealthScore = FHE.calculateFinancialHealthScore;
global.calculateForecasting = FHE.calculateForecasting;
global.classifyCategory = FHE.classifyCategory;

const AccountsView = require('../js/accountsView.js');

test('AccountsView exports renderAccountsTab function', () => {
  assert.strictEqual(typeof AccountsView.renderAccountsTab, 'function');
});

test('AccountsView.renderAccountsTab executes without throwing', () => {
  assert.doesNotThrow(() => {
    AccountsView.renderAccountsTab();
  });
});
