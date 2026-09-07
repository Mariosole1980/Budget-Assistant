const test = require('node:test');
const assert = require('node:assert/strict');

// Setup mock DOM & State
global.state = {
  selectedYear: 2026,
  selectedMonth: 8, // September (0-indexed)
  lang: 'el',
  accounts: [{ id: 'acc-1', name: 'Main', balance: 500 }],
  categories: [{ id: 'cat-1', name: 'Food', icon: '🍔' }],
  transactions: [],
  selectedIds: new Set(),
  selectionMode: false
};

global.TRANSLATIONS = {
  el: {
    trans_empty_title: 'Δεν υπάρχουν συναλλαγές για αυτόν τον μήνα',
    trans_empty_desc: 'Προσθέστε την πρώτη σας συναλλαγή.'
  },
  en: {
    trans_empty_title: 'No Transactions This Month',
    trans_empty_desc: 'Add your first transaction.'
  }
};

const domElements = {};
function createMockElement(tag, id, className) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: id || '',
    className: className || '',
    innerHTML: '',
    children: [],
    style: {},
    classList: {
      _classes: new Set((className || '').split(' ').filter(Boolean)),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    appendChild(child) { this.children.push(child); },
    replaceChildren(fragment) {
      this.children = fragment.children ? [...fragment.children] : [];
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.day-header.is-today') {
        return this.children.find(c => c.className && c.className.includes('is-today')) || null;
      }
      return null;
    }
  };
  return el;
}

global.document = {
  getElementById(id) {
    if (!domElements[id]) {
      domElements[id] = createMockElement('div', id);
    }
    return domElements[id];
  },
  querySelector(sel) {
    return createMockElement('div', '', sel.replace('.', ''));
  },
  createElement(tag) {
    return createMockElement(tag);
  },
  createDocumentFragment() {
    return {
      children: [],
      appendChild(c) { this.children.push(c); }
    };
  }
};

global.window = {
  state: global.state,
  innerWidth: 375,
  CurrencyService: {
    sumInCurrency(arr) {
      return arr.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    },
    displayAmount(t) {
      return parseFloat(t.amount) || 0;
    }
  },
  getDisplayCurrency() { return 'EUR'; },
  getCurrencySymbol() { return '€'; },
  formatDisplayAmount(v) { return Number(v).toFixed(2); },
  getActiveTransactions() { return global.state.transactions; },
  compareTransactions(a, b) { return (b.date || '').localeCompare(a.date || ''); },
  getWeekdayName(idx) { return 'Δευ'; },
  getMonthName(idx) { return 'Σεπτ'; },
  getCategoryInfo(cat) { return { icon: '🍔' }; },
  getCategoryDisplayName(cat) { return cat; },
  getSubcategoryDisplayName(sub) { return sub; },
  escapeHtml(str) { return str || ''; },
  getAccountDisplayName(id) { return 'Main'; }
};

global.CurrencyService = global.window.CurrencyService;
global.getDisplayCurrency = global.window.getDisplayCurrency;
global.getCurrencySymbol = global.window.getCurrencySymbol;
global.formatDisplayAmount = global.window.formatDisplayAmount;
global.getActiveTransactions = global.window.getActiveTransactions;
global.compareTransactions = global.window.compareTransactions;
global.getWeekdayName = global.window.getWeekdayName;
global.getMonthName = global.window.getMonthName;
global.getCategoryInfo = global.window.getCategoryInfo;
global.getCategoryDisplayName = global.window.getCategoryDisplayName;
global.getSubcategoryDisplayName = global.window.getSubcategoryDisplayName;
global.escapeHtml = global.window.escapeHtml;
global.getAccountDisplayName = global.window.getAccountDisplayName;

const TransactionListService = require('../js/transactionListService.js');

test('TransactionListService exports renderTransactionsTab and scrollToToday', () => {
  assert.equal(typeof TransactionListService.renderTransactionsTab, 'function');
  assert.equal(typeof TransactionListService.scrollToToday, 'function');
});

test('renderTransactionsTab renders empty card when no transactions in current month', () => {
  global.state.transactions = [];
  const list = document.getElementById('transactions-list');
  TransactionListService.renderTransactionsTab();
  assert.ok(list.innerHTML.includes('stats-empty-card'));
  assert.ok(list.innerHTML.includes('Δεν υπάρχουν συναλλαγές'));
});

test('renderTransactionsTab groups transactions by day and calculates monthly totals', () => {
  global.state.transactions = [
    { id: 'tx-1', date: '2026-09-07T12:00:00', amount: 50.00, type: 'expense', category: 'Food' },
    { id: 'tx-2', date: '2026-09-07T14:00:00', amount: 1500.00, type: 'income', category: 'Salary' }
  ];
  const list = document.getElementById('transactions-list');
  list._lastRenderSignature = null;
  TransactionListService.renderTransactionsTab();

  const incEl = document.getElementById('summary-income-val');
  const expEl = document.getElementById('summary-expense-val');
  const totEl = document.getElementById('summary-total-val');

  assert.equal(incEl.textContent, '€ 1500.00');
  assert.equal(expEl.textContent, '€ 50.00');
  assert.equal(totEl.textContent, '€ 1450.00');
  assert.equal(list.children.length, 3); // 1 day-header + 2 transaction-items
});

test('scrollToToday does not throw when called with empty or populated list', () => {
  assert.doesNotThrow(() => {
    TransactionListService.scrollToToday('smooth');
  });
});

test('renderTransactionsTab shows smart jump button when other months have transactions', () => {
  global.state.selectedYear = 2026;
  global.state.selectedMonth = 8; // September
  // Only transactions in August 2026
  global.state.transactions = [
    { id: 'tx-aug-1', date: '2026-08-25T10:00:00', amount: 45.00, type: 'expense', category: 'Food' }
  ];
  const list = document.getElementById('transactions-list');
  list._lastRenderSignature = null;
  TransactionListService.renderTransactionsTab();

  assert.ok(list.innerHTML.includes('stats-empty-card'));
  assert.ok(list.innerHTML.includes('Μετάβαση σε'));
  assert.ok(list.innerHTML.includes('goToMonth(2026, 7)'));
});

test('goToMonth updates state and calls updateUI', () => {
  let uiUpdated = false;
  global.updateUI = () => { uiUpdated = true; };
  global.window.updateUI = global.updateUI;

  TransactionListService.goToMonth(2026, 7);
  assert.equal(global.state.selectedYear, 2026);
  assert.equal(global.state.selectedMonth, 7);
  assert.equal(uiUpdated, true);
});

