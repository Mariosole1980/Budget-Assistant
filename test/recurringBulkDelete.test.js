// NOTE: No 'use strict' here on purpose — the tests eval function source
// extracted from app.js (same pattern as test/templateMerge.test.js) and in
// strict mode a direct eval gets its own scope, hiding the extracted functions.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Regression tests for the bulk recurring multi-delete flow.
//
// Bug: the multi-select delete bar only showed the 3-option recurring delete
// modal (single / future / all) when EXACTLY ONE recurring transaction was
// selected. Selecting 2+ recurring transactions (e.g. two occurrences of the
// same series in one month) fell through to a plain "Delete N transactions?"
// confirm with no recurring options at all.
//
// Fixed by:
//   • deleteSelectedTransactions()  — routes ANY selection that contains
//     recurring rows through the recurring delete modal (bulk-aware).
//   • openBulkRecurringDeleteModal()  — builds a bulk context (one entry per
//     selected occurrence + the regular selections).
//   • executeBulkRecurringDelete()  — applies the chosen scope to every
//     involved recurring series and also deletes the regular selections.
// ---------------------------------------------------------------------------

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

// Extract a top-level function by name (handles `async function X(`).
function extractFn(name) {
  let start = -1;
  for (const prefix of ['async function ' + name + '(', 'function ' + name + '(']) {
    start = appJs.indexOf(prefix);
    if (start !== -1) break;
  }
  if (start === -1) throw new Error('function ' + name + ' not found in app.js');

  const braceStart = appJs.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < appJs.length; i++) {
    if (appJs[i] === '{') depth++;
    else if (appJs[i] === '}') { depth--; if (depth === 0) break; }
  }
  return appJs.slice(start, i + 1);
}

// ---- Global mocks ---------------------------------------------------------
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: (sel) => (sel.includes('recurring_delete_scope') ? { checked: false } : null),
  querySelectorAll: () => []
};
global.normalizeString = (str) => String(str || '').toLowerCase().trim();
global.suppressRealtimeFor = () => {};
global.enqueueSyncMutation = () => {};
global._markRecentlyDeleted = () => {};
global.calculateInitialBalances = () => {};
global.updateUI = () => {};
global.renderTrashBinList = () => {};
global.showSyncToast = () => {};
global.mapTemplateToDb = (t) => t;
global.openModal = () => {};
global.TRANSLATIONS = {};

// Load the real functions under test from app.js. All are eval'd together at
// module top level (NOT inside a callback) so their declarations share the
// module scope and can reference each other (same pattern as
// test/templateMerge.test.js).
eval([
  'stripLeadingEmoji',
  'isSameCategory',
  'getDeletedDatesFromTemplate',
  'addDeletedDateToTemplate',
  '_computeRecurringSeriesDates',
  '_txBelongsToRecurringSeries',
  'resolveRecurringTemplateForTx',
  'executeBulkRecurringDelete',
  'openBulkRecurringDeleteModal',
  'deleteSelectedTransactions'
].map(extractFn).join('\n'));

function makeState() {
  return {
    lang: 'el',
    selectionMode: false,
    selectedIds: new Set(),
    transactions: [],
    recurringTemplates: [],
    deletedRecurringDates: [],
    trashTransactions: [],
    isSupabaseEnabled: false,
    currentUser: null,
    partnerProfile: null,
    userProfile: null
  };
}

function makeBulkCtx(entries, extra) {
  return Object.assign({
    bulkMode: true,
    bulkEntries: entries,
    templateId: entries.length === 1 ? entries[0].templateId : null,
    anchorDate: entries.map(e => e.date).sort()[0],
    note: '',
    category: 'Bills',
    amount: 50,
    type: 'expense',
    accountFrom: '',
    plainSelectedIds: []
  }, extra || {});
}

// ---------------------------------------------------------------------------
// openBulkRecurringDeleteModal
// ---------------------------------------------------------------------------

test('openBulkRecurringDeleteModal: 2 occurrences of the SAME series build a single-series bulk context', () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 't2', recurring_template_id: 'tpl1', date: '2026-08-12', amount: 50, type: 'expense', category: 'Bills' }
  ];

  openBulkRecurringDeleteModal(state.transactions, { plainSelectedIds: [] });
  const ctx = window._activeRecurringDeleteContext;
  assert.ok(ctx, 'bulk context must be set');
  assert.equal(ctx.bulkMode, true);
  assert.equal(ctx.bulkEntries.length, 2);
  assert.equal(ctx.templateId, 'tpl1', 'single series → templateId kept');
  assert.equal(ctx.anchorDate, '2026-08-05', 'anchor = earliest selected date');
  assert.deepEqual(ctx.plainSelectedIds, []);
});

test('openBulkRecurringDeleteModal: MULTIPLE series + regular rows carry plain ids and templateId null', () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tplA', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' },
    { id: 'tplB', preset: 'monthly', startDate: '2026-08-10', amount: 20, type: 'expense', category: 'Coffee', description: '' }
  ];
  global.state.transactions = [
    { id: 'tA', recurring_template_id: 'tplA', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'tB', recurring_template_id: 'tplB', date: '2026-08-10', amount: 20, type: 'expense', category: 'Coffee' }
  ];

  openBulkRecurringDeleteModal(state.transactions, { plainSelectedIds: ['p1', 'p2'] });
  const ctx = window._activeRecurringDeleteContext;
  assert.ok(ctx);
  assert.equal(ctx.bulkMode, true);
  assert.equal(ctx.templateId, null, 'multi-series → templateId null');
  assert.equal(ctx.bulkEntries.length, 2);
  assert.deepEqual(ctx.plainSelectedIds, ['p1', 'p2']);
});

// ---------------------------------------------------------------------------
// executeBulkRecurringDelete
// ---------------------------------------------------------------------------

test("bulk scope 'single': deletes ONLY the selected occurrences and marks their dates (same series, 2 selected)", async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '', user_id: 'u1' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', user_id: 'u1' },
    { id: 't2', recurring_template_id: 'tpl1', date: '2026-08-12', amount: 50, type: 'expense', category: 'Bills', user_id: 'u1' },
    { id: 't3', recurring_template_id: 'tpl1', date: '2026-09-05', amount: 50, type: 'expense', category: 'Bills', user_id: 'u1' },
    { id: 'plain1', date: '2026-08-15', amount: 10, type: 'expense', category: 'Other', user_id: 'u1' }
  ];
  const ctx = makeBulkCtx([
    { txId: 't1', templateId: 'tpl1', date: '2026-08-05' },
    { txId: 't2', templateId: 'tpl1', date: '2026-08-12' }
  ], { plainSelectedIds: ['plain1'] });

  await executeBulkRecurringDelete('single', ctx);

  // Only the future (unselected) occurrence survives.
  assert.deepEqual(state.transactions.map(t => t.id), ['t3']);
  // Both selected dates are marked as deleted so the series does not regenerate them.
  assert.ok(state.deletedRecurringDates.includes('tpl1_2026-08-05'));
  assert.ok(state.deletedRecurringDates.includes('tpl1_2026-08-12'));
  assert.ok(!state.deletedRecurringDates.includes('tpl1_2026-09-05'));
  // Trash group captures exactly the removed real rows (no synthetic entries for 'single').
  assert.equal(state.trashTransactions.length, 1);
  assert.deepEqual(state.trashTransactions[0].affectedTransactionIds.slice().sort(), ['plain1', 't1', 't2']);
  assert.equal(state.trashTransactions[0].templateBackup.id, 'tpl1');
  const tplDesc = state.recurringTemplates[0].description || '';
  assert.ok(tplDesc.includes('2026-08-05') && tplDesc.includes('2026-08-12'));
  assert.ok(!tplDesc.includes('2026-09-05'));
});

test("bulk scope 'future': deletes from each series' earliest selected date onwards and terminates templates", async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tplA', preset: 'monthly', startDate: '2026-07-05', amount: 50, type: 'expense', category: 'Bills', description: '' },
    { id: 'tplB', preset: 'monthly', startDate: '2026-08-10', amount: 20, type: 'expense', category: 'Coffee', description: '' }
  ];
  global.state.transactions = [
    { id: 'tA1', recurring_template_id: 'tplA', date: '2026-07-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'tA2', recurring_template_id: 'tplA', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'tA3', recurring_template_id: 'tplA', date: '2026-09-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'tB1', recurring_template_id: 'tplB', date: '2026-08-10', amount: 20, type: 'expense', category: 'Coffee' },
    { id: 'tB2', recurring_template_id: 'tplB', date: '2026-09-10', amount: 20, type: 'expense', category: 'Coffee' },
    { id: 'plain1', date: '2026-08-15', amount: 10, type: 'expense', category: 'Other' }
  ];
  const ctx = makeBulkCtx([
    { txId: 'tA2', templateId: 'tplA', date: '2026-08-05' },
    { txId: 'tB1', templateId: 'tplB', date: '2026-08-10' }
  ], { templateId: null, plainSelectedIds: ['plain1'] });

  await executeBulkRecurringDelete('future', ctx);

  // tA1 is before tplA's anchor → kept. Everything from the anchors onward is gone.
  assert.deepEqual(state.transactions.map(t => t.id), ['tA1']);
  assert.equal(state.recurringTemplates.find(t => t.id === 'tplA').endDate, '2026-08-04');
  assert.equal(state.recurringTemplates.find(t => t.id === 'tplB').endDate, '2026-08-09');
  assert.equal(state.trashTransactions.length, 1);
});

test("bulk scope 'all': removes the whole series + templates and records synthetic future occurrences", async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' },
    { id: 'tplX', preset: 'monthly', startDate: '2026-08-20', amount: 5, type: 'expense', category: 'Other', description: '' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 't2', recurring_template_id: 'tpl1', date: '2026-09-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'tX1', recurring_template_id: 'tplX', date: '2026-08-20', amount: 5, type: 'expense', category: 'Other' }
  ];
  const ctx = makeBulkCtx([
    { txId: 't1', templateId: 'tpl1', date: '2026-08-05' },
    { txId: 'tX1', templateId: 'tplX', date: '2026-08-20' }
  ], { templateId: null, plainSelectedIds: [] });

  await executeBulkRecurringDelete('all', ctx);

  assert.equal(state.transactions.length, 0, 'all series occurrences removed');
  assert.equal(state.recurringTemplates.length, 0, 'templates removed');
  const group = state.trashTransactions[0];
  assert.equal(group.scope, 'all');
  assert.ok(group.affectedTransactionsSnapshot.some(t => t._synthetic), 'synthetic future occurrences captured for trash');
  assert.ok(!group.affectedTransactionIds.some(id => String(id).startsWith('recurring_future_')), 'synthetic rows are NOT real ids');
});

// ---------------------------------------------------------------------------
// deleteSelectedTransactions routing
// ---------------------------------------------------------------------------

test('multi-select delete: 2 recurring selections route to the bulk modal (array target)', async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 't2', recurring_template_id: 'tpl1', date: '2026-08-12', amount: 50, type: 'expense', category: 'Bills' }
  ];
  global.state.selectedIds = new Set(['t1', 't2']);

  const calls = [];
  global.exitSelectionMode = () => { state.selectionMode = false; state.selectedIds.clear(); };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.openRecurringDeleteModal = (...args) => calls.push(args);
  global.showConfirm = async () => true;

  await deleteSelectedTransactions();

  assert.equal(calls.length, 1, 'recurring modal must open');
  assert.ok(Array.isArray(calls[0][0]), 'bulk path passes an array of transactions');
  assert.equal(calls[0][0].length, 2);
  assert.deepEqual(calls[0][2].plainSelectedIds, []);
});

test('multi-select delete: mixed recurring + regular selection routes to bulk modal and carries plain ids', async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' },
    { id: 'p1', date: '2026-08-15', amount: 10, type: 'expense', category: 'Other' }
  ];
  global.state.selectedIds = new Set(['t1', 'p1']);

  const calls = [];
  global.exitSelectionMode = () => { state.selectionMode = false; state.selectedIds.clear(); };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.openRecurringDeleteModal = (...args) => calls.push(args);
  global.showConfirm = async () => true;

  await deleteSelectedTransactions();

  assert.equal(calls.length, 1);
  assert.ok(Array.isArray(calls[0][0]));
  assert.equal(calls[0][0].length, 1, 'only the recurring row is the modal target');
  assert.deepEqual(calls[0][2].plainSelectedIds, ['p1'], 'regular selection carried along');
});

test('multi-select delete: single recurring selection keeps the original non-bulk modal call', async () => {
  global.state = makeState();
  global.state.recurringTemplates = [
    { id: 'tpl1', preset: 'monthly', startDate: '2026-08-05', amount: 50, type: 'expense', category: 'Bills', description: '' }
  ];
  global.state.transactions = [
    { id: 't1', recurring_template_id: 'tpl1', date: '2026-08-05', amount: 50, type: 'expense', category: 'Bills' }
  ];
  global.state.selectedIds = new Set(['t1']);

  const calls = [];
  global.exitSelectionMode = () => { state.selectionMode = false; state.selectedIds.clear(); };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.openRecurringDeleteModal = (...args) => calls.push(args);
  global.showConfirm = async () => true;

  await deleteSelectedTransactions();

  assert.equal(calls.length, 1);
  assert.ok(!Array.isArray(calls[0][0]), 'single recurring keeps the object-based call');
});

test('multi-select delete: plain-only selection does NOT open the recurring modal', async () => {
  global.state = makeState();
  global.state.recurringTemplates = [];
  global.state.transactions = [
    { id: 'p1', date: '2026-08-05', amount: 10, type: 'expense', category: 'Other' },
    { id: 'p2', date: '2026-08-06', amount: 20, type: 'expense', category: 'Other' }
  ];
  global.state.selectedIds = new Set(['p1', 'p2']);

  const calls = [];
  global.exitSelectionMode = () => { state.selectionMode = false; state.selectedIds.clear(); };
  global.setTimeout = (fn) => { fn(); return 0; };
  global.openRecurringDeleteModal = (...args) => calls.push(args);
  global.showConfirm = async () => false; // user cancels the plain confirm

  await deleteSelectedTransactions();

  assert.equal(calls.length, 0, 'plain bulk delete path must not open the recurring modal');
});