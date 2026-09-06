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
