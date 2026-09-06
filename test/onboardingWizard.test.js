const test = require('node:test');
const assert = require('node:assert/strict');

// Global storage mock
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k]; }
};

global.window = global;
global.document = {
  getElementById: () => ({ style: {}, classList: { add: () => {}, remove: () => {} }, innerHTML: '', value: '' }),
  querySelector: () => null,
  querySelectorAll: () => []
};

// Import onboardingWizard in CommonJS Node environment
const onboardingWizard = require('../js/onboardingWizard.js');

test('onboardingWizard Module Tests', async (t) => {

  await t.test('1. exports all expected functions and draft objects', () => {
    const expectedFns = [
      'getQuickStartProfile',
      'openQuickStartModal',
      'closeQuickStartModal',
      'setQsIncomeChip',
      'onQsIncomeInputChange',
      'nextQsStepFromIncome',
      'updateQsFixedTotal',
      'nextQsStepFromFixed',
      'renderQuickStartStep',
      'applyQuickStartProfile',
      'hasDemoData',
      'updateHeaderDemoBadge',
      'handleHeaderDemoClick',
      'onboardingAddDemoData',
      'onboardingCreateTransaction',
      'onboardingShowGuide',
      'onboardingClearDemoData',
      'onSubscreenShow_sync'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof onboardingWizard[fn], 'function', `Expected ${fn} to be a function`);
    });

    assert.ok(onboardingWizard._qsDraft, 'Draft profile object exists');
    assert.strictEqual(typeof onboardingWizard._qsDraft.monthly_income, 'number');
  });

  await t.test('2. getQuickStartProfile loads and parses stored profiles', () => {
    localStorage.clear();
    assert.strictEqual(onboardingWizard.getQuickStartProfile(), null);

    const sampleProfile = {
      monthly_income: 1800,
      is_household: false,
      target_savings: 300
    };
    localStorage.setItem('ba_quick_start_profile', JSON.stringify(sampleProfile));

    const loaded = onboardingWizard.getQuickStartProfile();
    assert.ok(loaded);
    assert.strictEqual(loaded.monthly_income, 1800);
    assert.strictEqual(loaded.target_savings, 300);
  });

  await t.test('3. hasDemoData correctly distinguishes real from sample/demo data', () => {
    global.state = {
      transactions: [],
      budgets: []
    };

    assert.strictEqual(onboardingWizard.hasDemoData(), false);

    // Add regular transaction
    global.state.transactions = [{ id: 'tx-100', amount: 50, is_demo: false }];
    assert.strictEqual(onboardingWizard.hasDemoData(), false);

    // Add demo transaction
    global.state.transactions = [{ id: 'demo_123', amount: 50 }];
    assert.strictEqual(onboardingWizard.hasDemoData(), true);

    // Add is_demo flag
    global.state.transactions = [{ id: 'tx-200', is_demo: true }];
    assert.strictEqual(onboardingWizard.hasDemoData(), true);

    // Clear tx and add demo budget
    global.state.transactions = [{ id: 'tx-100' }];
    global.state.budgets = [{ id: 'demo_budget_1' }];
    assert.strictEqual(onboardingWizard.hasDemoData(), true);
  });

  await t.test('4. setQsIncomeChip updates draft income', () => {
    onboardingWizard.setQsIncomeChip(2400);
    assert.strictEqual(onboardingWizard._qsDraft.monthly_income, 2400);
  });

});
