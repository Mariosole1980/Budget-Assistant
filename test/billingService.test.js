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

test('updatePremiumUI sets badge to Ενεργό when isPremium is true', () => {
  global.isPremium = () => true;
  global.state.lang = 'el';
  const badgeMock = { textContent: '', style: {} };
  const subtitleMock = { textContent: '', style: {} };

  global.document.getElementById = (id) => {
    if (id === 'hub-premium-badge') return badgeMock;
    if (id === 'hub-premium-subtitle') return subtitleMock;
    return { id, style: {}, innerHTML: '' };
  };

  BillingService.updatePremiumUI();
  assert.strictEqual(badgeMock.textContent, 'Ενεργό');
  assert.strictEqual(subtitleMock.textContent, 'Όλα τα features ξεκλειδωμένα');
});

test('index.html Pro badge and subtitle do NOT have data-i18n that would overwrite status', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');

  // #hub-premium-badge should not have data-i18n="btn_upgrade_pro"
  const badgeMatch = html.match(/id="hub-premium-badge"[^>]*>/);
  assert.ok(badgeMatch, 'hub-premium-badge must exist in index.html');
  assert.ok(!badgeMatch[0].includes('data-i18n'), 'hub-premium-badge must not have data-i18n attribute');

  // #hub-premium-subtitle should not have data-i18n="settings_premium_desc"
  const subtitleMatch = html.match(/id="hub-premium-subtitle"[^>]*>/);
  assert.ok(subtitleMatch, 'hub-premium-subtitle must exist in index.html');
  assert.ok(!subtitleMatch[0].includes('data-i18n'), 'hub-premium-subtitle must not have data-i18n attribute');
});
