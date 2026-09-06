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
        classList: { contains: () => false },
        querySelectorAll: () => [],
        appendChild: () => {},
        setAttribute: () => {}
      };
    }
    return this._elements[id];
  },
  querySelector() {
    return {
      style: {}
    };
  },
  querySelectorAll() {
    return [];
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
  }
};

global.state = {
  lang: 'el',
  categories: [
    { id: 'c1', name: '🛒 Σούπερ Μάρκετ', type: 'expense', subcategories: ['Τρόφιμα'] }
  ],
  transactions: []
};

global.openModal = () => {};
global.closeModal = () => {};
global.showToast = () => {};
global.showConfirm = async () => true;
global.saveCategoriesToStorage = () => {};
global.getCategoryDisplayName = (n) => n;
global.getCustomCategoryOrder = () => [];
global.setCustomCategoryOrder = () => {};
global.getSortedSubcategoriesForCategory = () => ['Τρόφιμα'];
global.getSubcategoriesStatsForCategory = () => ({});
global.renderCategoryIconHtml = () => '<span>📁</span>';
global.stripLeadingEmoji = (s) => s.replace(/^[\p{Emoji}\s]+/u, '');
global.normalizeGreekString = (s) => s.toLowerCase();

const CategoryManager = require('../js/categoryManager.js');

test('CategoryManager exports all required functions', () => {
  assert.strictEqual(typeof CategoryManager.openSettingsCategoryManager, 'function');
  assert.strictEqual(typeof CategoryManager.setCategoryManagerType, 'function');
  assert.strictEqual(typeof CategoryManager.renderCategoryManagerList, 'function');
  assert.strictEqual(typeof CategoryManager.toggleCategoryManagerAccordion, 'function');
  assert.strictEqual(typeof CategoryManager.renderCategoryManagerSubcategories, 'function');
  assert.strictEqual(typeof CategoryManager.handleCategoryManagerSubcategoryRename, 'function');
  assert.strictEqual(typeof CategoryManager.addSubcategoryToCategory, 'function');
  assert.strictEqual(typeof CategoryManager.openCategoryManagerAddDialog, 'function');
  assert.strictEqual(typeof CategoryManager.openCategoryEditorModal, 'function');
  assert.strictEqual(typeof CategoryManager.deleteCategoryFromManager, 'function');
});

test('CategoryManager.setCategoryManagerType updates active type', () => {
  CategoryManager.setCategoryManagerType('income');
  assert.strictEqual(window._categoryManagerType, 'income');
  CategoryManager.setCategoryManagerType('expense');
  assert.strictEqual(window._categoryManagerType, 'expense');
});

test('CategoryManager.addSubcategoryToCategory adds new subcategory to existing category', () => {
  CategoryManager.addSubcategoryToCategory('🛒 Σούπερ Μάρκετ', 'Αναψυκτικά');
  const cat = global.state.categories.find(c => c.name.includes('Σούπερ Μάρκετ'));
  assert.ok(cat);
  assert.ok(cat.subcategories.includes('Αναψυκτικά'));
});

test('CategoryManager.addSubcategoryToCategory ignores duplicate subcategories', () => {
  const cat = global.state.categories.find(c => c.name.includes('Σούπερ Μάρκετ'));
  const prevCount = cat.subcategories.length;
  CategoryManager.addSubcategoryToCategory('🛒 Σούπερ Μάρκετ', 'Αναψυκτικά');
  assert.strictEqual(cat.subcategories.length, prevCount);
});
