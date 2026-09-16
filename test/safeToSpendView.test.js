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
    'quickPaySubscription',
    'toggleStsSavingsGoalEditor',
    'setStsSavingsInputValue',
    'saveStsSavingsGoal',
    'updateStsSavingsAnnualHint'
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
  localStorage.removeItem('ba_monthly_savings_goal');
  localStorage.removeItem('ba_quick_start_profile');
  localStorage.removeItem('overview_savings_target');

  state.budgets = [{ name: 'Αποταμίευση', amount: 250 }];
  let goal = SafeToSpendView.getMonthlySavingsGoal();
  assert.strictEqual(goal, 250);

  state.budgets = [];
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 0);

  // Test ba_monthly_savings_goal priority
  localStorage.setItem('ba_monthly_savings_goal', '320');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 320);

  // Test annual target fallback
  localStorage.removeItem('ba_monthly_savings_goal');
  localStorage.setItem('overview_savings_target', '2400');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 200);

  localStorage.removeItem('overview_savings_target');

  // Test year savings rate fallback from transactions (must only apply when { includeEstimate: true })
  const thisYear = new Date().getFullYear();
  state.transactions = [
    { type: 'income', amount: 3000, date: `${thisYear}-01-15` },
    { type: 'expense', amount: 1000, date: `${thisYear}-01-20` }
  ];
  const elapsedMonths = Math.max(1, new Date().getMonth() + 1);
  const expectedRate = Math.round(2000 / elapsedMonths);
  // Unconfigured goal must return 0 by default to prevent false overdrafts
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 0);
  // Must return expected rate when explicitly requesting estimate
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal({ includeEstimate: true }), expectedRate);
  state.transactions = [];
});

test('SafeToSpendView: getLiquidBalance uses cashflow baseline when accounts balance is 0', () => {
  const savedAccs = state.accounts;
  const savedTxs = state.transactions;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  state.accounts = [
    { name: 'Cash', balance: 0 },
    { name: 'Bank Account', balance: 0 }
  ];
  state.transactions = [
    { type: 'income', amount: 1500, date: `${currentYear}-${currentMonth}-01` },
    { type: 'expense', amount: 300, date: `${currentYear}-${currentMonth}-05` }
  ];

  const liquid = SafeToSpendView.getLiquidBalance();
  assert.strictEqual(liquid, 1200);

  state.accounts = savedAccs;
  state.transactions = savedTxs;
});

test('SafeToSpendView: getLiquidBalance does not double-count future-dated recurring transactions', () => {
  const savedAccs = state.accounts;
  const savedTxs = state.transactions;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  state.accounts = [{ name: 'Cash', balance: 0 }];
  state.transactions = [
    { type: 'income', amount: 1000, date: `${currentYear}-${currentMonth}-01` },
    { type: 'expense', amount: 200, date: `${currentYear}-${currentMonth}-02` },
    // Future-dated recurring expense on the 28th (should NOT be deducted from spentThisMonth)
    { type: 'expense', amount: 150, date: `${currentYear}-${currentMonth}-28` }
  ];

  // If today is before the 28th, the future expense should not be deducted from cashflow baseline
  const today = now.getDate();
  const liquid = SafeToSpendView.getLiquidBalance();
  if (today < 28) {
    assert.strictEqual(liquid, 800); // 1000 - 200 (150 is preserved for unpaid bills)
  }

  state.accounts = savedAccs;
  state.transactions = savedTxs;
});

test('SafeToSpendView: updateSafeToSpendUI anti-glitch guard prevents flicker to 0 during in-flight sync', () => {
  // Setup stable state
  state._lastSafeToSpendResult = {
    safeDaily: 21.08,
    safeWeekly: 147.56,
    daysRemaining: 15,
    status: 'healthy'
  };

  const dailyEl = getMockElement('trans-sts-daily-val');
  dailyEl.textContent = '€ 21,08';

  // Mock in-flight sync flag
  global.SupabaseRealtimeService = {
    isForceSyncInFlight: () => true
  };

  // Temporarily empty transactions (as during sync)
  const savedTxs = state.transactions;
  const savedAccs = state.accounts;
  state.transactions = [];
  state.accounts = [{ name: 'Cash', balance: 0 }];

  SafeToSpendView.updateSafeToSpendUI();

  // The daily display should NOT have been wiped to 0
  assert.strictEqual(dailyEl.textContent, '€ 21,08');
  assert.strictEqual(state._lastSafeToSpendResult.safeDaily, 21.08);

  // Restore
  delete global.SupabaseRealtimeService;
  state.transactions = savedTxs;
  state.accounts = savedAccs;
});

test('SafeToSpendView: savings goal editor helper functions operate correctly', () => {
  // setStsSavingsInputValue sets input value
  const inputEl = getMockElement('sts-savings-input');
  SafeToSpendView.setStsSavingsInputValue(450);
  assert.strictEqual(inputEl.value, 450);

  // saveStsSavingsGoal persists to localStorage
  SafeToSpendView.saveStsSavingsGoal();
  assert.strictEqual(localStorage.getItem('ba_monthly_savings_goal'), '450');
  assert.strictEqual(SafeToSpendView.getMonthlySavingsGoal(), 450);

  // Clean up
  localStorage.removeItem('ba_monthly_savings_goal');
});

test('SafeToSpendView: openSafeToSpendModal and openSubscriptionsHubModal trigger openModal', () => {
  openedModal = null;
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(openedModal, 'safe-to-spend-modal');

  openedModal = null;
  SafeToSpendView.openSubscriptionsHubModal();
  assert.strictEqual(openedModal, 'subscriptions-hub-modal');
});

test('SafeToSpendView: openSafeToSpendModal adapts UI according to PRO entitlement', () => {
  const ctaBtn = getMockElement('sts-premium-cta-btn');
  const proBadge = getMockElement('sts-sim-pro-badge');

  // Case 1: Free user
  global.isPremium = () => false;
  state.userProfile = { premium_active: false };
  localStorage.removeItem('premium_active');
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(ctaBtn.style.display, 'flex');
  assert.strictEqual(proBadge.textContent, 'PRO');

  // Case 2: PRO user
  global.isPremium = () => true;
  state.userProfile = { premium_active: true };
  localStorage.setItem('premium_active', 'true');
  SafeToSpendView.openSafeToSpendModal();
  assert.strictEqual(ctaBtn.style.display, 'none');
  assert.strictEqual(proBadge.textContent, '✓ PRO');

  // Clean up
  delete global.isPremium;
  delete state.userProfile;
  localStorage.removeItem('premium_active');
});
