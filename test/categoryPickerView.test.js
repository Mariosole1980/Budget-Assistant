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
  categories: [
    { name: 'Food', type: 'expense', icon: 'fa-solid fa-utensils', color: '#f59e0b' },
    { name: 'Salary', type: 'income', icon: 'fa-solid fa-wallet', color: '#10b981' }
  ],
  transactions: []
};

global.TRANSLATIONS = {
  el: { label_select: 'Επιλέξτε...', alert_select_category_first: 'Επιλέξτε κατηγορία πρώτα' },
  en: { label_select: 'Select...', alert_select_category_first: 'Select a category first' }
};

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {
        _props: {},
        cssText: '',
        setProperty(k, v) { this._props[k] = v; this[k] = v; },
        removeProperty(k) { delete this._props[k]; delete this[k]; }
      },
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, f) { if (f !== undefined) { f ? classes.add(c) : classes.delete(c); } }
      },
      children: [],
      innerHTML: '',
      textContent: '',
      value: '',
      setAttribute() {},
      getAttribute(k) { return null; },
      removeAttribute() {},
      appendChild(ch) { this.children.push(ch); },
      remove() { delete domElements[id]; },
      focus() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) { return getMockElement(id); },
  querySelector(sel) { return getMockElement('mock-sel-' + Math.random()); },
  querySelectorAll(sel) { return []; },
  createElement(tag) { return getMockElement('el_' + Math.random()); }
};

global.openModal = () => {};
global.closeModal = () => {};
global.updateUI = () => {};
global.getCategoryDisplayName = (name) => name;
global.renderCategoryIconHtml = () => '<span>icon</span>';
global.renderEditCategorySubcategories = () => {};
global.updateSubcategorySuggestions = () => {};
global.showAlert = () => {};

const CategoryPickerView = require('../js/categoryPickerView.js');

test('CategoryPickerView: exports all expected functions', () => {
  const expectedFns = [
    'updateCategoryDisplay',
    'updateSubcategoryRowVisibility',
    'setTransactionFormType',
    'toggleCategoryPickerEditMode',
    'inlineDeleteCustomCategory',
    'inlineRenameCategory',
    'getCustomCategoryOrder',
    'setCustomCategoryOrder',
    'getCustomSubcategoryOrder',
    'setCustomSubcategoryOrder',
    'updateCategoryDropdowns',
    'selectCategory',
    'selectSubcategory',
    'openCategoryModal',
    'openEditCategoryDialog',
    'openNewCategoryDialog',
    'closeNewCategoryDialog',
    'renderCategoryIconDialog',
    'handleCategoryIconSearch',
    'updateNewCategoryLivePreview',
    'renderEditCategorySubcategories',
    'saveNewCategoryFromPicker',
    'openSubcategoryModal'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof CategoryPickerView[fn], 'function', fn + ' must be a function');
  });
});

test('CategoryPickerView: getCustomCategoryOrder and setCustomCategoryOrder manage custom ordering', () => {
  localStorage.removeItem('category_custom_order_expense');
  assert.deepStrictEqual(CategoryPickerView.getCustomCategoryOrder('expense'), []);

  CategoryPickerView.setCustomCategoryOrder('expense', ['Food', 'Bills', 'Transport']);
  assert.deepStrictEqual(CategoryPickerView.getCustomCategoryOrder('expense'), ['Food', 'Bills', 'Transport']);
});

test('CategoryPickerView: getCustomSubcategoryOrder and setCustomSubcategoryOrder manage subcategories', () => {
  localStorage.removeItem('subcategory_custom_order_Food');
  assert.deepStrictEqual(CategoryPickerView.getCustomSubcategoryOrder('Food'), []);

  CategoryPickerView.setCustomSubcategoryOrder('Food', ['Groceries', 'Restaurants']);
  assert.deepStrictEqual(CategoryPickerView.getCustomSubcategoryOrder('Food'), ['Groceries', 'Restaurants']);
});

test('CategoryPickerView: openNewCategoryDialog and closeNewCategoryDialog operate safely', () => {
  assert.doesNotThrow(() => {
    CategoryPickerView.openNewCategoryDialog('expense');
    CategoryPickerView.closeNewCategoryDialog();
  });
});
