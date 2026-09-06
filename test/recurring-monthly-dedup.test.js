const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const utils = require('../js/utils.js');
const { normalizeGreekString, normalizeString, normalizeCategoryName } = utils;
global.normalizeGreekString = normalizeGreekString;
global.normalizeString = normalizeString;
global.normalizeCategoryName = normalizeCategoryName;

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

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
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

// Evaluate helper functions from app.js
eval(extractFn('isSameCategory'));
eval(extractFn('cleanDuplicateTemplates'));
eval(extractFn('cleanCrossLanguageRecurringDuplicates'));

test('cleanCrossLanguageRecurringDuplicates removes displaced monthly recurring duplicate and keeps canonical occurrence', () => {
  global.localStorage.clear();
  global._recentlyDeletedTxIds = new Set();

  const templateId = 'tpl-tires-123';
  const template = {
    id: templateId,
    preset: 'monthly',
    startDate: '2026-09-24',
    amount: 58.70,
    type: 'expense',
    note: 'Αλλαγή Ελαστικών',
    category: 'Αυτοκίνητο'
  };

  const oldTx = {
    id: 'tx-tires-15',
    recurring_template_id: templateId,
    date: '2026-09-15',
    amount: 58.70,
    type: 'expense',
    note: 'Αλλαγή Ελαστικών',
    category: 'Αυτοκίνητο',
    created_at: '2026-09-01T10:00:00.000Z'
  };

  const canonicalTx = {
    id: 'tx-tires-24',
    recurring_template_id: templateId,
    date: '2026-09-24',
    amount: 58.70,
    type: 'expense',
    note: 'Αλλαγή Ελαστικών',
    category: 'Αυτοκίνητο',
    created_at: '2026-09-05T12:00:00.000Z'
  };

  global.state = {
    recurringTemplates: [template],
    transactions: [oldTx, canonicalTx],
    isSupabaseEnabled: false,
    supabaseClient: null,
    currentUser: null
  };

  cleanCrossLanguageRecurringDuplicates();

  // Exactly ONE transaction should remain in state.transactions: the 24th Sep occurrence
  assert.strictEqual(state.transactions.length, 1, 'Should have exactly 1 occurrence remaining');
  assert.strictEqual(state.transactions[0].id, 'tx-tires-24', 'Remaining transaction should be the canonical 24th Sep occurrence');
  assert.strictEqual(state.transactions[0].date, '2026-09-24');

  // Old transaction should be recorded in permanent_deleted_tx_ids so offline cache cannot resurrect it
  const perm = JSON.parse(global.localStorage.getItem('permanent_deleted_tx_ids') || '[]');
  assert.ok(perm.includes('tx-tires-15'), 'Old transaction ID should be recorded in permanent_deleted_tx_ids tombstone');
});

test('cleanCrossLanguageRecurringDuplicates NEVER touches manual non-recurring transactions', () => {
  global.localStorage.clear();
  global._recentlyDeletedTxIds = new Set();

  const manualTx1 = {
    id: 'manual-1',
    date: '2026-09-10',
    amount: 15.00,
    type: 'expense',
    note: 'Καφές',
    category: 'Καφές',
    created_at: '2026-09-10T09:00:00.000Z'
  };

  const manualTx2 = {
    id: 'manual-2',
    date: '2026-09-15',
    amount: 15.00,
    type: 'expense',
    note: 'Καφές',
    category: 'Καφές',
    created_at: '2026-09-15T09:00:00.000Z'
  };

  global.state = {
    recurringTemplates: [],
    transactions: [manualTx1, manualTx2],
    isSupabaseEnabled: false,
    supabaseClient: null,
    currentUser: null
  };

  cleanCrossLanguageRecurringDuplicates();

  assert.strictEqual(state.transactions.length, 2, 'Both manual transactions must be preserved untouched');
});

test('cleanCrossLanguageRecurringDuplicates falls back to newest transaction if neither matches targetDay', () => {
  global.localStorage.clear();
  global._recentlyDeletedTxIds = new Set();

  const templateId = 'tpl-subscription-99';
  const template = {
    id: templateId,
    preset: 'monthly',
    startDate: '2026-09-01',
    amount: 9.99,
    type: 'expense',
    note: 'Streaming Service',
    category: 'Ψυχαγωγία'
  };

  const txEarlier = {
    id: 'tx-stream-early',
    recurring_template_id: templateId,
    date: '2026-09-05',
    amount: 9.99,
    type: 'expense',
    note: 'Streaming Service',
    category: 'Ψυχαγωγία',
    created_at: '2026-09-05T10:00:00.000Z'
  };

  const txLater = {
    id: 'tx-stream-late',
    recurring_template_id: templateId,
    date: '2026-09-08',
    amount: 9.99,
    type: 'expense',
    note: 'Streaming Service',
    category: 'Ψυχαγωγία',
    created_at: '2026-09-08T10:00:00.000Z'
  };

  global.state = {
    recurringTemplates: [template],
    transactions: [txEarlier, txLater],
    isSupabaseEnabled: false,
    supabaseClient: null,
    currentUser: null
  };

  cleanCrossLanguageRecurringDuplicates();

  assert.strictEqual(state.transactions.length, 1, 'Should keep only 1 transaction');
  assert.strictEqual(state.transactions[0].id, 'tx-stream-late', 'Should keep the newer transaction');
});
