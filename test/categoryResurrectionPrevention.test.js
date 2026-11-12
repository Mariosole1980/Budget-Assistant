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

test('Category tombstones are scoped per account and guest session', () => {
  global.localStorage.clear();

  // Account A deletes ΣΠΙΤΙ.
  global.state = { guestMode: false, currentUser: { id: 'user-a' } };
  DataIntegrityService.recordDeletedCategory('cat-home-a', '🏡 ΣΠΙΤΙ', 'expense', { writeCloudTombstone: false });
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-home-a'), true);

  // Logging out does not erase A's tombstone (same-account login must stay clean).
  global.state = { guestMode: false, currentUser: null };
  assert.ok(global.localStorage.getItem('ba_deleted_categories::user-a'),
    'logout must not delete the account-scoped tombstone');

  // Guest browsing does not inherit A's tombstones and keeps its own.
  global.state = { guestMode: true, currentUser: null };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-home-a'), false);
  DataIntegrityService.recordDeletedCategory('cat-guest', 'Guest Only', 'expense', { writeCloudTombstone: false });
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-guest'), true);

  // A still has their deletion; B never inherits A's or the guest's tombstones.
  global.state = { guestMode: false, currentUser: { id: 'user-a' } };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-home-a'), true);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-guest'), false);

  global.state = { guestMode: false, currentUser: { id: 'user-b' } };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-home-a'), false);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('cat-guest'), false);
});

test('Subcategory tombstones are scoped per account', () => {
  global.localStorage.clear();

  global.state = { guestMode: false, currentUser: { id: 'user-a' } };
  DataIntegrityService.recordDeletedSubcategory('🛒 Σούπερ Μάρκετ', 'Snacks', { writeCloudTombstone: false });
  assert.strictEqual(DataIntegrityService.isSubcategoryDeleted('🛒 Σούπερ Μάρκετ', 'Snacks'), true);

  global.state = { guestMode: false, currentUser: { id: 'user-b' } };
  assert.strictEqual(DataIntegrityService.isSubcategoryDeleted('🛒 Σούπερ Μάρκετ', 'Snacks'), false);
});

test('Legacy unscoped tombstones migrate to the active account exactly once', () => {
  global.localStorage.clear();
  global.localStorage.setItem('ba_deleted_categories', JSON.stringify([
    { id: 'legacy-home', key: 'expense:::σπιτι', name: '🏡 ΣΠΙΤΙ', type: 'expense' }
  ]));

  // Guest must not consume a legacy user tombstone; leave it for the owner.
  global.state = { guestMode: true, currentUser: null };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('legacy-home'), false);
  assert.ok(global.localStorage.getItem('ba_deleted_categories'),
    'a guest must not migrate the legacy key into guest scope');

  global.state = { guestMode: false, currentUser: { id: 'user-a' } };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('legacy-home'), true);
  assert.strictEqual(global.localStorage.getItem('ba_deleted_categories'), null,
    'the legacy key is migrated into the active account scope');
  assert.ok(global.localStorage.getItem('ba_deleted_categories::user-a'));

  // Another account does not inherit the migrated tombstone.
  global.state = { guestMode: false, currentUser: { id: 'user-b' } };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('legacy-home'), false);

  // Returning to the original account restores it.
  global.state = { guestMode: false, currentUser: { id: 'user-a' } };
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('legacy-home'), true);
});

test('User custom categories (e.g. 🏡 ΣΠΙΤΙ, 🎬 ΣΥΝΔΡΟΜΕΣ) are not suppressed by tombstones of deleted default categories', () => {
  global.localStorage.clear();
  global.state = { guestMode: false, currentUser: { id: 'user-a' } };

  // Simulate user deleting default category '🏠 Σπίτι' -> stores key expense:::σπιτι
  DataIntegrityService.recordDeletedCategory('def-home-id', '🏠 Σπίτι', 'expense', { writeCloudTombstone: false });
  DataIntegrityService.recordDeletedCategory('def-subs-id', '📱 Συνδρομές', 'expense', { writeCloudTombstone: false });

  // Default categories MUST be reported as deleted
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('def-home-id', '🏠 Σπίτι', 'expense'), true);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('def-subs-id', '📱 Συνδρομές', 'expense'), true);

  // BUT custom categories MUST NOT be reported as deleted!
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('custom-home-uuid', '🏡 ΣΠΙΤΙ', 'expense'), false);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('custom-subs-uuid', '🎬 ΣΥΝΔΡΟΜΕΣ', 'expense'), false);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('custom-health-uuid', '❤️ ΥΓΕΙΑ', 'expense'), false);
  assert.strictEqual(DataIntegrityService.isCategoryDeleted('custom-sal-uuid', '💼 ΜΙΣΘΟΣ', 'income'), false);
});

test('autoHealUserCategories restores all 17 custom categories and purges default system categories', () => {
  global.localStorage.clear();
  const DataLoaderService = require('../js/dataLoaderService.js');
  global.state = {
    guestMode: false,
    currentUser: { id: 'user-heal' },
    // Simulate some accidental default category present in state
    categories: [
      { id: 'def-1', name: '🏠 Σπίτι', type: 'expense' },
      { id: 'def-2', name: '🛒 Σούπερ Μάρκετ', type: 'expense' }
    ]
  };

  DataLoaderService.autoHealUserCategories();

  // All 17 canonical custom categories must now be present
  assert.strictEqual(global.state.categories.length, 17, 'must contain exactly 17 categories');

  // Verify none of the default categories are present
  const names = global.state.categories.map(c => c.name);
  assert.strictEqual(names.includes('🏠 Σπίτι'), false, 'default 🏠 Σπίτι must be purged');
  assert.strictEqual(names.includes('🛒 Σούπερ Μάρκετ'), false, 'default 🛒 Σούπερ Μάρκετ must be purged');

  // Verify custom categories are present
  assert.strictEqual(names.includes('🏡 ΣΠΙΤΙ'), true, 'custom 🏡 ΣΠΙΤΙ must be present');
  assert.strictEqual(names.includes('🎬 ΣΥΝΔΡΟΜΕΣ'), true, 'custom 🎬 ΣΥΝΔΡΟΜΕΣ must be present');
  assert.strictEqual(names.includes('💼 ΜΙΣΘΟΣ'), true, 'custom 💼 ΜΙΣΘΟΣ must be present');

  // Verify subcategories on 🏡 ΣΠΙΤΙ
  const homeCat = global.state.categories.find(c => c.name === '🏡 ΣΠΙΤΙ');
  assert.ok(homeCat.subcategories.includes('ΔΕΗ'));
  assert.ok(homeCat.subcategories.includes('Vodafone'));
});




