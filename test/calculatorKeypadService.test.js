const test = require('node:test');
const assert = require('node:assert/strict');

global.state = {
  calcBuffer: '0',
  lang: 'el'
};

const domElements = {};
function createEl(id) {
  return {
    id,
    value: '',
    textContent: '',
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    querySelector: () => createEl('inner')
  };
}

global.document = {
  getElementById(id) {
    if (!domElements[id]) {
      domElements[id] = createEl(id);
    }
    return domElements[id];
  },
  body: { scrollTop: 0 }
};

global.stripThousandsSeparators = (v) => String(v || "");

global.window = {
  state: global.state,
  scrollTo: () => {}
};

// Pull in calcKeypad helpers
const calcKeypad = require('../js/calcKeypad.js');
global.evaluateCalcBuffer = calcKeypad.evaluateCalcBuffer;
global.hasPendingMathOperator = calcKeypad.hasPendingMathOperator;
global.formatCalcDisplay = calcKeypad.formatCalcDisplay;

const CalculatorKeypadService = require('../js/calculatorKeypadService.js');

test('CalculatorKeypadService exports all expected functions', () => {
  assert.equal(typeof CalculatorKeypadService.openCalculatorKeypad, 'function');
  assert.equal(typeof CalculatorKeypadService.closeCalculatorKeypad, 'function');
  assert.equal(typeof CalculatorKeypadService.handleCalculatorKeyPress, 'function');
  assert.equal(typeof CalculatorKeypadService.updateKeypadDoneButton, 'function');
});

test('openCalculatorKeypad activates keypad modal and sets buffer', () => {
  document.getElementById('trans-amount').value = '150.00';
  CalculatorKeypadService.openCalculatorKeypad();
  assert.ok(document.getElementById('custom-calculator-keypad').classList.contains('active'));
  assert.ok(document.getElementById('transaction-modal').classList.contains('keypad-active'));
  assert.equal(global.state.calcBuffer, '150.00');
});

test('handleCalculatorKeyPress appends digits and performs arithmetic', () => {
  global.state.calcBuffer = '0';
  CalculatorKeypadService.handleCalculatorKeyPress('5');
  assert.equal(global.state.calcBuffer, '5');
  CalculatorKeypadService.handleCalculatorKeyPress('+');
  assert.equal(global.state.calcBuffer, '5+');
  CalculatorKeypadService.handleCalculatorKeyPress('3');
  assert.equal(global.state.calcBuffer, '5+3');

  // Check done button mode becomes equals
  const doneBtn = document.getElementById('calc-done-btn');
  assert.equal(doneBtn.getAttribute('data-mode'), 'equals');

  // Pressing done evaluates to 8
  CalculatorKeypadService.handleCalculatorKeyPress('done');
  assert.equal(global.state.calcBuffer, '8');
  assert.equal(document.getElementById('trans-amount').value, '8');
});

test('closeCalculatorKeypad removes active classes', () => {
  CalculatorKeypadService.closeCalculatorKeypad();
  assert.ok(!document.getElementById('custom-calculator-keypad').classList.contains('active'));
  assert.ok(!document.getElementById('transaction-modal').classList.contains('keypad-active'));
});
