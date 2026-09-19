const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

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
  querySelector() { return { style: {} }; },
  querySelectorAll() { return []; },
  createElement() {
    return {
      style: {},
      className: '',
      setAttribute: () => {},
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  },
  body: { appendChild: () => {} }
};

const BAConstants = require('../js/constants.js');
const BAUtils = require('../js/utils.js');
Object.assign(global, BAConstants);
Object.assign(global, BAUtils);

global.DEFAULT_CATEGORIES = BAConstants.DEFAULT_CATEGORIES;
global.DEFAULT_SUBCATEGORIES_MAP = BAConstants.DEFAULT_SUBCATEGORIES_MAP;
global.updateUI = () => {};
global.showSyncToast = () => {};
global.saveCategoriesToStorage = () => {};
global.showConfirm = async () => true;

const DataIntegrityService = require('../js/dataIntegrityService.js');
Object.assign(global, DataIntegrityService);

const SubcategoryManager = require('../js/subcategoryManager.js');
Object.assign(global, SubcategoryManager);

test('Category & Subcategory Tombstones: records deleted subcategory and prevents resurrection from DEFAULT_SUBCATEGORIES_MAP', async () => {
  global.localStorage.clear();
  global.state = {
    lang: 'el',
    categories: [
      { id: 'cat-1', name: '🛒 Σούπερ Μάρκετ', type: 'expense', subcategories: ['Τρόφιμα', 'Απορρυπαντικά', 'Κατοικίδια'] }
    ],
    transactions: [
      { id: 'tx-1', category: '🛒 Σούπερ Μάρκετ', subcategory: 'Κατοικίδια', amount: 25 }
    ]
  };

  // Initially, 'Κατοικίδια' is in subcategories
  let subs = SubcategoryManager.getSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.ok(subs.includes('Κατοικίδια'));

  // Delete 'Κατοικίδια'
  await SubcategoryManager.deleteSubcategoryGlobally('🛒 Σούπερ Μάρκετ', 'Κατοικίδια');

  // Verify it is recorded in durable tombstones
  const deletedSubs = DataIntegrityService.getDeletedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.ok(deletedSubs.includes('Κατοικίδια'));

  // Verify getSubcategoriesForCategory excludes it (even with DEFAULT_SUBCATEGORIES_MAP and tx-1)
  subs = SubcategoryManager.getSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(subs.includes('Κατοικίδια'), false);

  // Now simulate a cloud fetch where Supabase returns category WITHOUT deleted_subcategories (the bug condition!)
  global.state.categories = [
    { id: 'cat-1', name: '🛒 Σούπερ Μάρκετ', type: 'expense', subcategories: ['Τρόφιμα', 'Απορρυπαντικά'] }
    // Note: deleted_subcategories is undefined/missing from Supabase!
  ];

  // Call getSubcategoriesForCategory again — durable tombstone MUST still suppress 'Κατοικίδια'
  subs = SubcategoryManager.getSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(subs.includes('Κατοικίδια'), false);
  assert.ok(subs.includes('Τρόφιμα'));
});

test('Category & Subcategory Tombstones: records deleted category and provides accurate query methods', () => {
  global.localStorage.clear();

  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-99', '🎉 Διασκέδαση', 'expense'), false);

  DataIntegrityService.recordDeletedCategory('cat-99', '🎉 Διασκέδαση', 'expense', { writeCloudTombstone: false });

  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-99', '🎉 Διασκέδαση', 'expense'), true);
  assert.ok(DataIntegrityService.getDeletedCategoryIds().has('cat-99'));

  // Key-based lookup without ID
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(null, '🎉 Διασκέδαση', 'expense'), true);
  // Accent/case-insensitive
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(null, 'ΔΙΑΣΚΕΔΑΣΗ', 'expense'), true);

  // Clearing tombstone when user deliberately recreates category
  DataIntegrityService.removeDeletedCategoryTombstone('🎉 Διασκέδαση', 'expense');
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-99', '🎉 Διασκέδαση', 'expense'), false);
});

test('Category & Subcategory Tombstones: undo restores subcategory in options', async () => {
  global.localStorage.clear();
  global.state = {
    lang: 'el',
    categories: [
      { id: 'cat-2', name: '🏠 Σπίτι', type: 'expense', subcategories: ['Ενοίκιο', 'Ρεύμα'] }
    ],
    transactions: []
  };

  await SubcategoryManager.deleteSubcategoryGlobally('🏠 Σπίτι', 'Ρεύμα');
  assert.strictEqual(SubcategoryManager.getSubcategoriesForCategory('🏠 Σπίτι').includes('Ρεύμα'), false);
  assert.strictEqual(DataIntegrityService.isSubcategoryDeleted('🏠 Σπίτι', 'Ρεύμα'), true);

  await SubcategoryManager.undoLastSubcategoryDelete();
  assert.strictEqual(DataIntegrityService.isSubcategoryDeleted('🏠 Σπίτι', 'Ρεύμα'), false);
  assert.ok(SubcategoryManager.getSubcategoriesForCategory('🏠 Σπίτι').includes('Ρεύμα'));
});

test('Category Tombstones: removeDeletedCategoryTombstone cleanly removes UUID strings and ID-matched items', () => {
  global.localStorage.clear();
  const testId = 'e2d3762b-3a13-4f0a-8f9b-623f826bdade';

  // Simulate raw UUID string in localStorage
  global.localStorage.setItem('ba_deleted_categories', JSON.stringify([testId, 'other-cat-id']));
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(testId, '🏡 ΣΠΙΤΙ', 'expense'), true);

  // Clear using removeDeletedCategoryTombstone with ID
  DataIntegrityService.removeDeletedCategoryTombstone('🏡 ΣΠΙΤΙ', 'expense', testId);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(testId, '🏡 ΣΠΙΤΙ', 'expense'), false);

  // Also verify object-based tombstone with ID
  global.localStorage.setItem('ba_deleted_categories', JSON.stringify([{ id: testId, name: 'ΣΠΙΤΙ', type: 'expense' }]));
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(testId, '🏡 ΣΠΙΤΙ', 'expense'), true);

  DataIntegrityService.removeDeletedCategoryTombstone('🏡 ΣΠΙΤΙ', 'expense', testId);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted(testId, '🏡 ΣΠΙΤΙ', 'expense'), false);
});

