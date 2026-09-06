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
        appendChild(child) {
          this._children = this._children || [];
          this._children.push(child);
        },
        _children: []
      };
    }
    return this._elements[id];
  },
  createElement(tag) {
    return {
      tag,
      value: '',
      textContent: '',
      style: {}
    };
  }
};

global.state = {
  lang: 'el',
  transactions: [],
  currentUser: null,
  isSupabaseEnabled: false
};
global.showToast = () => {};
global.showAlert = () => {};
global.calculateInitialBalances = () => {};
global.updateUI = () => {};
global.closeModal = () => {};
global.computeCurrencyFields = () => {};
global.saveTransaction = async () => {};

const ImportService = require('../js/importService.js');

test('ImportService exports all required functions', () => {
  assert.strictEqual(typeof ImportService.populateMappingSelect, 'function');
  assert.strictEqual(typeof ImportService.handleExcelUpload, 'function');
  assert.strictEqual(typeof ImportService.autoMapColumns, 'function');
  assert.strictEqual(typeof ImportService.importExcelData, 'function');
  assert.strictEqual(typeof ImportService.processExcelImport, 'function');
  assert.strictEqual(typeof ImportService.getImportRows, 'function');
  assert.strictEqual(typeof ImportService.setImportRows, 'function');
});

test('ImportService.populateMappingSelect populates select options with file headers', () => {
  const headers = ['Ημερομηνία', 'Ποσό', 'Κατηγορία', 'Σημείωση'];
  ImportService.populateMappingSelect('test-select', headers, true);

  const sel = global.document.getElementById('test-select');
  assert.ok(sel._children.length === 5); // empty option + 4 headers
  assert.strictEqual(sel._children[0].value, '');
  assert.strictEqual(sel._children[0].textContent, '— (απαιτείται)');
  assert.strictEqual(sel._children[1].value, '0');
  assert.strictEqual(sel._children[1].textContent, 'Ημερομηνία');
  assert.strictEqual(sel._children[2].value, '1');
  assert.strictEqual(sel._children[2].textContent, 'Ποσό');
});

test('ImportService.autoMapColumns auto-detects standard columns in Greek and English', () => {
  const headers = ['Date', 'Amount', 'Category', 'Account', 'Note'];
  ImportService.autoMapColumns(headers);

  assert.strictEqual(global.document.getElementById('map-date').value, '0');
  assert.strictEqual(global.document.getElementById('map-amount').value, '1');
  assert.strictEqual(global.document.getElementById('map-category').value, '2');
  assert.strictEqual(global.document.getElementById('map-account').value, '3');
  assert.strictEqual(global.document.getElementById('map-note').value, '4');
});

test('ImportService gets and sets rows and headers', () => {
  ImportService.setImportRows([['2026-09-01', '100', 'Groceries']]);
  ImportService.setImportHeaders(['Date', 'Amount', 'Category']);

  assert.strictEqual(ImportService.getImportRows().length, 1);
  assert.strictEqual(ImportService.getImportHeaders().length, 3);
  assert.strictEqual(ImportService.getImportRows()[0][1], '100');
});
