const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM
global.window = global;
const elements = {};

global.document = {
  querySelectorAll(sel) {
    if (sel === '.custom-select-container') {
      return Object.values(elements).filter(e => e.className && e.className.includes('custom-select-container'));
    }
    return [];
  },
  getElementById(id) {
    if (!elements[id]) {
      const classes = new Set();
      elements[id] = {
        id,
        className: 'custom-select-container',
        value: '',
        options: [],
        classList: {
          add(c) { classes.add(c); },
          remove(c) { classes.delete(c); },
          toggle(c) {
            if (classes.has(c)) { classes.delete(c); return false; }
            classes.add(c); return true;
          },
          contains(c) { return classes.has(c); }
        },
        querySelector(sel) {
          return { textContent: '' };
        },
        querySelectorAll(sel) {
          return [];
        },
        dispatchEvent(evt) {
          this._dispatchedEvent = evt;
        }
      };
    }
    return elements[id];
  },
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute() {},
      appendChild() {}
    };
  }
};

global.window.addEventListener = () => {};
global.Event = function(name) { this.name = name; };

const DropdownFilterService = require('../js/dropdownFilterService.js');

test('DropdownFilterService: exports all expected functions to module and window', () => {
  assert.strictEqual(typeof DropdownFilterService.toggleCustomDropdown, 'function');
  assert.strictEqual(typeof DropdownFilterService.selectCustomDropdownOption, 'function');
  assert.strictEqual(typeof DropdownFilterService.syncCustomSelect, 'function');
  assert.strictEqual(typeof DropdownFilterService.updateCustomSelectTriggers, 'function');

  // Verify window attachments
  assert.strictEqual(typeof window.toggleCustomDropdown, 'function');
  assert.strictEqual(typeof window.selectCustomDropdownOption, 'function');
  assert.strictEqual(typeof window.syncCustomSelect, 'function');
  assert.strictEqual(typeof window.updateCustomSelectTriggers, 'function');
});

test('DropdownFilterService: toggleCustomDropdown toggles open state', () => {
  const container = document.getElementById('custom-select-container-type');
  const fakeEvent = { stopPropagation() {} };

  DropdownFilterService.toggleCustomDropdown(fakeEvent, 'type');
  assert.strictEqual(container.classList.contains('dropdown-open'), true);

  DropdownFilterService.toggleCustomDropdown(fakeEvent, 'type');
  assert.strictEqual(container.classList.contains('dropdown-open'), false);
});

test('DropdownFilterService: selectCustomDropdownOption updates native select value', () => {
  const nativeSelect = document.getElementById('search-filter-category');
  DropdownFilterService.selectCustomDropdownOption('category', 'food', 'Food & Groceries');
  assert.strictEqual(nativeSelect.value, 'food');
  assert.ok(nativeSelect._dispatchedEvent);
});
