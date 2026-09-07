const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  currentUser: { id: 'test-user-1' },
  userProfile: { display_currency: 'EUR' },
  accounts: [
    { name: 'Cash', balance: 100, currency: 'EUR' },
    { name: 'Bank', balance: 250, currency: 'EUR' }
  ],
  transactions: []
};

global.escapeHtml = (s) => String(s || '');

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, f) { if (f !== undefined) { f ? classes.add(c) : classes.delete(c); } }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) { return getMockElement(id); },
  querySelector(sel) { return null; },
  querySelectorAll() { return []; },
  createElement() { return getMockElement('mock-' + Math.random()); }
};

global.updateUI = () => {};
global.applyTheme = () => {};
global.applyFontSize = () => {};
global.checkBiometricsSupport = () => {};
global.showLockScreen = () => {};
global.openModal = () => {};
global.closeModal = () => {};
global.updateNoteShortcutVisibility = () => {};

// Load CurrencyService dependency first
require('../js/CurrencyService.js');
const CurrencyFormattingService = require('../js/currencyFormattingService.js');

test('CurrencyFormattingService: exports all expected functions', () => {
  const expectedFns = [
    'getCurrencySymbol',
    'updateCurrencySymbols',
    'updateAmountCurrencySymbol',
    'getTransactionCurrencySymbol',
    'getTxCurrencyCode',
    'getReliabilityBadge',
    'getTxCurrencyLabel',
    'updateDualAmountDisplay',
    'getDisplayCurrency',
    'getTransactionsBaseCurrency',
    'displayAmountInDisplayCurrency',
    'formatDisplayAmount',
    'getAccountBalanceInBase',
    'computeNetWorth',
    'changeMonthStartSetting',
    'changeWeekStartSetting',
    'changeCurrencySetting',
    'populateCurrencySelect',
    'updateSettingsDisplay',
    'openSettingsPicker',
    'initSettingsFromStorage'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof CurrencyFormattingService[fn], 'function', fn + ' must be a function');
  });
});

test('CurrencyFormattingService: getCurrencySymbol returns standard symbols', () => {
  localStorage.setItem('app_currency', 'USD');
  state.userProfile.display_currency = 'USD';
  assert.strictEqual(CurrencyFormattingService.getCurrencySymbol(), '$');

  localStorage.setItem('app_currency', 'EUR');
  state.userProfile.display_currency = 'EUR';
  assert.strictEqual(CurrencyFormattingService.getCurrencySymbol(), '€');
});

test('CurrencyFormattingService: getDisplayCurrency returns preferred currency', () => {
  localStorage.setItem('app_currency', 'GBP');
  state.userProfile.display_currency = 'GBP';
  assert.strictEqual(CurrencyFormattingService.getDisplayCurrency(), 'GBP');
});

test('CurrencyFormattingService: computeNetWorth computes sum of account balances', () => {
  localStorage.setItem('app_currency', 'EUR');
  state.userProfile.display_currency = 'EUR';
  const netWorth = CurrencyFormattingService.computeNetWorth();
  assert.strictEqual(netWorth, 350);
});

test('CurrencyFormattingService: changeMonthStartSetting and changeWeekStartSetting persist values', () => {
  CurrencyFormattingService.changeMonthStartSetting('15');
  assert.strictEqual(localStorage.getItem('app_month_start'), '15');

  CurrencyFormattingService.changeWeekStartSetting('0');
  assert.strictEqual(localStorage.getItem('app_week_start'), '0');
});
