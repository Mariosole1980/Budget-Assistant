const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  accounts: [
    { name: 'Μετρητά', balance: 300 },
    { name: 'Τράπεζα', balance: 1700 }
  ],
  transactions: [],
  recurringTemplates: [
    { id: 'rec-1', amount: 50, category: 'Bills', is_active: true, day_of_month: 15 }
  ],
  budgets: []
};

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
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classes.add(c);
            else classes.delete(c);
            return force;
          }
          if (classes.has(c)) { classes.delete(c); return false; }
          else { classes.add(c); return true; }
        }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      dataset: {},
      querySelector() { return { onclick: null, addEventListener() {} }; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      innerHTML: '',
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      querySelector() { return { onclick: null, addEventListener() {} }; }
    };
  },
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return getMockElement(sel.slice(1));
    return { onclick: null, addEventListener() {} };
  },
  querySelectorAll() {
    return [];
  }
};

let openedModal = null;
let closedModal = null;
global.openModal = (id) => { openedModal = id; };
global.closeModal = (id) => { closedModal = id; };

global.sanitizeFloat = (num) => Math.round(Number(num) * 100) / 100;
global.getCurrencySymbol = () => '€';
global.formatDisplayAmount = (amt) => String(amt);
global.escapeHtml = (str) => String(str || '');
global.generateUUID = () => 'uuid-' + Math.random().toString(36).slice(2);
global.updateUI = () => {};
global.showToast = () => {};

const SafeToSpendView = require('../js/safeToSpendView.js');

test('SafeToSpendView: exports all expected functions', () => {
  const expectedFns = [
    'getLiquidBalance',
    'getUnpaidRecurringBillsThisMonth',
    'getMonthlySavingsGoal',
    'updateSafeToSpendUI',
    'openSafeToSpendModal',
    'runWhatIfSimulation',
    'openAiAdvisorFromBar',
    'openSubscriptionsHubModal',
    'renderSubscriptionsHub',
    'acceptDetectedSubscription',
    'quickPaySubscription'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof SafeToSpendView[fn], 'function', `${fn} must be a function`);
  });
});

test('SafeToSpendView: getLiquidBalance calculates total balance of accounts', () => {
  const balance = SafeToSpendView.getLiquidBalance();
  assert.strictEqual(balance, 2000);
});

test('SafeToSpendView: getMonthlySavingsGoal returns saved goal or default', () => {
  state.budgets = [{ name: 'Αποταμίευση', amount: 250 }];
  const goal = SafeToSpendView.getMonthlySavingsGoal();
  assert.strictEqual(goal, 250);

  state.budgets = [];
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 0);
});

test('SafeToSpendView: openSafeToSpendModal and openSubscriptionsHubModal trigger openModal', () => {
  openedModal = null;
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(openedModal, 'safe-to-spend-modal');

  openedModal = null;
  SafeToSpendView.openSubscriptionsHubModal();
  assert.strictEqual(openedModal, 'subscriptions-hub-modal');
});
