'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// normalizeImportDate calls formatISODateLocal from js/utils.js.
// Set it on global before requiring importParsers so the module can find it.
const BAUtils = require('../js/utils.js');
global.formatISODateLocal = BAUtils.formatISODateLocal;

const {
  parseCSV,
  normalizeImportDate,
  normalizeImportAmount,
  resolveImportType,
} = require('../js/importParsers.js');

// ── parseCSV ──────────────────────────────────────────────────────────────────

test('parseCSV: simple rows no quotes', () => {
  const rows = parseCSV('a,b,c\n1,2,3');
  assert.deepStrictEqual(rows, [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('parseCSV: quoted field with comma inside', () => {
  const rows = parseCSV('"hello, world",2\n3,4');
  assert.strictEqual(rows[0][0], 'hello, world');
  assert.strictEqual(rows[0][1], '2');
});

test('parseCSV: escaped double-quote inside quoted field', () => {
  const rows = parseCSV('"say ""hi""",ok');
  assert.strictEqual(rows[0][0], 'say "hi"');
});

test('parseCSV: CRLF line endings', () => {
  const rows = parseCSV('a,b\r\n1,2\r\n3,4');
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows[1], ['1', '2']);
});

test('parseCSV: ignores blank lines', () => {
  const rows = parseCSV('a,b\n\n1,2');
  assert.strictEqual(rows.length, 2);
});

test('parseCSV: single field no newline', () => {
  const rows = parseCSV('hello');
  assert.deepStrictEqual(rows, [['hello']]);
});

test('parseCSV: empty string returns empty array', () => {
  const rows = parseCSV('');
  assert.deepStrictEqual(rows, []);
});

// ── normalizeImportDate ───────────────────────────────────────────────────────

test('normalizeImportDate: null/empty returns empty string', () => {
  assert.strictEqual(normalizeImportDate(null), '');
  assert.strictEqual(normalizeImportDate(''), '');
  assert.strictEqual(normalizeImportDate(undefined), '');
});

test('normalizeImportDate: DD-MM-YYYY → YYYY-MM-DD', () => {
  assert.strictEqual(normalizeImportDate('15-06-2025'), '2025-06-15');
  assert.strictEqual(normalizeImportDate('1-1-2025'), '2025-01-01');
});

test('normalizeImportDate: DD/MM/YYYY → YYYY-MM-DD', () => {
  assert.strictEqual(normalizeImportDate('15/06/2025'), '2025-06-15');
});

test('normalizeImportDate: DD.MM.YYYY → YYYY-MM-DD', () => {
  assert.strictEqual(normalizeImportDate('15.06.2025'), '2025-06-15');
});

test('normalizeImportDate: YYYY-MM-DD passthrough', () => {
  assert.strictEqual(normalizeImportDate('2025-06-15'), '2025-06-15');
});

test('normalizeImportDate: Excel serial date number', () => {
  // Excel serial 45458 = 2024-06-15 (roughly)
  const result = normalizeImportDate('45458');
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

// ── normalizeImportAmount ─────────────────────────────────────────────────────

test('normalizeImportAmount: null/empty returns 0', () => {
  assert.strictEqual(normalizeImportAmount(null), 0);
  assert.strictEqual(normalizeImportAmount(''), 0);
  assert.strictEqual(normalizeImportAmount(undefined), 0);
});

test('normalizeImportAmount: numeric value passthrough', () => {
  assert.strictEqual(normalizeImportAmount(42.5), 42.5);
  assert.strictEqual(normalizeImportAmount(0), 0);
});

test('normalizeImportAmount: strips € and spaces', () => {
  assert.strictEqual(normalizeImportAmount('€ 1234'), 1234);
  assert.strictEqual(normalizeImportAmount('$ 99.99'), 99.99);
});

test('normalizeImportAmount: European format 1.234,56 → 1234.56', () => {
  assert.strictEqual(normalizeImportAmount('1.234,56'), 1234.56);
});

test('normalizeImportAmount: US format 1,234.56 → 1234.56', () => {
  assert.strictEqual(normalizeImportAmount('1,234.56'), 1234.56);
});

test('normalizeImportAmount: comma as decimal separator → float', () => {
  assert.strictEqual(normalizeImportAmount('42,5'), 42.5);
});

test('normalizeImportAmount: non-numeric string returns 0', () => {
  assert.strictEqual(normalizeImportAmount('abc'), 0);
});

// ── resolveImportType ─────────────────────────────────────────────────────────

test('resolveImportType: detects income from type column', () => {
  const row = ['income', '100'];
  const map = { type: 0, amount: 1, inflow: null, outflow: null };
  assert.strictEqual(resolveImportType(row, map), 'income');
});

test('resolveImportType: detects expense from type column', () => {
  const row = ['expense', '50'];
  const map = { type: 0, inflow: null, outflow: null };
  assert.strictEqual(resolveImportType(row, map), 'expense');
});

test('resolveImportType: detects transfer from type column', () => {
  const row = ['transfer', '200'];
  const map = { type: 0, inflow: null, outflow: null };
  assert.strictEqual(resolveImportType(row, map), 'transfer');
});

test('resolveImportType: Greek income keyword (εισόδ)', () => {
  const row = ['εισόδημα'];
  const map = { type: 0, inflow: null, outflow: null };
  assert.strictEqual(resolveImportType(row, map), 'income');
});

test('resolveImportType: falls back to inflow/outflow columns', () => {
  const row = ['', '100', '0'];
  const map = { type: null, inflow: 1, outflow: 2 };
  assert.strictEqual(resolveImportType(row, map), 'income');
});

test('resolveImportType: outflow > 0 → expense', () => {
  const row = ['', '0', '50'];
  const map = { type: null, inflow: 1, outflow: 2 };
  assert.strictEqual(resolveImportType(row, map), 'expense');
});

test('resolveImportType: defaults to expense when ambiguous', () => {
  const row = ['', '0', '0'];
  const map = { type: null, inflow: 1, outflow: 2 };
  assert.strictEqual(resolveImportType(row, map), 'expense');
});
