const test = require('node:test');
const assert = require('node:assert/strict');

global.state = {
  userProfile: { id: 'usr-1', premium_active: false },
  familyProfiles: [],
  currentUser: { id: 'usr-1' },
  lang: 'el'
};

global.window = {
  state: global.state,
  location: { protocol: 'https:', hostname: 'budget-assistant-pwa.pages.dev' }
};

const PremiumEntitlementService = require('../js/premiumEntitlementService.js');

test('PremiumEntitlementService exports all expected functions and constants', () => {
  assert.equal(typeof PremiumEntitlementService.isPremium, 'function');
  assert.equal(typeof PremiumEntitlementService.getPremiumStatus, 'function');
  assert.equal(typeof PremiumEntitlementService.requirePremium, 'function');
  assert.equal(typeof PremiumEntitlementService.getBackendApiUrl, 'function');
  assert.equal(typeof PremiumEntitlementService.getAiUsageCount, 'function');
  assert.equal(typeof PremiumEntitlementService.getAiUsageLimit, 'function');
  assert.equal(typeof PremiumEntitlementService.canUseOnlineAI, 'function');
  assert.equal(typeof PremiumEntitlementService.mapTransactionToDb, 'function');
  assert.ok(PremiumEntitlementService.PREMIUM_LIMITS);
  assert.equal(typeof PremiumEntitlementService.PREMIUM_PRICE_EUR, 'number');
});

test('isPremium detects userProfile and family entitlements accurately', () => {
  global.state.userProfile = { premium_active: false };
  global.state.familyProfiles = [];
  assert.equal(PremiumEntitlementService.isPremium(), false);

  global.state.userProfile = { premium_active: true };
  assert.equal(PremiumEntitlementService.isPremium(), true);

  global.state.userProfile = { premium_active: false };
  global.state.familyProfiles = [{ id: 'fam-1', premium_active: true }];
  assert.equal(PremiumEntitlementService.isPremium(), true);
});

test('getBackendApiUrl normalizes endpoints for native and web', () => {
  const url = PremiumEntitlementService.getBackendApiUrl('/api/ai');
  assert.ok(url.endsWith('/api/ai'));
});

test('mapTransactionToDb formats transaction safely with valid UUID', () => {
  const t = {
    amount: '42.50',
    type: 'expense',
    category: 'Groceries',
    note: 'Supermarket',
    date: '2026-09-07'
  };
  const dbTx = PremiumEntitlementService.mapTransactionToDb(t);
  assert.equal(dbTx.amount, 42.5);
  assert.equal(dbTx.category, 'Groceries');
  assert.equal(dbTx.type, 'expense');
  assert.ok(dbTx.id);
  assert.equal(dbTx.status, 'active');
});
