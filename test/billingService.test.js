const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  getElementById(id) {
    return {
      id,
      innerHTML: '',
      style: {},
      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} }
    };
  },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
global.state = {
  lang: 'el',
  currentUser: null
};
global.isPremium = () => false;
global.openModal = () => {};

const BillingService = require('../js/billingService.js');

test('BillingService exports expected functions', () => {
  assert.strictEqual(typeof BillingService.openPremiumModal, 'function');
  assert.strictEqual(typeof BillingService.updatePremiumUI, 'function');
  assert.strictEqual(typeof BillingService.startPremiumPurchase, 'function');
  assert.strictEqual(typeof BillingService.startGooglePayPurchase, 'function');
  assert.strictEqual(typeof BillingService.restorePremiumPurchase, 'function');
});

test('openPremiumModal and updatePremiumUI execute safely without throwing', () => {
  assert.doesNotThrow(() => {
    BillingService.updatePremiumUI();
    BillingService.openPremiumModal();
  });
});
