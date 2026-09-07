const test = require('node:test');
const assert = require('node:assert/strict');
const AppUpdateService = require('../js/appUpdateService.js');

test('AppUpdateService exports all expected functions', () => {
  assert.equal(typeof AppUpdateService.forceAppUpdate, 'function');
  assert.equal(typeof AppUpdateService.enterGuestMode, 'function');
});

test('forceAppUpdate aborts if user denies confirmation', async () => {
  global.window = {
    state: { lang: 'el' },
    showConfirm: async () => false
  };

  const result = await AppUpdateService.forceAppUpdate();
  assert.equal(result, false);
});

test('forceAppUpdate invokes Capgo updater flow when Capacitor is present', async () => {
  let downloadCalled = false;
  let setCalled = false;

  global.window = {
    state: { lang: 'en' },
    showConfirm: async () => true,
    showSyncToast: () => {},
    fetch: async () => ({
      json: async () => ({ url: 'https://example.com/bundle.zip', version: '1.0.1688' })
    }),
    Capacitor: {
      Plugins: {
        CapacitorUpdater: {
          download: async (opts) => {
            downloadCalled = true;
            return { id: 'test-bundle-id' };
          },
          set: async (opts) => {
            setCalled = true;
            assert.equal(opts.id, 'test-bundle-id');
          },
          reload: async () => {}
        }
      }
    }
  };

  const result = await AppUpdateService.forceAppUpdate();
  assert.equal(result, true);
  assert.equal(downloadCalled, true);
  assert.equal(setCalled, true);
});

test('enterGuestMode resets sensitive session state and initializes guest session', async () => {
  const mockStorage = new Map();
  global.localStorage = {
    setItem: (k, v) => mockStorage.set(k, v),
    removeItem: (k) => mockStorage.delete(k),
    getItem: (k) => mockStorage.get(k)
  };

  let loadDataCalled = false;
  let flushUICalled = false;

  global.state = {
    guestMode: false,
    currentUser: { id: 'u123' },
    transactions: [{ id: 'tx1' }],
    recurringTemplates: [{ id: 'rec1' }]
  };

  global.window = {
    state: global.state,
    hideAuthOverlay: () => {},
    toggleLoader: () => {},
    updateHeaderProfileBadge: () => {},
    renderPartnerSection: () => {},
    loadData: async () => { loadDataCalled = true; },
    flushUI: () => { flushUICalled = true; }
  };

  global.document = {
    getElementById: (id) => ({ style: {} })
  };

  await AppUpdateService.enterGuestMode();

  assert.equal(global.state.guestMode, true);
  assert.equal(global.state.currentUser, null);
  assert.deepEqual(global.state.transactions, []);
  assert.deepEqual(global.state.recurringTemplates, []);
  assert.equal(mockStorage.get('auth_guest_mode'), 'true');
  assert.equal(loadDataCalled, true);
  assert.equal(flushUICalled, true);
});
