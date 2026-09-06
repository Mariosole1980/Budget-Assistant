const { test } = require('node:test');
const assert = require('node:assert');

// Mock dependencies
const BAUtils = require('../js/utils.js');
global.normalizeString = BAUtils.normalizeString;

global.state = {
  lang: 'el'
};

global.CurrencyService = {
  toBase(t) {
    return parseFloat(t.amount) || 0;
  }
};

global.isTransferTransaction = function (t) {
  return t && (t.type === 'transfer' || !!t.transfer_id);
};

global.formatCurrency = function (val) {
  return Number(val).toFixed(2);
};

const FinancialHealthEngine = require('../js/financialHealthEngine.js');

test('FinancialHealthEngine exports all expected functions', () => {
  assert.strictEqual(typeof FinancialHealthEngine.classifyCategory, 'function');
  assert.strictEqual(typeof FinancialHealthEngine.calculateFinancialHealthScore, 'function');
  assert.strictEqual(typeof FinancialHealthEngine.calculateForecasting, 'function');
});

test('FinancialHealthEngine.classifyCategory distinguishes essential vs lifestyle categories', () => {
  const c1 = FinancialHealthEngine.classifyCategory('Σπίτι / Ενοίκιο');
  assert.strictEqual(c1.isEssential, true);
  assert.strictEqual(c1.isLifestyle, false);

  const c2 = FinancialHealthEngine.classifyCategory('Supermarket & Τρόφιμα');
  assert.strictEqual(c2.isEssential, true);

  const c3 = FinancialHealthEngine.classifyCategory('Διασκέδαση & Bar');
  assert.strictEqual(c3.isEssential, false);
  assert.strictEqual(c3.isLifestyle, true);

  const c4 = FinancialHealthEngine.classifyCategory('Shopping / Ρούχα');
  assert.strictEqual(c4.isEssential, false);
  assert.strictEqual(c4.isLifestyle, true);
});

test('FinancialHealthEngine.calculateFinancialHealthScore handles empty transactions gracefully', () => {
  const res = FinancialHealthEngine.calculateFinancialHealthScore([], [], false);
  assert.strictEqual(res.score, null);
  assert.strictEqual(res.isNoData, true);
  assert.strictEqual(res.displayScore, '--');
});

test('FinancialHealthEngine.calculateFinancialHealthScore calculates score for active finances', () => {
  const now = new Date();
  const year = now.getFullYear();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');

  const transactions = [
    { id: '1', date: `${year}-${monthStr}-01`, type: 'income', amount: 3000, category: 'Μισθός' },
    { id: '2', date: `${year}-${monthStr}-05`, type: 'expense', amount: 800, category: 'Ενοίκιο' },
    { id: '3', date: `${year}-${monthStr}-10`, type: 'expense', amount: 400, category: 'Supermarket' }
  ];

  const res = FinancialHealthEngine.calculateFinancialHealthScore(transactions, [], false);
  assert.ok(res.score >= 70, `Expected score >= 70, got ${res.score}`);
  assert.ok(res.savingsRate > 0.5);
  assert.strictEqual(typeof res.label, 'string');
});

test('FinancialHealthEngine.calculateForecasting computes run-rate projections', () => {
  const now = new Date();
  const year = now.getFullYear();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');

  const transactions = [
    { id: '1', date: `${year}-${monthStr}-01`, type: 'income', amount: 2000 },
    { id: '2', date: `${year}-${monthStr}-05`, type: 'expense', amount: 1000 }
  ];

  const forecast = FinancialHealthEngine.calculateForecasting(transactions, false);
  assert.strictEqual(typeof forecast, 'object');
  assert.ok(forecast.currentYearSavings >= 1000);
  assert.ok(forecast.projectedSavings >= forecast.currentYearSavings);
  assert.ok(forecast.bestCaseSavings >= forecast.projectedSavings);
  assert.ok(forecast.worstCaseSavings <= forecast.projectedSavings);
});
