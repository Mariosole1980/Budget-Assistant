const test = require('node:test');
const assert = require('node:assert/strict');

// Set up minimal globals for selection testing
global.window = global;
global.localStorage = {
  getItem: () => '1',
  setItem: () => {}
};
global.document = {
  getElementById: (id) => ({
    classList: {
      add: () => {},
      remove: () => {}
    },
    textContent: ''
  })
};
global.TRANSLATIONS = {
  el: { selection_count_text: 'επιλεγμένα' }
};
global.state = {
  lang: 'el',
  selectionMode: false,
  selectedIds: new Set(),
  selectedYear: 2026,
  selectedMonth: 8,
  transactions: [
    { id: 'tx-1', date: '2026-09-01' },
    { id: 'tx-2', date: '2026-09-02' }
  ]
};
global.ensureHistoryPushed = () => {};
global.updateNoteShortcutVisibility = () => {};
global.renderTransactionsTab = () => {};

const selectionService = require('../js/selectionService.js');

test('SelectionService exports expected functions', () => {
  assert.equal(typeof selectionService.enterSelectionMode, 'function');
  assert.equal(typeof selectionService.exitSelectionMode, 'function');
  assert.equal(typeof selectionService.toggleSelection, 'function');
  assert.equal(typeof selectionService.updateSelectionHeader, 'function');
  assert.equal(typeof selectionService.getVisibleTransactionIds, 'function');
  assert.equal(typeof selectionService.toggleSelectAll, 'function');
  assert.equal(typeof selectionService.deleteSelectedTransactions, 'function');
});

test('enterSelectionMode and exitSelectionMode manage selection state correctly', () => {
  selectionService.enterSelectionMode();
  assert.equal(global.state.selectionMode, true);
  assert.equal(global.state.selectedIds.size, 0);

  selectionService.toggleSelection('tx-1');
  assert.equal(global.state.selectedIds.has('tx-1'), true);

  selectionService.toggleSelection('tx-1');
  assert.equal(global.state.selectedIds.has('tx-1'), false);

  selectionService.exitSelectionMode();
  assert.equal(global.state.selectionMode, false);
});

test('toggleSelectAll toggles all visible transactions', () => {
  selectionService.enterSelectionMode();
  selectionService.toggleSelectAll();
  assert.equal(global.state.selectedIds.has('tx-1'), true);
  assert.equal(global.state.selectedIds.has('tx-2'), true);

  selectionService.toggleSelectAll();
  assert.equal(global.state.selectedIds.has('tx-1'), false);
  assert.equal(global.state.selectedIds.has('tx-2'), false);
});
