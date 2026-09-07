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
  currentUser: { id: 'user-1' },
  userProfile: { base_currency: 'EUR', display_currency: 'EUR' }
};

let inAppNotifications = [];
global.addInAppNotification = (title, body, meta) => {
  inAppNotifications.push({ title, body, meta });
};

let syncToasts = [];
global.showSyncToast = (msg) => {
  syncToasts.push(msg);
};

global.formatCurrency = (num) => '€' + Number(num).toFixed(2);
global.getCategoryDisplayName = (name) => name;
global.getDisplayCurrency = () => 'EUR';

// Load CurrencyService dependency first
require('../js/CurrencyService.js');
const HighExpenseAlertService = require('../js/highExpenseAlertService.js');

test('HighExpenseAlertService: exports all expected functions', () => {
  assert.strictEqual(typeof HighExpenseAlertService.checkHighExpenseAlert, 'function');
  assert.strictEqual(typeof HighExpenseAlertService.computeCurrencyFields, 'function');
});

test('HighExpenseAlertService: checkHighExpenseAlert triggers alert when expense exceeds limit', () => {
  localStorage.setItem('settings_expense_alert_enabled', 'true');
  localStorage.setItem('settings_expense_alert_limit', '100');
  inAppNotifications = [];
  syncToasts = [];

  const tx = { type: 'expense', amount: 150, category: 'Food', user_id: 'user-1' };
  HighExpenseAlertService.checkHighExpenseAlert(tx);

  assert.strictEqual(inAppNotifications.length, 1);
  assert.ok(inAppNotifications[0].title.includes('Υψηλή Δαπάνη'));
  assert.strictEqual(syncToasts.length, 1);
});

test('HighExpenseAlertService: checkHighExpenseAlert ignores income or amounts below limit', () => {
  localStorage.setItem('settings_expense_alert_enabled', 'true');
  localStorage.setItem('settings_expense_alert_limit', '100');
  inAppNotifications = [];
  syncToasts = [];

  // Income
  HighExpenseAlertService.checkHighExpenseAlert({ type: 'income', amount: 500 });
  assert.strictEqual(inAppNotifications.length, 0);

  // Expense below limit
  HighExpenseAlertService.checkHighExpenseAlert({ type: 'expense', amount: 50 });
  assert.strictEqual(inAppNotifications.length, 0);
});

test('HighExpenseAlertService: computeCurrencyFields calculates base fields correctly', () => {
  const tx = { amount: 80, currency: 'EUR', date: '2026-09-07' };
  const res = HighExpenseAlertService.computeCurrencyFields(tx);

  assert.strictEqual(res.base_currency, 'EUR');
  assert.strictEqual(res.rate_to_base, 1);
  assert.strictEqual(res.amount_base, 80);
  assert.strictEqual(res.rate_source, 'api');
  assert.ok(res.fx_snapshot);
  assert.strictEqual(res.fx_snapshot.rate, 1);
});
