const test = require('node:test');
const assert = require('node:assert/strict');
const SubcategorySuggestionService = require('../js/subcategorySuggestionService.js');

test('SubcategorySuggestionService exports all expected functions', () => {
  assert.equal(typeof SubcategorySuggestionService.updateSubcategorySuggestions, 'function');
  assert.equal(typeof SubcategorySuggestionService.showSubcategorySelect, 'function');
  assert.equal(typeof SubcategorySuggestionService.hideSubcategorySelect, 'function');
});

test('updateSubcategorySuggestions prompts to select category first when category is empty', () => {
  const mockSubcatList = { innerHTML: '', appendChild: () => {} };
  global.document = {
    getElementById: (id) => {
      if (id === 'trans-category') return { value: '' };
      if (id === 'subcategory-picker-list') return mockSubcatList;
      if (id === 'trans-subcategory-select') return { value: '' };
      return null;
    },
    createElement: (tag) => ({ className: '', innerHTML: '', setAttribute: () => {} })
  };
  global.window = {
    state: { lang: 'el' },
    TRANSLATIONS: { el: { select_category_first: 'Επιλέξτε πρώτα κατηγορία' } }
  };

  SubcategorySuggestionService.updateSubcategorySuggestions();
  assert.ok(mockSubcatList.innerHTML.includes('Επιλέξτε πρώτα κατηγορία'));
});

test('updateSubcategorySuggestions populates options when category is present', () => {
  const appended = [];
  const mockSubcatList = {
    innerHTML: '',
    appendChild: (el) => appended.push(el)
  };
  global.document = {
    getElementById: (id) => {
      if (id === 'trans-category') return { value: 'Food' };
      if (id === 'subcategory-picker-list') return mockSubcatList;
      if (id === 'trans-subcategory-select') return { value: 'Groceries' };
      return null;
    },
    createElement: (tag) => {
      const el = {
        className: '',
        innerHTML: '',
        classList: { add: (c) => { el.className += ' ' + c; } },
        setAttribute: (k, v) => { el[k] = v; }
      };
      return el;
    }
  };
  global.window = {
    state: { lang: 'el' },
    TRANSLATIONS: { el: { option_new_subcategory: 'Νέα υποκατηγορία...' } },
    getSortedSubcategoriesForCategory: (cat) => ['Groceries', 'Restaurants'],
    getSubcategoryDisplayName: (sub, cat) => sub
  };

  SubcategorySuggestionService.updateSubcategorySuggestions();

  // Should have appended: 1 "No subcategory", 2 subcategories, 1 "New subcategory" -> 4 items
  assert.equal(appended.length, 4);
  assert.ok(appended[0].className.includes('none-subcat'));
  assert.ok(appended[1]['data-subcat-name'] === 'Groceries');
  assert.ok(appended[3].className.includes('new-subcat'));
});

test('showSubcategorySelect and hideSubcategorySelect toggle visibility appropriately', () => {
  const triggerEl = { style: { display: 'flex' } };
  const customEl = { style: { display: 'none' }, value: 'Custom', focus: () => {} };
  const cancelBtnEl = { style: { display: 'none' } };
  const subSelectEl = { value: '' };
  const displayEl = { innerHTML: '' };
  let visibilityUpdated = 0;

  global.document = {
    getElementById: (id) => {
      if (id === 'trans-subcategory-trigger') return triggerEl;
      if (id === 'trans-subcategory-custom') return customEl;
      if (id === 'btn-cancel-custom-sub') return cancelBtnEl;
      if (id === 'trans-subcategory-select') return subSelectEl;
      if (id === 'trans-subcategory-display') return displayEl;
      return null;
    }
  };
  global.window = {
    updateSubcategoryRowVisibility: () => { visibilityUpdated++; }
  };

  SubcategorySuggestionService.showSubcategorySelect();
  assert.equal(triggerEl.style.display, 'none');
  assert.equal(customEl.style.display, 'block');
  assert.equal(cancelBtnEl.style.display, 'block');
  assert.equal(subSelectEl.value, '__NEW__');
  assert.equal(visibilityUpdated, 1);

  SubcategorySuggestionService.hideSubcategorySelect();
  assert.equal(triggerEl.style.display, 'flex');
  assert.equal(customEl.style.display, 'none');
  assert.equal(cancelBtnEl.style.display, 'none');
  assert.equal(customEl.value, '');
  assert.equal(subSelectEl.value, '');
  assert.equal(visibilityUpdated, 2);
});
