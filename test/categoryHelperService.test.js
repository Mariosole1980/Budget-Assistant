const { test } = require('node:test');
const assert = require('node:assert');

const CategoryHelperService = require('../js/categoryHelperService.js');

test('CategoryHelperService exports all expected functions', () => {
  assert.strictEqual(typeof CategoryHelperService.stripLeadingEmoji, 'function');
  assert.strictEqual(typeof CategoryHelperService.getFirstEmojiCodepoint, 'function');
  assert.strictEqual(typeof CategoryHelperService.resolveCategoryInfo, 'function');
  assert.strictEqual(typeof CategoryHelperService.normalizeCategoryName, 'function');
  assert.strictEqual(typeof CategoryHelperService.getCategoryInfo, 'function');
  assert.strictEqual(typeof CategoryHelperService.getCategoryDisplayName, 'function');
  assert.strictEqual(typeof CategoryHelperService.isDefaultSubcategory, 'function');
  assert.strictEqual(typeof CategoryHelperService.getSubcategoryDisplayName, 'function');
});

test('CategoryHelperService.stripLeadingEmoji removes leading emojis across UTF ranges', () => {
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji('🚗 Αυτοκίνητο'), 'Αυτοκίνητο');
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji('🛒 Σούπερ Μάρκετ'), 'Σούπερ Μάρκετ');
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji('❤️ Υγεία'), 'Υγεία');
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji('Plain Text'), 'Plain Text');
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji(''), '');
  assert.strictEqual(CategoryHelperService.stripLeadingEmoji(null), '');
});

test('CategoryHelperService.getFirstEmojiCodepoint extracts surrogate pair hex codepoint', () => {
  const cp = CategoryHelperService.getFirstEmojiCodepoint('🚗 Αυτοκίνητο');
  assert.strictEqual(cp, '1F697');
  assert.strictEqual(CategoryHelperService.getFirstEmojiCodepoint('Plain'), null);
  assert.strictEqual(CategoryHelperService.getFirstEmojiCodepoint(''), null);
});

test('CategoryHelperService.normalizeCategoryName normalizes and strips emoji and accents', () => {
  global.normalizeString = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const normalized = CategoryHelperService.normalizeCategoryName('🚗 Αυτοκίνητο');
  assert.strictEqual(normalized, 'ΑΥΤΟΚΙΝΗΤΟ');
});

test('CategoryHelperService.resolveCategoryInfo and getCategoryInfo resolve correctly', () => {
  global.state = {
    categories: [
      { name: '🚗 Αυτοκίνητο', icon: '🚗', color: '#ff0000', type: 'expense' }
    ]
  };
  global.CATEGORY_EMOJI_MAP = {
    '1F697': { name: 'Αυτοκίνητο', icon: '🚗', color: '#ff0000' }
  };

  const stored = CategoryHelperService.resolveCategoryInfo('🚗 Αυτοκίνητο', 'expense');
  assert.strictEqual(stored.name, '🚗 Αυτοκίνητο');

  const fallback = CategoryHelperService.resolveCategoryInfo('Άγνωστη Κατηγορία', 'income');
  assert.strictEqual(fallback.name, 'Άγνωστη Κατηγορία');
  assert.strictEqual(fallback.icon, '💰');

  const info = CategoryHelperService.getCategoryInfo('Αυτοκίνητο', 'expense');
  assert.ok(info);
});

test('CategoryHelperService.getCategoryDisplayName translates bilingual categories', () => {
  global.state = { lang: 'en' };
  global.CATEGORY_NAME_TRANSLATIONS = {
    'Σούπερ Μάρκετ': 'Supermarket',
    'Αυτοκίνητο': 'Car'
  };

  const enName = CategoryHelperService.getCategoryDisplayName('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(enName, 'Supermarket');

  global.state.lang = 'el';
  const elName = CategoryHelperService.getCategoryDisplayName('🛒 Σούπερ Μάρκετ');
  assert.strictEqual(elName, 'Σούπερ Μάρκετ');

  const customName = CategoryHelperService.getCategoryDisplayName('Προσωπικό Project');
  assert.strictEqual(customName, 'Προσωπικό Project');
});

test('CategoryHelperService default subcategory detection and translation', () => {
  global.DEFAULT_SUBCATEGORIES_MAP = {
    'Αυτοκίνητο': ['Βενζίνη', 'Σέρβις']
  };
  global.SUBCATEGORY_NAME_TRANSLATIONS = {
    'Βενζίνη': 'Fuel',
    'Σέρβις': 'Service'
  };

  assert.strictEqual(CategoryHelperService.isDefaultSubcategory('Αυτοκίνητο', 'Βενζίνη'), true);
  assert.strictEqual(CategoryHelperService.isDefaultSubcategory('Αυτοκίνητο', 'Custom Sub'), false);

  global.state = { lang: 'en' };
  assert.strictEqual(CategoryHelperService.getSubcategoryDisplayName('Βενζίνη', 'Αυτοκίνητο'), 'Fuel');
  assert.strictEqual(CategoryHelperService.getSubcategoryDisplayName('Custom Sub', 'Αυτοκίνητο'), 'Custom Sub');
});
