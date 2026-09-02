'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  getTransactionTime,
  compareTransactions,
} = require('../js/transactionSorting.js');

// ── getTransactionTime ────────────────────────────────────────────────────────

test('getTransactionTime: returns 0 for null/undefined', () => {
  assert.strictEqual(getTransactionTime(null), 0);
  assert.strictEqual(getTransactionTime(undefined), 0);
  assert.strictEqual(getTransactionTime({}), 0);
});

test('getTransactionTime: returns numeric value directly', () => {
  assert.strictEqual(getTransactionTime({ date: 1234567890 }), 1234567890);
});

test('getTransactionTime: parses ISO 8601 with Z timezone', () => {
  const ms = getTransactionTime({ date: '2025-06-15T10:30:00Z' });
  assert.strictEqual(ms, new Date('2025-06-15T10:30:00Z').getTime());
});

test('getTransactionTime: plain YYYY-MM-DD returns 0 (known hasTZ quirk)', () => {
  // Known behavior preserved from app.js: the hasTZ regex /[Zz]|[+-]\d{2}(?::?\d{2})?$/
  // false-positively matches '-15' (last 3 chars of '2025-06-15') as a TZ offset.
  // As a result no 'Z' is appended, the replace('/([+-]\d{2})$/', '$1:00') transforms
  // '2025-06-15' → '2025-06-15:00', and Date.parse returns NaN → function returns 0.
  // This is the same as the original app.js. Plain dates are always compared via
  // the Level-1 dateA/dateB string comparison in compareTransactions, which works
  // correctly for YYYY-MM-DD strings regardless of this quirk.
  assert.strictEqual(getTransactionTime({ date: '2025-06-15' }), 0);
});

test('getTransactionTime: parses date with space separator (legacy format)', () => {
  const ms = getTransactionTime({ date: '2025-06-15 10:30:00' });
  assert.strictEqual(ms, Date.UTC(2025, 5, 15, 10, 30, 0, 0));
});

test('getTransactionTime: parses timezone offset +02:00', () => {
  const ms = getTransactionTime({ date: '2025-06-15T12:00:00+02:00' });
  // 12:00 +02:00 = 10:00 UTC
  assert.strictEqual(ms, Date.UTC(2025, 5, 15, 10, 0, 0, 0));
});

test('getTransactionTime: uses created_at when date is absent', () => {
  const ms = getTransactionTime({ created_at: '2025-01-01T00:00:00Z' });
  assert.strictEqual(ms, new Date('2025-01-01T00:00:00Z').getTime());
});

test('getTransactionTime: date takes priority over created_at', () => {
  const ms = getTransactionTime({
    date: '2025-06-15T10:00:00Z',
    created_at: '2020-01-01T00:00:00Z',
  });
  assert.strictEqual(ms, new Date('2025-06-15T10:00:00Z').getTime());
});

test('getTransactionTime: handles microsecond precision (truncated to ms)', () => {
  const ms = getTransactionTime({ date: '2025-06-15T10:30:00.123456Z' });
  assert.strictEqual(ms, Date.UTC(2025, 5, 15, 10, 30, 0, 123));
});

// ── compareTransactions ───────────────────────────────────────────────────────

test('compareTransactions: both null → 0', () => {
  assert.strictEqual(compareTransactions(null, null), 0);
});

test('compareTransactions: null a sorts after b', () => {
  assert.strictEqual(compareTransactions(null, { date: '2025-01-01' }), 1);
});

test('compareTransactions: null b sorts before a', () => {
  assert.strictEqual(compareTransactions({ date: '2025-01-01' }, null), -1);
});

test('compareTransactions: later date sorts first (descending)', () => {
  const a = { date: '2025-06-15', id: '1' };
  const b = { date: '2025-01-01', id: '2' };
  assert.ok(compareTransactions(a, b) < 0, 'newer date should sort before older');
  assert.ok(compareTransactions(b, a) > 0, 'older date should sort after newer');
});

test('compareTransactions: same date, later time sorts first', () => {
  const a = { date: '2025-06-15T10:00:00Z', id: '1' };
  const b = { date: '2025-06-15T08:00:00Z', id: '2' };
  assert.ok(compareTransactions(a, b) < 0);
});

test('compareTransactions: same date/time, later created_at sorts first', () => {
  const a = { date: '2025-06-15', id: '1', created_at: '2025-06-15T12:00:00Z' };
  const b = { date: '2025-06-15', id: '2', created_at: '2025-06-15T08:00:00Z' };
  assert.ok(compareTransactions(a, b) < 0);
});

test('compareTransactions: same date/time/created_at, id ascending as tiebreak', () => {
  const a = { date: '2025-06-15', id: 'aaa' };
  const b = { date: '2025-06-15', id: 'zzz' };
  assert.ok(compareTransactions(a, b) < 0, 'id aaa sorts before zzz');
});

test('compareTransactions: identical transactions → 0', () => {
  const tx = { date: '2025-06-15T10:00:00Z', id: 'same', created_at: '2025-06-15T10:00:00Z' };
  assert.strictEqual(compareTransactions(tx, tx), 0);
});

test('compareTransactions: usable as Array.sort callback (descending by date)', () => {
  const txs = [
    { date: '2025-01-01', id: 'c' },
    { date: '2025-06-15', id: 'a' },
    { date: '2025-03-10', id: 'b' },
  ];
  txs.sort(compareTransactions);
  assert.strictEqual(txs[0].id, 'a'); // 2025-06-15 newest
  assert.strictEqual(txs[1].id, 'b'); // 2025-03-10
  assert.strictEqual(txs[2].id, 'c'); // 2025-01-01 oldest
});
