const test = require('node:test');
const assert = require('node:assert/strict');

// The loader resolves tombstone helpers from the global scope; require the real
// implementation so these tests exercise the actual durable-delete logic.
global.window = global;
const DataIntegrityService = require('../js/dataIntegrityService.js');
Object.assign(global, DataIntegrityService);

const DataLoaderService = require('../js/dataLoaderService.js');

function useMapStorage(entries = []) {
  const storage = new Map(entries);
  global.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  };
  return storage;
}

// Minimal PostgREST-like stub: select queries resolve to the supplied rows and
// inserts echo the inserted rows back (Supabase `.insert(...).select()` shape).
function createSupabaseStub(rowsByTable = {}) {
  const inserted = {};
  const makeBuilder = (table) => {
    const result = { data: table in rowsByTable ? rowsByTable[table] : [], error: null };
    const builder = {
      select: () => builder,
      or: () => builder,
      eq: () => builder,
      order: () => builder,
      range: () => builder,
      then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
      insert: (rows) => {
        const list = Array.isArray(rows) ? rows : [rows];
        inserted[table] = (inserted[table] || []).concat(list);
        return { select: () => Promise.resolve({ data: list.map(r => ({ ...r })), error: null }) };
      }
    };
    return builder;
  };
  return { client: { from: makeBuilder }, inserted };
}

test('DataLoaderService exports loadData and loadOfflineData', () => {
  assert.equal(typeof DataLoaderService.loadData, 'function');
  assert.equal(typeof DataLoaderService.loadOfflineData, 'function');
});

test('loadOfflineData in guest mode provides clean slate with demo filter and defaults', () => {
  const storage = new Map([
    ['offline_transactions', JSON.stringify([{ id: 'tx1' }, { id: 'demo_1', is_demo: true }])],
    ['cached_budgets', JSON.stringify([{ id: 'b1' }, { id: 'demo_b1', is_demo: true }])]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [{ id: 'cat1', name: 'Food' }];
  global.getOfflineGuestTransactions = () => [];

  global.state = {
    guestMode: true,
    transactions: [],
    budgets: [],
    accounts: [],
    categories: []
  };
  global.window = { state: global.state };

  DataLoaderService.loadOfflineData();

  assert.equal(global.state.guestMode, true);
  assert.equal(global.state.currentUser, null);
  // Only the demo items should be retained
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'demo_1');
  assert.equal(global.state.budgets.length, 1);
  assert.equal(global.state.budgets[0].id, 'demo_b1');
  assert.equal(global.state.accounts.length, 1);
  assert.equal(global.state.categories.length, 1);
});

test('loadOfflineData restores cached user profile and transactions for authenticated session', () => {
  const mockUser = { id: 'user_123', email: 'user@example.com' };
  const mockTxs = [{ id: 'tx_auth_1', amount: 45 }];
  const storage = new Map([
    ['cached_current_user', JSON.stringify(mockUser)],
    ['cached_user_profile', JSON.stringify({ id: 'user_123', full_name: 'Test User' })],
    ['offline_transactions', JSON.stringify(mockTxs)]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };

  global.state = {
    guestMode: false,
    currentUser: null,
    transactions: []
  };
  global.window = { state: global.state };

  DataLoaderService.loadOfflineData();

  assert.equal(global.state.currentUser.id, 'user_123');
  assert.equal(global.state.userProfile.full_name, 'Test User');
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'tx_auth_1');
});

test('loadData handles guestMode by setting offline sync status and populating state', async () => {
  let syncStatus = null;
  const storage = new Map([
    ['offline_transactions', JSON.stringify([{ id: 'demo_tx', is_demo: true }])]
  ]);
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  };
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [{ id: 'cat1', name: 'Food' }];

  global.state = {
    guestMode: true,
    transactions: []
  };
  global.window = {
    state: global.state,
    updateHeaderSyncIcon: (s) => { syncStatus = s; }
  };
  global.updateHeaderSyncIcon = (s) => { syncStatus = s; };

  await DataLoaderService.loadData();

  assert.equal(syncStatus, 'offline');
  assert.equal(global.state.transactions.length, 1);
  assert.equal(global.state.transactions[0].id, 'demo_tx');
});

// === Durable category deletion regressions ===

test('loadOfflineData in guest mode keeps persisted guest categories (deletions survive reload)', () => {
  useMapStorage([
    // The guest deleted "Fun"; saveCategoriesToStorage persisted the surviving list.
    ['guest_categories', JSON.stringify([{ id: 'cat1', name: 'Food', type: 'expense' }])]
  ]);
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [
    { id: 'cat1', name: 'Food', type: 'expense' },
    { id: 'cat2', name: 'Fun', type: 'expense' }
  ];

  global.state = { guestMode: true, transactions: [], budgets: [], accounts: [], categories: [] };
  global.window = { state: global.state };

  DataLoaderService.loadOfflineData();

  assert.deepEqual(global.state.categories.map(c => c.name), ['Food'],
    'guest defaults must not be re-seeded over the persisted guest category list');
});

test('loadOfflineData filters default categories that were deliberately deleted (tombstones)', () => {
  useMapStorage();
  global.DEFAULT_ACCOUNTS = [{ id: 'acc1', name: 'Cash' }];
  global.DEFAULT_CATEGORIES = [
    { id: 'cat1', name: '🛒 Σούπερ Μάρκετ', type: 'expense' },
    { id: 'cat2', name: '🏡 ΣΠΙΤΙ', type: 'expense' }
  ];

  global.state = { guestMode: false, transactions: [], budgets: [], accounts: [], categories: [] };
  global.window = { state: global.state };

  DataIntegrityService.recordDeletedCategory('cat2', '🏡 ΣΠΙΤΙ', 'expense', { writeCloudTombstone: false });

  DataLoaderService.loadOfflineData();

  assert.deepEqual(global.state.categories.map(c => c.name), ['🛒 Σούπερ Μάρκετ'],
    'a deleted default category (e.g. ΣΠΙΤΙ) must never be resurrected from DEFAULT_CATEGORIES');
});

test('loadData cloud-empty seeding skips default categories that were deliberately deleted', async () => {
  useMapStorage();
  global.DEFAULT_ACCOUNTS = [{ id: 'acc_default', name: 'Cash', type: 'cash', balance: 0 }];
  global.DEFAULT_CATEGORIES = [
    { id: 'cat_food', name: '🛒 Σούπερ Μάρκετ', type: 'expense', icon: '🛒', color: '#111' },
    { id: 'cat_home', name: '🏡 ΣΠΙΤΙ', type: 'expense', icon: '🏡', color: '#222' }
  ];
  global.generateUUID = () => 'uuid-' + Math.random().toString(16).slice(2);

  // Record the tombstone under the same account that will load the cloud data.
  global.state = { guestMode: false, currentUser: { id: 'user-1' } };
  global.window = global;

  // The user deleted ΣΠΙΤΙ on purpose; the cloud row is gone and must stay gone.
  DataIntegrityService.recordDeletedCategory('cat_home', '🏡 ΣΠΙΤΙ', 'expense', { writeCloudTombstone: false });

  const supabase = createSupabaseStub({
    categories: [],
    accounts: [],
    recurring_templates: null,
    transactions: []
  });

  global.state = {
    guestMode: false,
    currentUser: { id: 'user-1' },
    partnerProfile: null,
    userProfile: null,
    isSupabaseEnabled: true,
    supabaseClient: supabase.client,
    transactions: [],
    categories: [],
    accounts: []
  };
  global.window = global;

  global.updateHeaderSyncIcon = () => {};
  global.updateUI = () => {};
  global.calculateInitialBalances = () => {};
  global.processSyncQueue = async () => {};
  global.promiseTimeout = (promise) => promise;
  global.reconcileStaleTombstones = () => {};
  global.autoSyncMissingTransactionsToCloud = async () => [];
  global.getPendingLocalTransactions = () => [];
  global.mergeAndDeduplicateTransactions = (a, b) => [...(a || []), ...(b || [])];
  global.compareTransactions = () => 0;
  global.getSyncQueue = () => [];
  global.autoRecoverTemplatesFromHistory = () => {};
  global.backfillRecurringTemplateIds = () => {};
  global.pushNoTransition = () => {};
  global.popNoTransition = () => {};
  global.cleanDuplicateCategories = async () => {};

  await DataLoaderService.loadData();

  const seededNames = (supabase.inserted.categories || []).map(c => c.name);
  assert.deepEqual(seededNames, ['🛒 Σούπερ Μάρκετ'],
    'only non-deleted defaults may be pre-populated in the cloud');
  assert.deepEqual(global.state.categories.map(c => c.name), ['🛒 Σούπερ Μάρκετ']);
  assert.equal(global.state.categories.some(c => c.name === '🏡 ΣΠΙΤΙ'), false,
    'ΣΠΙΤΙ must not be resurrected after the tombstone has been recorded');
});

test('loadData hides a cloud category whose delete is still pending in the sync queue', async () => {
  useMapStorage();
  global.DEFAULT_ACCOUNTS = [];
  global.DEFAULT_CATEGORIES = [];

  const supabase = createSupabaseStub({
    categories: [
      { id: 'cat_food', name: '🛒 Σούπερ Μάρκετ', type: 'expense' },
      { id: 'cat_home', name: '🏡 ΣΠΙΤΙ', type: 'expense' }
    ],
    accounts: [],
    recurring_templates: null,
    transactions: []
  });

  global.state = {
    guestMode: false,
    currentUser: { id: 'user-1' },
    partnerProfile: null,
    userProfile: null,
    isSupabaseEnabled: true,
    supabaseClient: supabase.client,
    transactions: [],
    categories: [],
    accounts: []
  };
  global.window = global;

  global.updateHeaderSyncIcon = () => {};
  global.updateUI = () => {};
  global.calculateInitialBalances = () => {};
  global.processSyncQueue = async () => {};
  global.promiseTimeout = (promise) => promise;
  global.reconcileStaleTombstones = () => {};
  global.autoSyncMissingTransactionsToCloud = async () => [];
  global.getPendingLocalTransactions = () => [];
  global.mergeAndDeduplicateTransactions = (a, b) => [...(a || []), ...(b || [])];
  global.compareTransactions = () => 0;
  // The user deleted ΣΠΙΤΙ while offline: the cloud row still exists but the
  // queued delete must keep it hidden so it cannot flash/resurrect on reload.
  global.getSyncQueue = () => [
    { id: 'q-cat-del', action: 'delete_category', payload: { id: 'cat_home' } }
  ];
  global.autoRecoverTemplatesFromHistory = () => {};
  global.backfillRecurringTemplateIds = () => {};
  global.pushNoTransition = () => {};
  global.popNoTransition = () => {};
  global.cleanDuplicateCategories = async () => {};

  await DataLoaderService.loadData();

  assert.deepEqual(global.state.categories.map(c => c.name), ['🛒 Σούπερ Μάρκετ'],
    'a pending delete_category queue item must suppress the still-present cloud row');
  assert.equal(global.state.categories.some(c => c.id === 'cat_home'), false);
  assert.deepEqual(supabase.inserted.categories || [], [],
    'a pending category delete must never be re-inserted into the cloud');
});
