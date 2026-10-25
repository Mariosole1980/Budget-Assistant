const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;

function createElementStub(tagName) {
  return {
    tagName: String(tagName || 'div').toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    children: [],
    attributes: {},
    onclick: null,
    _listeners: {},
    classList: {
      _set: new Set(),
      add(...names) { names.forEach((n) => this._set.add(n)); },
      remove(...names) { names.forEach((n) => this._set.delete(n)); },
      toggle(name, force) {
        const on = force === undefined ? !this._set.has(name) : !!force;
        if (on) this._set.add(name);
        else this._set.delete(name);
        return on;
      },
      contains(name) { return this._set.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...nodes) {
      this.children.length = 0;
      nodes.forEach((node) => this.children.push(node));
      this.innerHTML = '';
    },
    addEventListener(type, handler) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      const list = this._listeners[type] || [];
      this._listeners[type] = list.filter((fn) => fn !== handler);
    }
  };
}

global.lastFragment = null;

global.document = {
  _elements: {},
  getElementById(id) {
    if (!this._elements[id]) {
      const el = createElementStub('div');
      el.id = id;
      this._elements[id] = el;
    }
    return this._elements[id];
  },
  querySelector() {
    return { style: {}, classList: { toggle: () => {} } };
  },
  querySelectorAll() {
    return [];
  },
  createElement(tagName) {
    return createElementStub(tagName);
  },
  createDocumentFragment() {
    const fragment = createElementStub('fragment');
    global.lastFragment = fragment;
    return fragment;
  }
};

global.getStatsDateRange = () => ({
  start: new Date('2000-01-01T00:00:00'),
  end: new Date('2100-01-01T00:00:00')
});
global.syncStatsDate = () => {};
global.formatStatsPeriodTitle = () => 'Σεπτέμβριος 2026';
global.wrapPeriodTitleWithSpans = () => 'Σεπτέμβριος 2026';
global.getDisplayCurrency = () => 'EUR';
global.getActiveTransactions = () => global.state.transactions || [];
global.formatDisplayAmount = (v) => String(v);
global.getCurrencySymbol = () => '€';
global.escapeHtml = (s) => String(s == null ? '' : s);
global.compareTransactions = (a, b) => String(b.date).localeCompare(String(a.date));
global.isTransactionRecurring = () => false;
global.getAccountDisplayName = (a) => a;
global.NEON_PALETTE = ['#6366f1', '#f43f5e', '#10b981'];
global.CurrencyService = {
  displayAmount: (t) => Number(t.amount) || 0,
  convert: (v) => v
};
global.getCategoryInfo = (cat) => ({ name: cat, icon: '💰' });
global.getCategoryDisplayName = (c) => c || '';
global.getSubcategoryDisplayName = (s) => s || '';
global.localStorage = { getItem: () => null, setItem: () => {} };
global.TRANSLATIONS = require('../js/translations.js');

global.state = {
  lang: 'el',
  currentDate: new Date(),
  categories: [
    { name: '🛒 Σούπερ Μάρκετ', subcategories: ['Τρόφιμα'] }
  ],
  transactions: [],
  expandedStatsCategories: new Set(),
  statsType: 'expense',
  budgets: []
};

global.showSyncToast = () => {};
global.openModal = () => {};
global.closeModal = () => {};
global.updateUI = () => {};
global.formatCurrency = (v) => String(v);
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

// ---------------------------------------------------------------------------
// Stats breakdown grouping + "Κινήσεις" modal filtering
// ---------------------------------------------------------------------------

const STATS_CATEGORY = 'Έξτρα Εισοδήματα';

function resetStatsData() {
  global.state.lang = 'el';
  global.state.statsType = 'income';
  global.state.statsSubtab = 'breakdown';
  global.state.budgets = [];
  global.state.userProfile = null;
  global.state.selectedFamilyMemberId = 'all';
  global.state.activeSubcategoryTransactions = null;
  global.state.expandedStatsCategories = new Set();
  global.state.transactions = [
    { id: 't1', type: 'income', category: STATS_CATEGORY, subcategory: 'Ινστα', amount: 100, date: '2026-03-05', account_from: 'Eurobank', note: 'Κατάθεση' },
    { id: 't2', type: 'income', category: STATS_CATEGORY, subcategory: 'ινστα ', amount: 50, date: '2026-03-06', account_from: 'Eurobank' },
    { id: 't3', type: 'income', category: STATS_CATEGORY, subcategory: 'Ινστα (Αντ)', amount: 200, date: '2026-03-07', account_from: 'Eurobank' },
    { id: 't4', type: 'income', category: STATS_CATEGORY, subcategory: '', amount: 36.76, date: '2026-03-08', account_from: 'Revolut' },
    { id: 't5', type: 'income', category: 'Μισθός', subcategory: 'Ινστα', amount: 700, date: '2026-03-09', account_from: 'Eurobank' },
    { id: 't6', type: 'expense', category: STATS_CATEGORY, subcategory: 'Ινστα', amount: 10, date: '2026-03-10', account_from: 'Eurobank' }
  ];
  global.getCategoryInfo = (cat) => ({ name: cat, icon: '💰' });
  global.getCategoryDisplayName = (c) => c || '';
  global.getSubcategoryDisplayName = (s) => s || '';
}

function openStatsModalFor(category, subcategory) {
  const list = global.document.getElementById('stats-transactions-list');
  list.children.length = 0;
  StatsView.openStatsTransactionsModal(category, subcategory);
  return list.children;
}

test('stats modal: "Χωρίς υποκατηγορία" opens ONLY uncategorized transactions', () => {
  resetStatsData();
  const rows = openStatsModalFor(STATS_CATEGORY, '');

  assert.strictEqual(rows.length, 1, 'only the transaction without a subcategory');
  assert.ok(rows[0].innerHTML.includes('36.76'));
  assert.ok(!rows[0].innerHTML.includes('€ 100'));

  const title = global.document.getElementById('stats-transactions-title');
  const subtitle = global.document.getElementById('stats-transactions-subtitle');
  assert.ok(title.textContent.includes('Χωρίς υποκατηγορία'));
  assert.strictEqual(subtitle.textContent, '1 κίνηση · € 36.76');

  const breadcrumb = global.document.getElementById('stats-transactions-back');
  assert.strictEqual(breadcrumb.style.display, 'flex');
  assert.ok(breadcrumb.innerHTML.includes('Όλες οι κινήσεις'));
});

test('stats modal: subcategory filter uses the same normalized key as the breakdown', () => {
  resetStatsData();
  const rows = openStatsModalFor(STATS_CATEGORY, 'Ινστα');

  // "Ινστα" + "ινστα " (cosmetic variant) — NOT "Ινστα (Αντ)", not uncategorized,
  // not another category and not the expense transaction.
  assert.strictEqual(rows.length, 2);
  assert.ok(rows.some(r => r.innerHTML.includes('€ 100')));
  assert.ok(rows.some(r => r.innerHTML.includes('€ 50')));
  assert.ok(!rows.some(r => r.innerHTML.includes('€ 200')));
  assert.ok(!rows.some(r => r.innerHTML.includes('36.76')));

  const subtitle = global.document.getElementById('stats-transactions-subtitle');
  assert.strictEqual(subtitle.textContent, '2 κινήσεις · € 150');
});

test('stats modal: similar-looking but different subcategories stay separate', () => {
  resetStatsData();
  const rows = openStatsModalFor(STATS_CATEGORY, 'Ινστα (Αντ)');

  assert.strictEqual(rows.length, 1);
  assert.ok(rows[0].innerHTML.includes('€ 200'));
});

test('stats modal: category-level view lists every category transaction with sub labels', () => {
  resetStatsData();
  const rows = openStatsModalFor(STATS_CATEGORY, null);

  // 4 income transactions of the category (expense + other category excluded).
  assert.strictEqual(rows.length, 4);
  // 3 have a subcategory → label under the icon; the uncategorized one has none.
  assert.strictEqual(rows.filter(r => r.innerHTML.includes('trans-sub-name')).length, 3);

  const breadcrumb = global.document.getElementById('stats-transactions-back');
  assert.strictEqual(breadcrumb.style.display, 'none');
  assert.strictEqual(breadcrumb.onclick, null);

  const subtitle = global.document.getElementById('stats-transactions-subtitle');
  assert.strictEqual(subtitle.textContent, '4 κινήσεις · € 386.76');
});

test('renderStatsTab merges cosmetic subcategory variants and wires rows to the modal', () => {
  resetStatsData();
  global.state.transactions = global.state.transactions.filter(
    t => t.type === 'income' && t.category === STATS_CATEGORY
  );

  const listEl = global.document.getElementById('stats-breakdown-list');
  listEl._lastRenderSignature = null;
  global.lastFragment = null;

  StatsView.renderStatsTab(true);

  const [categoryRow, subContainer] = global.lastFragment.children;
  assert.ok(categoryRow.className.includes('stats-row'));
  assert.ok(categoryRow.innerHTML.includes('stats-row-chevron'));

  // all-transactions row + 3 subcategory buckets ("Ινστα", "Ινστα (Αντ)", uncategorized)
  assert.strictEqual(subContainer.children.length, 4);
  const [allRow, ...subRows] = subContainer.children;
  assert.ok(allRow.className.includes('stats-all-row'));
  assert.ok(allRow.innerHTML.includes('Όλες οι κινήσεις'));
  assert.ok(allRow.innerHTML.includes('4 κινήσεις'));

  const instaRow = subRows.find(r => r.innerHTML.includes('>Ινστα</span>'));
  const antRow = subRows.find(r => r.innerHTML.includes('>Ινστα (Αντ)</span>'));
  const uncategorizedRow = subRows.find(r => r.innerHTML.includes('>Χωρίς υποκατηγορία</span>'));

  assert.ok(instaRow, 'merged "Ινστα" + "ινστα " row exists');
  assert.ok(instaRow.innerHTML.includes('2 κινήσεις'));
  assert.ok(instaRow.innerHTML.includes('€ 150'));
  assert.ok(antRow.innerHTML.includes('1 κίνηση'));
  assert.ok(uncategorizedRow.innerHTML.includes('1 κίνηση'));

  // Tapping the merged row opens exactly its transactions.
  const modalList = global.document.getElementById('stats-transactions-list');
  modalList.children.length = 0;
  instaRow._listeners.click[0]({ stopPropagation: () => {} });
  assert.strictEqual(modalList.children.length, 2);
});

test('stats signature rebuilds when only a subcategory changes', () => {
  resetStatsData();
  global.state.transactions = [global.state.transactions[0]];

  const listEl = global.document.getElementById('stats-breakdown-list');
  listEl._lastRenderSignature = null;

  StatsView.renderStatsTab(true);
  const firstSignature = listEl._lastRenderSignature;
  assert.ok(firstSignature);

  global.state.transactions[0].subcategory = 'Ινστα (Αντ)';
  StatsView.renderStatsTab(true);

  assert.notStrictEqual(listEl._lastRenderSignature, firstSignature);
});
