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
  transactions: [],
  accounts: []
};

global.escapeHtml = (str) => String(str || '').replace(/[&<>'"]/g, '');

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
        contains(c) { return classes.has(c); }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      setAttribute() {},
      getAttribute() { return null; },
      removeAttribute() {},
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement(tag) {
    return getMockElement('el_' + Math.random());
  }
};

global.updateUI = () => {};
global.calculateInitialBalances = () => {};
global.openModal = () => {};
global.closeModal = () => {};
global.updateAmountCurrencySymbol = () => {};

// Load CurrencyService dependency first
require('../js/CurrencyService.js');
const CurrencyPickerView = require('../js/currencyPickerView.js');

test('CurrencyPickerView: exports all expected functions and constants', () => {
  assert.ok(Array.isArray(CurrencyPickerView.POPULAR_CURRENCIES));
  assert.strictEqual(typeof CurrencyPickerView.getRecentCurrencies, 'function');
  assert.strictEqual(typeof CurrencyPickerView.rememberRecentCurrency, 'function');
  assert.strictEqual(typeof CurrencyPickerView.getTransactionCurrency, 'function');
  assert.strictEqual(typeof CurrencyPickerView.setTransactionCurrency, 'function');
  assert.strictEqual(typeof CurrencyPickerView.getFlagHtml, 'function');
  assert.strictEqual(typeof CurrencyPickerView.openCurrencyPickerModal, 'function');
  assert.strictEqual(typeof CurrencyPickerView.renderCurrencyPickerOptions, 'function');
  assert.strictEqual(typeof CurrencyPickerView.selectCurrencyOption, 'function');
  assert.strictEqual(typeof CurrencyPickerView.initMultiCurrency, 'function');
});

test('CurrencyPickerView: POPULAR_CURRENCIES contains standard major codes', () => {
  assert.ok(CurrencyPickerView.POPULAR_CURRENCIES.includes('EUR'));
  assert.ok(CurrencyPickerView.POPULAR_CURRENCIES.includes('USD'));
  assert.ok(CurrencyPickerView.POPULAR_CURRENCIES.includes('GBP'));
});

test('CurrencyPickerView: getRecentCurrencies and rememberRecentCurrency manage storage correctly', () => {
  localStorage.removeItem('recent_currencies');
  assert.deepStrictEqual(CurrencyPickerView.getRecentCurrencies(), []);

  CurrencyPickerView.rememberRecentCurrency('USD');
  assert.deepStrictEqual(CurrencyPickerView.getRecentCurrencies(), ['USD']);

  CurrencyPickerView.rememberRecentCurrency('GBP');
  assert.deepStrictEqual(CurrencyPickerView.getRecentCurrencies(), ['GBP', 'USD']);

  CurrencyPickerView.rememberRecentCurrency('USD');
  assert.deepStrictEqual(CurrencyPickerView.getRecentCurrencies(), ['USD', 'GBP']);
});

test('CurrencyPickerView: getFlagHtml produces flag image with fallback', () => {
  const htmlEur = CurrencyPickerView.getFlagHtml('🇪🇺', 'EUR');
  assert.ok(htmlEur.includes('flagcdn.com'));
  assert.ok(htmlEur.includes('eu.png'));

  const htmlFallback = CurrencyPickerView.getFlagHtml('', 'XYZ_UNKNOWN');
  assert.ok(htmlFallback.includes('🌐'));
});

test('CurrencyPickerView: setTransactionCurrency and getTransactionCurrency manage trans-currency input', () => {
  CurrencyPickerView.setTransactionCurrency('USD');
  const code = CurrencyPickerView.getTransactionCurrency();
  assert.strictEqual(code, 'USD');

  CurrencyPickerView.setTransactionCurrency('GBP');
  assert.strictEqual(CurrencyPickerView.getTransactionCurrency(), 'GBP');
});
