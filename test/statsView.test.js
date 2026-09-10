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
        classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} }
      };
    }
    return this._elements[id];
  },
  querySelector() {
    return { style: {}, classList: { toggle: () => {} } };
  },
  querySelectorAll() {
    return [];
  },
  createDocumentFragment() {
    return {
      appendChild: () => {}
    };
  }
};

global.getStatsDateRange = () => ({ start: new Date(), end: new Date() });
global.syncStatsDate = () => {};
global.formatStatsPeriodTitle = () => 'Σεπτέμβριος 2026';
global.wrapPeriodTitleWithSpans = () => 'Σεπτέμβριος 2026';
global.getDisplayCurrency = () => 'EUR';
global.getActiveTransactions = () => [];
global.formatDisplayAmount = (v) => String(v);
global.localStorage = { getItem: () => null, setItem: () => {} };
global.TRANSLATIONS = require('../js/translations.js');

global.state = {
  lang: 'el',
  currentDate: new Date(),
  categories: [
    { name: '🛒 Σούπερ Μάρκετ', subcategories: ['Τρόφιμα'] }
  ],
  transactions: []
};

global.showSyncToast = () => {};
global.openModal = () => {};
global.closeModal = () => {};
global.updateUI = () => {};
global.formatCurrency = (v) => String(v);
global.getCurrencySymbol = () => '€';
global.stripLeadingEmoji = (s) => s.replace(/^[\p{Emoji}\s]+/u, '');
global.normalizeGreekString = (s) => s.toLowerCase();
global.getSubcategoriesForCategory = () => ['Τρόφιμα'];

const StatsView = require('../js/statsView.js');

test('StatsView exports all expected functions', () => {
  assert.strictEqual(typeof StatsView.renderStatsTab, 'function');
  assert.strictEqual(typeof StatsView.switchStatsSubtab, 'function');
  assert.strictEqual(typeof StatsView.renderCategoryBudgetsView, 'function');
  assert.strictEqual(typeof StatsView.openBudgetCategoryPicker, 'function');
  assert.strictEqual(typeof StatsView.openBudgetSubcategoryPicker, 'function');
  assert.strictEqual(typeof StatsView.openCategoryBudgetModal, 'function');
  assert.strictEqual(typeof StatsView.saveCategoryBudgetFromModal, 'function');
  assert.strictEqual(typeof StatsView.deleteSelectedCategoryBudget, 'function');
  assert.strictEqual(typeof StatsView.openStatsTransactionsModal, 'function');
  assert.strictEqual(typeof StatsView.closeStatsTransactionsModal, 'function');
  assert.strictEqual(typeof StatsView.renderChart, 'function');
});

test('StatsView.switchStatsSubtab safely switches active subtab', () => {
  StatsView.switchStatsSubtab('budgets');
  assert.strictEqual(global.state.statsSubtab, 'budgets');
  StatsView.switchStatsSubtab('breakdown');
  assert.strictEqual(global.state.statsSubtab, 'breakdown');
});

test('StatsView.renderStatsTab can be called without errors', () => {
  assert.doesNotThrow(() => {
    StatsView.renderStatsTab(true);
  });
});

test('StatsView.checkOverBudgetNotification respects user toggle and triggers at 80% and 100%', () => {
  let inAppNotifs = [];
  let toasts = [];
  global.addInAppNotification = (title, body) => { inAppNotifs.push({ title, body }); };
  global.showToast = (msg, type) => { toasts.push({ msg, type }); };
  global.getCategoryInfo = (cat) => ({ name: 'Supermarket', icon: 'fa-cart-shopping' });

  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); }
  };

  global.state.budgets = [{ id: 'b1', category: 'Supermarket', amount: 100, currency: 'EUR' }];
  global.state.selectedYear = 2026;
  global.state.selectedMonth = 8; // September

  // 1. When user disabled budget alerts:
  storage['settings_budget_limit_alerts_enabled'] = 'false';
  global.state.transactions = [
    { type: 'expense', category: 'Supermarket', amount: 120, date: '2026-09-10' }
  ];
  global.checkOverBudgetNotification({ type: 'expense', category: 'Supermarket', amount: 120, date: '2026-09-10' });
  assert.strictEqual(inAppNotifs.length, 0, 'Should not trigger alert when disabled');

  // 2. When enabled and spending reaches 85% (>= 80%):
  storage['settings_budget_limit_alerts_enabled'] = 'true';
  global.state.transactions = [
    { type: 'expense', category: 'Supermarket', amount: 85, date: '2026-09-10' }
  ];
  global.checkOverBudgetNotification({ type: 'expense', category: 'Supermarket', amount: 85, date: '2026-09-10' });
  assert.strictEqual(inAppNotifs.length, 1, 'Should trigger 80% warning');
  assert.ok(toasts.some(t => t.type === 'warning'));

  // 3. When spending reaches 110% (>= 100%):
  global.state.transactions = [
    { type: 'expense', category: 'Supermarket', amount: 110, date: '2026-09-10' }
  ];
  global.checkOverBudgetNotification({ type: 'expense', category: 'Supermarket', amount: 110, date: '2026-09-10' });
  assert.strictEqual(inAppNotifs.length, 2, 'Should trigger 100% exceeded alert');
  assert.ok(toasts.some(t => t.type === 'error'));
});
