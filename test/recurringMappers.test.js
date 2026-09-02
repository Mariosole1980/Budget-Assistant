'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  mapTemplateToDb,
  mapTemplateFromDb,
} = require('../js/recurringMappers.js');

// ── mapTemplateToDb ───────────────────────────────────────────────────────────

test('mapTemplateToDb: null input returns null', () => {
  assert.strictEqual(mapTemplateToDb(null), null);
  assert.strictEqual(mapTemplateToDb(undefined), null);
});

test('mapTemplateToDb: camelCase → snake_case field mapping', () => {
  const js = {
    id: 'abc',
    endType: 'date',
    endDate: '2025-12-31',
    startDate: '2025-01-01',
    startYear: 2025,
    startMonth: 0,
  };
  const db = mapTemplateToDb(js);
  assert.strictEqual(db.end_type, 'date');
  assert.strictEqual(db.end_date, '2025-12-31');
  assert.strictEqual(db.start_date, '2025-01-01');
  assert.strictEqual(db.start_year, 2025);
  // startMonth=0 is falsy → stored as null (matches original app.js behavior)
  assert.strictEqual(db.start_month, null);
  // camelCase keys must NOT appear
  assert.strictEqual(db.endType, undefined);
  assert.strictEqual(db.endDate, undefined);
  assert.strictEqual(db.startDate, undefined);
});

test('mapTemplateToDb: defaults applied for missing fields', () => {
  const db = mapTemplateToDb({ id: '1' });
  assert.strictEqual(db.currency, 'EUR');
  assert.strictEqual(db.preset, 'monthly');
  assert.strictEqual(db.end_type, 'perpetual');
  assert.strictEqual(db.is_shared, false);
  assert.strictEqual(db.amount, 0);
  assert.deepStrictEqual(db.days, []);
  assert.deepStrictEqual(db.months, []);
  assert.deepStrictEqual(db.years, []);
  assert.strictEqual(db.user_id, null);
  assert.strictEqual(db.family_id, null);
});

test('mapTemplateToDb: amount coerced to float', () => {
  assert.strictEqual(mapTemplateToDb({ amount: '42.5' }).amount, 42.5);
  assert.strictEqual(mapTemplateToDb({ amount: null }).amount, 0);
});

test('mapTemplateToDb: arrays passed through only if array', () => {
  const db = mapTemplateToDb({ days: [5, 15], months: [1, 6], years: [2025] });
  assert.deepStrictEqual(db.days, [5, 15]);
  assert.deepStrictEqual(db.months, [1, 6]);
  assert.deepStrictEqual(db.years, [2025]);
  // Non-arrays become []
  const db2 = mapTemplateToDb({ days: 'bad', months: null });
  assert.deepStrictEqual(db2.days, []);
  assert.deepStrictEqual(db2.months, []);
});

// ── mapTemplateFromDb ─────────────────────────────────────────────────────────

test('mapTemplateFromDb: null input returns null', () => {
  assert.strictEqual(mapTemplateFromDb(null), null);
  assert.strictEqual(mapTemplateFromDb(undefined), null);
});

test('mapTemplateFromDb: snake_case → camelCase field mapping', () => {
  const db = {
    id: 'xyz',
    end_type: 'date',
    end_date: '2025-12-31',
    start_date: '2025-01-01',
    start_year: 2025,
    start_month: 0,
  };
  const js = mapTemplateFromDb(db);
  assert.strictEqual(js.endType, 'date');
  assert.strictEqual(js.endDate, '2025-12-31');
  assert.strictEqual(js.startDate, '2025-01-01');
  assert.strictEqual(js.startYear, 2025);
  // start_month=0 is falsy → stored as null (matches original app.js behavior)
  assert.strictEqual(js.startMonth, null);
  // snake_case keys must NOT appear in JS form
  assert.strictEqual(js.end_type, undefined);
  assert.strictEqual(js.end_date, undefined);
  assert.strictEqual(js.start_date, undefined);
});

test('mapTemplateFromDb: defaults applied for missing fields', () => {
  const js = mapTemplateFromDb({ id: '1' });
  assert.strictEqual(js.currency, 'EUR');
  assert.strictEqual(js.preset, 'monthly');
  assert.strictEqual(js.endType, 'perpetual');
  assert.strictEqual(js.is_shared, false);
  assert.strictEqual(js.amount, 0);
  assert.strictEqual(js.subcategory, '');
  assert.strictEqual(js.note, '');
  assert.strictEqual(js.description, '');
  assert.deepStrictEqual(js.days, []);
  assert.deepStrictEqual(js.months, []);
  assert.deepStrictEqual(js.years, []);
});

test('mapTemplateFromDb: round-trip with mapTemplateToDb preserves core fields', () => {
  const original = {
    id: 'round-trip-id',
    amount: 150,
    currency: 'USD',
    type: 'expense',
    category: '🍕 Food',
    preset: 'weekly',
    days: [1, 3, 5],
    months: [1, 2, 3],
    years: [],
    endType: 'date',
    endDate: '2026-06-30',
    startDate: '2025-01-01',
    startYear: 2025,
    startMonth: 0,
  };
  const dbForm = mapTemplateToDb(original);
  const restored = mapTemplateFromDb(dbForm);

  assert.strictEqual(restored.id, original.id);
  assert.strictEqual(restored.amount, original.amount);
  assert.strictEqual(restored.currency, original.currency);
  assert.strictEqual(restored.type, original.type);
  assert.strictEqual(restored.preset, original.preset);
  assert.strictEqual(restored.endType, original.endType);
  assert.strictEqual(restored.endDate, original.endDate);
  assert.strictEqual(restored.startDate, original.startDate);
  assert.deepStrictEqual(restored.days, original.days);
  assert.deepStrictEqual(restored.months, original.months);
});
