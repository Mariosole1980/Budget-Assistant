'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  evaluateCalcBuffer,
  hasPendingMathOperator,
  formatCalcDisplay,
} = require('../js/calcKeypad.js');

// ---------------------------------------------------------------------------
// evaluateCalcBuffer
// ---------------------------------------------------------------------------
test('evaluateCalcBuffer: addition', () => {
  assert.strictEqual(evaluateCalcBuffer('5+3'), '8');
});

test('evaluateCalcBuffer: subtraction', () => {
  assert.strictEqual(evaluateCalcBuffer('10-3.5'), '6.5');
});

test('evaluateCalcBuffer: multiplication', () => {
  assert.strictEqual(evaluateCalcBuffer('2*3'), '6');
});

test('evaluateCalcBuffer: division', () => {
  assert.strictEqual(evaluateCalcBuffer('10/4'), '2.5');
});

test('evaluateCalcBuffer: strips trailing operator', () => {
  assert.strictEqual(evaluateCalcBuffer('5+'), '5');
  assert.strictEqual(evaluateCalcBuffer('10*'), '10');
});

test('evaluateCalcBuffer: empty/null returns 0', () => {
  assert.strictEqual(evaluateCalcBuffer(''), '0');
  assert.strictEqual(evaluateCalcBuffer(null), '0');
  assert.strictEqual(evaluateCalcBuffer(undefined), '0');
});

test('evaluateCalcBuffer: plain number returns itself (rounded)', () => {
  assert.strictEqual(evaluateCalcBuffer('42'), '42');
  assert.strictEqual(evaluateCalcBuffer('3.14159'), '3.14');
});

test('evaluateCalcBuffer: chained operations left-to-right', () => {
  assert.strictEqual(evaluateCalcBuffer('2+3+5'), '10');
});

test('evaluateCalcBuffer: division by zero returns numerator unchanged', () => {
  assert.strictEqual(evaluateCalcBuffer('10/0'), '10');
});

// ---------------------------------------------------------------------------
// hasPendingMathOperator
// ---------------------------------------------------------------------------
test('hasPendingMathOperator: returns true when operator present', () => {
  assert.strictEqual(hasPendingMathOperator('5+3'), true);
  assert.strictEqual(hasPendingMathOperator('10*2'), true);
  assert.strictEqual(hasPendingMathOperator('5-'), true);
  assert.strictEqual(hasPendingMathOperator('100/4'), true);
});

test('hasPendingMathOperator: returns false for plain number', () => {
  assert.strictEqual(hasPendingMathOperator('500'), false);
  assert.strictEqual(hasPendingMathOperator('3.14'), false);
});

test('hasPendingMathOperator: returns false for empty/null', () => {
  assert.strictEqual(hasPendingMathOperator(''), false);
  assert.strictEqual(hasPendingMathOperator(null), false);
  assert.strictEqual(hasPendingMathOperator(undefined), false);
});

// ---------------------------------------------------------------------------
// formatCalcDisplay
// ---------------------------------------------------------------------------
test('formatCalcDisplay: adds Greek-style thousands separator', () => {
  assert.strictEqual(formatCalcDisplay('5000'), '5.000');
  assert.strictEqual(formatCalcDisplay('1234567'), '1.234.567');
});

test('formatCalcDisplay: preserves decimal part', () => {
  assert.strictEqual(formatCalcDisplay('1234.56'), '1.234.56');
  assert.strictEqual(formatCalcDisplay('5000.5'), '5.000.5');
});

test('formatCalcDisplay: short numbers unchanged', () => {
  assert.strictEqual(formatCalcDisplay('42'), '42');
  assert.strictEqual(formatCalcDisplay('999'), '999');
});

test('formatCalcDisplay: expressions passed through as-is', () => {
  assert.strictEqual(formatCalcDisplay('5+3'), '5+3');
  assert.strictEqual(formatCalcDisplay('10/2'), '10/2');
});

test('formatCalcDisplay: null/empty returns input unchanged', () => {
  assert.strictEqual(formatCalcDisplay(''), '');
  assert.strictEqual(formatCalcDisplay(null), null);
});
