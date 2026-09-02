'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  getDeletedDatesFromTemplate,
  addDeletedDateToTemplate,
  _computeRecurringSeriesDates,
} = require('../js/recurringDates.js');

// ── getDeletedDatesFromTemplate ───────────────────────────────────────────────

test('getDeletedDatesFromTemplate: null/undefined → empty array', () => {
  assert.deepStrictEqual(getDeletedDatesFromTemplate(null), []);
  assert.deepStrictEqual(getDeletedDatesFromTemplate(undefined), []);
});

test('getDeletedDatesFromTemplate: template with no description → empty array', () => {
  assert.deepStrictEqual(getDeletedDatesFromTemplate({}), []);
  assert.deepStrictEqual(getDeletedDatesFromTemplate({ description: '' }), []);
});

test('getDeletedDatesFromTemplate: extracts single deleted date', () => {
  const t = { description: 'Monthly rent ||deleted_dates:2025-06-15' };
  assert.deepStrictEqual(getDeletedDatesFromTemplate(t), ['2025-06-15']);
});

test('getDeletedDatesFromTemplate: extracts multiple deleted dates', () => {
  const t = { description: 'Bills ||deleted_dates:2025-01-15,2025-02-15,2025-03-15' };
  assert.deepStrictEqual(getDeletedDatesFromTemplate(t), ['2025-01-15', '2025-02-15', '2025-03-15']);
});

test('getDeletedDatesFromTemplate: no deleted_dates marker → empty array', () => {
  const t = { description: 'Normal description with no marker' };
  assert.deepStrictEqual(getDeletedDatesFromTemplate(t), []);
});

// ── addDeletedDateToTemplate ──────────────────────────────────────────────────

test('addDeletedDateToTemplate: adds date to template with no prior deleted dates', () => {
  const t = { description: 'Rent' };
  addDeletedDateToTemplate(t, '2025-06-15');
  assert.ok(t.description.includes('||deleted_dates:2025-06-15'));
  assert.deepStrictEqual(getDeletedDatesFromTemplate(t), ['2025-06-15']);
});

test('addDeletedDateToTemplate: appends to existing deleted dates', () => {
  const t = { description: 'Rent ||deleted_dates:2025-06-15' };
  addDeletedDateToTemplate(t, '2025-07-15');
  const dates = getDeletedDatesFromTemplate(t);
  assert.ok(dates.includes('2025-06-15'));
  assert.ok(dates.includes('2025-07-15'));
  assert.strictEqual(dates.length, 2);
});

test('addDeletedDateToTemplate: does not duplicate existing date', () => {
  const t = { description: 'Rent ||deleted_dates:2025-06-15' };
  addDeletedDateToTemplate(t, '2025-06-15');
  const dates = getDeletedDatesFromTemplate(t);
  assert.strictEqual(dates.filter(d => d === '2025-06-15').length, 1);
});

test('addDeletedDateToTemplate: null template does not throw', () => {
  assert.doesNotThrow(() => addDeletedDateToTemplate(null, '2025-06-15'));
});

test('addDeletedDateToTemplate: preserves rest of description', () => {
  const t = { description: 'My monthly bill' };
  addDeletedDateToTemplate(t, '2025-01-01');
  assert.ok(t.description.startsWith('My monthly bill'));
});

// ── _computeRecurringSeriesDates ──────────────────────────────────────────────

test('_computeRecurringSeriesDates: null → empty array', () => {
  assert.deepStrictEqual(_computeRecurringSeriesDates(null), []);
});

test('_computeRecurringSeriesDates: monthly preset generates correct dates', () => {
  const t = {
    preset: 'monthly',
    startDate: '2025-01-15',
    endDate: '2025-04-15',
    endType: 'date',
    description: '',
  };
  const dates = _computeRecurringSeriesDates(t);
  assert.ok(dates.includes('2025-01-15'));
  assert.ok(dates.includes('2025-02-15'));
  assert.ok(dates.includes('2025-03-15'));
  assert.ok(dates.includes('2025-04-15'));
  // Should not include months after endDate
  assert.ok(!dates.includes('2025-05-15'));
});

test('_computeRecurringSeriesDates: yearly preset generates only matching month', () => {
  const t = {
    preset: 'yearly',
    startDate: '2025-06-15',
    endDate: '2027-06-15',
    description: '',
  };
  const dates = _computeRecurringSeriesDates(t);
  // Should only have June dates
  dates.forEach(d => {
    assert.match(d, /^\d{4}-06-15$/);
  });
  assert.ok(dates.includes('2025-06-15'));
});

test('_computeRecurringSeriesDates: skips deleted dates', () => {
  const t = {
    preset: 'monthly',
    startDate: '2025-01-15',
    endDate: '2025-04-15',
    description: 'Rent ||deleted_dates:2025-02-15,2025-03-15',
  };
  const dates = _computeRecurringSeriesDates(t);
  assert.ok(dates.includes('2025-01-15'));
  assert.ok(!dates.includes('2025-02-15')); // deleted
  assert.ok(!dates.includes('2025-03-15')); // deleted
  assert.ok(dates.includes('2025-04-15'));
});

test('_computeRecurringSeriesDates: perpetual (no endDate)', () => {
  const t = { preset: 'monthly', startDate: '2020-01-15', description: '' };
  const dates = _computeRecurringSeriesDates(t);

  assert.ok(dates.length > 0, 'should generate at least some dates');
  assert.ok(dates.length <= 240, 'should not exceed hard cap of 240 (' + dates.length + ' dates)');

  const today = new Date();
  const lastAllowedMonth = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  const beyondContract = dates.filter(d => {
    const dObj = new Date(d);
    return new Date(dObj.getFullYear(), dObj.getMonth(), 1) > lastAllowedMonth;
  });
  assert.deepStrictEqual(beyondContract, [], 'no dates should be in month +13 or later');
});

test('_computeRecurringSeriesDates: invalid startDate → empty array', () => {
  const t = { preset: 'monthly', startDate: 'not-a-date', description: '' };
  assert.deepStrictEqual(_computeRecurringSeriesDates(t), []);
});

test('_computeRecurringSeriesDates: custom preset uses months and days arrays', () => {
  const t = {
    preset: 'custom',
    startDate: '2025-01-01',
    endDate: '2025-06-30',
    months: [1, 3, 5], // Jan, Mar, May
    days: [15],
    description: '',
  };
  const dates = _computeRecurringSeriesDates(t);
  assert.ok(dates.includes('2025-01-15'));
  assert.ok(dates.includes('2025-03-15'));
  assert.ok(dates.includes('2025-05-15'));
  assert.ok(!dates.includes('2025-02-15')); // month 2 not in months[]
  assert.ok(!dates.includes('2025-04-15')); // month 4 not in months[]
});
