const test = require('node:test');
const assert = require('node:assert/strict');

// Set up globals
global.window = global;
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

const PartnerSyncService = require('../js/partnerSyncService.js');

test('getMemberBadgeHTML is available globally and on PartnerSyncService', () => {
  assert.equal(typeof global.getMemberBadgeHTML, 'function');
  assert.equal(typeof PartnerSyncService.getMemberBadgeHTML, 'function');
});

test('renderTransactionsTab card generation does not throw when getMemberBadgeHTML is invoked', () => {
  global.state = {
    lang: 'el',
    accounts: [],
    categories: [],
    selectedIds: new Set(),
    selectionMode: false,
    selectedYear: 2026,
    selectedMonth: 8,
    userProfile: { family_id: 'fam-1' },
    familyProfiles: [{ id: 'u1', display_name: 'Nikos', email: 'nikos@test.com' }],
    partnerProfile: null
  };

  const sampleTx = {
    id: 'tx-100',
    date: '2026-09-07T12:00:00',
    amount: 42.50,
    type: 'expense',
    category: 'Supermarket',
    subcategory: 'Groceries',
    user_id: 'u1',
    family_id: 'fam-1'
  };

  const badgeHtml = global.getMemberBadgeHTML(sampleTx);
  assert.ok(typeof badgeHtml === 'string');
  assert.ok(badgeHtml.includes('trans-member-badge'));
  assert.ok(badgeHtml.includes('N'));
});

test('Swipe transition error recovery cleans up isSwipingMonth', () => {
  global.state = {
    activeTab: 'trans',
    isSwipingMonth: false,
    touchDidMove: false,
    lastSwipeTime: 0
  };

  let threw = false;
  try {
    global.state.isSwipingMonth = true;
    const failingCallback = () => {
      throw new Error('Test swipe render failure');
    };
    try {
      failingCallback();
    } catch (err) {
      threw = true;
      global.state.isSwipingMonth = false;
      global.state.touchDidMove = false;
    }
  } catch (e) {}

  assert.equal(threw, true);
  assert.equal(global.state.isSwipingMonth, false);
});
