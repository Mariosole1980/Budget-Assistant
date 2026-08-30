const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Load constants and utils
const BAConstants = require('../js/constants.js');
const BAUtils = require('../js/utils.js');
Object.assign(global, BAConstants);
Object.assign(global, BAUtils);
global.BAConstants = BAConstants;
global.BAUtils = BAUtils;

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

function extractFn(name) {
  let start = -1;
  for (const prefix of ['async function ' + name + '(', 'function ' + name + '(']) {
    start = appJs.indexOf(prefix);
    if (start !== -1) break;
  }
  if (start === -1) throw new Error('function ' + name + ' not found in app.js');

  const paramEnd = appJs.indexOf(')', start);
  const braceStart = appJs.indexOf('{', paramEnd);
  let depth = 0;
  let i = braceStart;
  for (; i < appJs.length; i++) {
    if (appJs[i] === '{') depth++;
    else if (appJs[i] === '}') { depth--; if (depth === 0) break; }
  }
  return appJs.slice(start, i + 1);
}

// Global mocks
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.window = global;
global.document = {
  body: {
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} }
  },
  createElement: (tag) => ({
    id: '',
    style: {},
    innerHTML: '',
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} },
    querySelector: () => null,
    parentNode: { replaceChild: () => {} }
  }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

// Helper to strip emojis
global.stripLeadingEmoji = function(str) {
  if (!str) return '';
  return String(str).replace(/^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}\s]+/gu, '').trim();
};
global.getCategoryDisplayName = function(name) {
  return stripLeadingEmoji(name);
};
global.getSubcategoryDisplayName = function(sub) {
  return sub;
};
global.showSyncToast = function() {};
global.calculateInitialBalances = function() {};
global.updateUI = function() {};
global.saveCategoriesToStorage = function() {};
global.DEFAULT_SUBCATEGORIES_MAP = BAConstants.DEFAULT_SUBCATEGORIES_MAP;
global._subcatUndoTimer = null;
global._lastSubcatDeleteBackup = null;

eval(extractFn('getSubcategoriesStatsForCategory'));
eval(extractFn('getSortedSubcategoriesForCategory'));
eval(extractFn('getSubcategoriesForCategory'));
eval(extractFn('showSubcatUndoSnackbar'));
eval(extractFn('deleteSubcategoryGlobally'));
eval(extractFn('undoLastSubcategoryDelete'));
eval(extractFn('addSubcategoryToCategory'));
eval(extractFn('renameSubcategoryGlobally'));
eval(extractFn('ensureCustomDialogModal'));
eval(extractFn('showCustomDialog'));

test('getSortedSubcategoriesForCategory merges default subcategories from DEFAULT_SUBCATEGORIES_MAP', () => {
  global.state = {
    categories: [],
    transactions: [],
    lang: 'el'
  };

  const subs = getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.ok(subs.length > 0);
  assert.ok(subs.includes('Τρόφιμα'));
  assert.ok(subs.includes('Απορρυπαντικά'));
  assert.ok(subs.includes('Κατοικίδια'));
});

test('deleteSubcategoryGlobally adds default subcategory to deleted_subcategories and excludes it', async () => {
  global.state = {
    categories: [{
      id: 'cat_1',
      name: '🛒 Σούπερ Μάρκετ',
      type: 'expense',
      subcategories: []
    }],
    transactions: [
      { id: 'tx_1', category: '🛒 Σούπερ Μάρκετ', subcategory: 'Κατοικίδια', amount: 20 }
    ],
    lang: 'el'
  };

  await deleteSubcategoryGlobally('🛒 Σούπερ Μάρκετ', 'Κατοικίδια');

  // Transaction subcategory cleared
  assert.strictEqual(global.state.transactions[0].subcategory, '');

  // Category object has 'Κατοικίδια' in deleted_subcategories
  const cat = global.state.categories.find(c => c.name === '🛒 Σούπερ Μάρκετ');
  assert.ok(cat.deleted_subcategories.includes('Κατοικίδια'));

  // getSortedSubcategoriesForCategory no longer includes 'Κατοικίδια'
  const subs = getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(subs.includes('Κατοικίδια'), false);
  assert.ok(subs.includes('Τρόφιμα')); // Other defaults still present
});

test('undoLastSubcategoryDelete restores deleted subcategory in category and transactions', async () => {
  global.state = {
    categories: [{
      id: 'cat_1',
      name: '🛒 Σούπερ Μάρκετ',
      type: 'expense',
      subcategories: []
    }],
    transactions: [
      { id: 'tx_1', category: '🛒 Σούπερ Μάρκετ', subcategory: 'Κατοικίδια', amount: 20 }
    ],
    lang: 'el'
  };

  await deleteSubcategoryGlobally('🛒 Σούπερ Μάρκετ', 'Κατοικίδια');
  assert.strictEqual(global.state.transactions[0].subcategory, '');

  await undoLastSubcategoryDelete();

  // Transaction restored
  assert.strictEqual(global.state.transactions[0].subcategory, 'Κατοικίδια');

  // getSortedSubcategoriesForCategory includes 'Κατοικίδια' again
  const subs = getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.ok(subs.includes('Κατοικίδια'));
});

test('addSubcategoryToCategory un-deletes a previously deleted subcategory', () => {
  global.state = {
    categories: [{
      id: 'cat_1',
      name: '🛒 Σούπερ Μάρκετ',
      type: 'expense',
      subcategories: [],
      deleted_subcategories: ['Κατοικίδια']
    }],
    transactions: [],
    lang: 'el'
  };

  // Initially deleted
  assert.strictEqual(getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ').includes('Κατοικίδια'), false);

  addSubcategoryToCategory('🛒 Σούπερ Μάρκετ', 'Κατοικίδια');

  const cat = global.state.categories.find(c => c.name === '🛒 Σούπερ Μάρκετ');
  assert.strictEqual(cat.deleted_subcategories.includes('Κατοικίδια'), false);
  assert.ok(getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ').includes('Κατοικίδια'));
});

test('renameSubcategoryGlobally moves old subcategory to deleted_subcategories and updates transactions', async () => {
  global.state = {
    categories: [{
      id: 'cat_1',
      name: '🛒 Σούπερ Μάρκετ',
      type: 'expense',
      subcategories: []
    }],
    transactions: [
      { id: 'tx_1', category: '🛒 Σούπερ Μάρκετ', subcategory: 'Τρόφιμα', amount: 50 }
    ],
    lang: 'el'
  };

  await renameSubcategoryGlobally('🛒 Σούπερ Μάρκετ', 'Τρόφιμα', 'Τρόφιμα & Ποτά');

  assert.strictEqual(global.state.transactions[0].subcategory, 'Τρόφιμα & Ποτά');

  const subs = getSortedSubcategoriesForCategory('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(subs.includes('Τρόφιμα'), false);
  assert.ok(subs.includes('Τρόφιμα & Ποτά'));
});

test('custom dialog modal retains z-index 2147483647 across multiple calls', async () => {
  const fakeModal = {
    id: 'custom-dialog-modal',
    style: {},
    classList: {
      add: (c) => {},
      remove: (c) => {}
    },
    parentElement: global.document.body
  };
  global.document.getElementById = (id) => {
    if (id === 'custom-dialog-modal') return fakeModal;
    if (id === 'custom-dialog-title' || id === 'custom-dialog-message' || id === 'custom-dialog-icon') return { textContent: '', innerHTML: '' };
    if (id === 'custom-dialog-btn-cancel' || id === 'custom-dialog-btn-ok') return {
      style: {},
      textContent: '',
      parentNode: { replaceChild: (n, o) => n },
      cloneNode: () => ({ addEventListener: (evt, fn) => { if (evt === 'click') setTimeout(() => fn({ stopPropagation: () => {} }), 5); } })
    };
    return null;
  };

  const modal1 = ensureCustomDialogModal();
  assert.strictEqual(modal1.style.zIndex, '2147483647');

  const res1 = await showCustomDialog({ message: 'Test 1', showCancel: true });
  assert.strictEqual(fakeModal.style.zIndex, '2147483647');

  const res2 = await showCustomDialog({ message: 'Test 2', showCancel: true });
  assert.strictEqual(fakeModal.style.zIndex, '2147483647');
});
