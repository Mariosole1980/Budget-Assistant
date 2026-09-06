const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser environment
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
        classList: { contains: () => false },
        querySelectorAll: () => [],
        appendChild: () => {},
        setAttribute: () => {}
      };
    }
    return this._elements[id];
  },
  createElement(tag) {
    return {
      tag,
      style: {},
      className: '',
      setAttribute: () => {},
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  },
  body: {
    appendChild: () => {}
  }
};

global.state = {
  lang: 'el',
  categories: [
    { id: 'c1', name: 'Supermarket', type: 'expense', subcategories: ['Groceries', 'Snacks'] }
  ],
  transactions: [
    { id: 't1', category: 'Supermarket', subcategory: 'Groceries', amount: 20 },
    { id: 't2', category: 'Supermarket', subcategory: 'Groceries', amount: 15 },
    { id: 't3', category: 'Supermarket', subcategory: 'Snacks', amount: 5 }
  ]
};

global.escapeHtml = (s) => s;
global.updateUI = () => {};
global.showSyncToast = () => {};
global.saveTransactionsToStorage = () => {};
global.saveCategoriesToStorage = () => {};
global.getCustomSubcategoryOrder = () => [];
global.setCustomSubcategoryOrder = () => {};

const SubcategoryManager = require('../js/subcategoryManager.js');

test('SubcategoryManager: exports all expected functions to module and window', () => {
  assert.strictEqual(typeof SubcategoryManager.getSubcategoriesForCategory, 'function');
  assert.strictEqual(typeof SubcategoryManager.getSubcategoriesStatsForCategory, 'function');
  assert.strictEqual(typeof SubcategoryManager.getSortedSubcategoriesForCategory, 'function');
  assert.strictEqual(typeof SubcategoryManager.renameSubcategoryGlobally, 'function');
  assert.strictEqual(typeof SubcategoryManager.deleteSubcategoryGlobally, 'function');
  assert.strictEqual(typeof SubcategoryManager.undoLastSubcategoryDelete, 'function');
  assert.strictEqual(typeof SubcategoryManager.showSubcatUndoSnackbar, 'function');

  // Verify window attachments
  assert.strictEqual(typeof window.getSubcategoriesForCategory, 'function');
  assert.strictEqual(typeof window.getSubcategoriesStatsForCategory, 'function');
  assert.strictEqual(typeof window.getSortedSubcategoriesForCategory, 'function');
  assert.strictEqual(typeof window.renameSubcategoryGlobally, 'function');
  assert.strictEqual(typeof window.deleteSubcategoryGlobally, 'function');
  assert.strictEqual(typeof window.undoLastSubcategoryDelete, 'function');
  assert.strictEqual(typeof window.showSubcatUndoSnackbar, 'function');
});

test('SubcategoryManager: getSubcategoriesForCategory returns subcategories for a category', () => {
  const subs = SubcategoryManager.getSubcategoriesForCategory('Supermarket');
  assert.ok(Array.isArray(subs));
  assert.ok(subs.includes('Groceries'));
  assert.ok(subs.includes('Snacks'));
});

test('SubcategoryManager: getSubcategoriesStatsForCategory counts usage correctly', () => {
  const stats = SubcategoryManager.getSubcategoriesStatsForCategory('Supermarket');
  assert.strictEqual(stats['Groceries'].count, 2);
  assert.strictEqual(stats['Snacks'].count, 1);
});
