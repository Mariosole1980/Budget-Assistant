/**
 * CalculatorKeypadService - In-app Transaction Calculator Keypad Subsystem
 *
 * Handles:
 * - openCalculatorKeypad: Opens keypad, focuses amount row, sets initial buffer
 * - closeCalculatorKeypad: Closes keypad and cleans up active classes
 * - handleCalculatorKeyPress: Handles digit inputs, operators (+, -, *, /),
 *   decimal dots, backspaces, and evaluation on "done"
 * - updateKeypadDoneButton: Updates the Done / = toggle button and live formula
 *
 * UMD pattern: Browser global + Node.js module.exports
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CalculatorKeypadService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _getState() {
    return (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : null)) || {};
  }

  /**
   * Update the Done / = button and live formula display on the keypad
   */
  function updateKeypadDoneButton() {
    if (typeof document === 'undefined') return;
    var appState = _getState();
    var doneBtn = document.getElementById('calc-done-btn');
    var liveFormula = document.getElementById('calc-live-formula');
    var buf = appState.calcBuffer || '';

    var hasPending = typeof hasPendingMathOperator === 'function'
      ? hasPendingMathOperator
      : (typeof window !== 'undefined' && typeof window.hasPendingMathOperator === 'function'
        ? window.hasPendingMathOperator
        : function (b) { return /[-+*/]/.test(String(b || '')); });

    var evalBuf = typeof evaluateCalcBuffer === 'function'
      ? evaluateCalcBuffer
      : (typeof window !== 'undefined' && typeof window.evaluateCalcBuffer === 'function'
        ? window.evaluateCalcBuffer
        : function (b) { return b; });

    var fmtDisplay = typeof formatCalcDisplay === 'function'
      ? formatCalcDisplay
      : (typeof window !== 'undefined' && typeof window.formatCalcDisplay === 'function'
        ? window.formatCalcDisplay
        : function (b) { return b; });

    var isExpression = hasPending(buf);

    if (liveFormula) {
      if (isExpression) {
        var evaluated = evalBuf(buf);
        liveFormula.textContent = '= ' + fmtDisplay(evaluated) + ' €';
        liveFormula.style.display = 'inline';
      } else {
        liveFormula.textContent = '';
        liveFormula.style.display = 'none';
      }
    }

    if (doneBtn) {
      if (isExpression) {
        doneBtn.textContent = '=';
        doneBtn.setAttribute('data-mode', 'equals');
      } else {
        var lang = (typeof localStorage !== 'undefined' && localStorage.getItem('bg_language')) || appState.lang || 'el';
        var label = lang === 'en' ? 'Done' : 'Τέλος';
        doneBtn.textContent = label;
        doneBtn.setAttribute('data-mode', 'done');
      }
    }
  }

  /**
   * Open calculator keypad on amount field focus/click
   */
  function openCalculatorKeypad() {
    if (typeof window !== 'undefined' && window.autocompleteJustSelected) return;
    if (typeof document === 'undefined') return;

    var form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;

    if (typeof ensureHistoryPushed === 'function') {
      ensureHistoryPushed();
    } else if (typeof window !== 'undefined' && typeof window.ensureHistoryPushed === 'function') {
      window.ensureHistoryPushed();
    }

    var keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.add('active');
    }
    var modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.add('keypad-active');
    }
    var amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      var container = amountRow.querySelector('.form-row-value-container');
      if (container) container.classList.add('focused');

      var body = amountRow.closest ? amountRow.closest('.modal-body') : null;
      if (body) {
        setTimeout(function () {
          if (typeof window !== 'undefined') window.scrollTo(0, 0);
          document.body.scrollTop = 0;
          var bodyRect = body.getBoundingClientRect ? body.getBoundingClientRect() : { top: 0, height: 400 };
          var rowRect = amountRow.getBoundingClientRect ? amountRow.getBoundingClientRect() : { top: 0, height: 40 };
          var relativeTop = rowRect.top - bodyRect.top + (body.scrollTop || 0);
          var targetScrollTop = relativeTop - (bodyRect.height / 2) + (rowRect.height / 2);
          if (typeof body.scrollTo === 'function') {
            body.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });
          } else {
            body.scrollTop = targetScrollTop;
          }
        }, 300);
      }
    }

    var appState = _getState();
    var amtEl = document.getElementById('trans-amount');
    var rawAmt = amtEl ? amtEl.value : '';
    var stripFn = typeof stripThousandsSeparators === 'function'
      ? stripThousandsSeparators
      : (typeof FormatUtils !== 'undefined' && typeof FormatUtils.stripThousandsSeparators === 'function'
        ? FormatUtils.stripThousandsSeparators
        : function (v) { return String(v).replace(/./g, ''); });

    appState.calcBuffer = stripFn(rawAmt).replace(/,/g, '.') || '';
    updateKeypadDoneButton();
  }

  /**
   * Close custom calculator keypad
   */
  function closeCalculatorKeypad() {
    if (typeof document === 'undefined') return;
    var keypad = document.getElementById('custom-calculator-keypad');
    if (keypad) {
      keypad.classList.remove('active');
    }
    var modal = document.getElementById('transaction-modal');
    if (modal) {
      modal.classList.remove('keypad-active');
    }
    var amountRow = document.getElementById('form-row-amount');
    if (amountRow) {
      var container = amountRow.querySelector('.form-row-value-container');
      if (container) container.classList.remove('focused');
    }
  }

  /**
   * Handle calculator keypad press event
   */
  function handleCalculatorKeyPress(val) {
    if (typeof triggerHaptic === 'function') {
      triggerHaptic(val === 'done' ? 'medium' : 'light');
    } else if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
      window.triggerHaptic(val === 'done' ? 'medium' : 'light');
    }
    var appState = _getState();
    var buf = appState.calcBuffer || '0';

    var hasPending = typeof hasPendingMathOperator === 'function'
      ? hasPendingMathOperator
      : (typeof window !== 'undefined' && typeof window.hasPendingMathOperator === 'function'
        ? window.hasPendingMathOperator
        : function (b) { return /[-+*/]/.test(String(b || '')); });

    var evalBuf = typeof evaluateCalcBuffer === 'function'
      ? evaluateCalcBuffer
      : (typeof window !== 'undefined' && typeof window.evaluateCalcBuffer === 'function'
        ? window.evaluateCalcBuffer
        : function (b) { return b; });

    var fmtDisplay = typeof formatCalcDisplay === 'function'
      ? formatCalcDisplay
      : (typeof window !== 'undefined' && typeof window.formatCalcDisplay === 'function'
        ? window.formatCalcDisplay
        : function (b) { return b; });

    var updateAmtSym = typeof updateAmountCurrencySymbol === 'function'
      ? updateAmountCurrencySymbol
      : (typeof window !== 'undefined' && typeof window.updateAmountCurrencySymbol === 'function'
        ? window.updateAmountCurrencySymbol
        : function () {});

    if (val === 'done') {
      var isExpression = hasPending(buf);
      if (isExpression) {
        buf = evalBuf(buf);
        appState.calcBuffer = buf;
        var amtEl1 = typeof document !== 'undefined' ? document.getElementById('trans-amount') : null;
        if (amtEl1) amtEl1.value = fmtDisplay(buf);
        updateAmtSym();
        updateKeypadDoneButton();
        return;
      } else {
        buf = evalBuf(buf);
        var amtEl2 = typeof document !== 'undefined' ? document.getElementById('trans-amount') : null;
        if (amtEl2) amtEl2.value = fmtDisplay(buf);
        appState.calcBuffer = buf;
        updateAmtSym();
        closeCalculatorKeypad();
        return;
      }
    }

    if (val === 'backspace') {
      if (buf.length > 0) {
        buf = buf.slice(0, -1);
      }
      if (buf === '') buf = '0';
    } else if (val === '+' || val === '-') {
      if (buf.length > 0 && ['-', '+', '*', '/'].indexOf(buf.slice(-1)) === -1) {
        buf += val;
      }
    } else if (val === 'calc') {
      buf = evalBuf(buf);
    } else if (val === '.') {
      var lastNumPart = buf.split(/[-+*/]/).pop();
      if (lastNumPart.indexOf('.') === -1) {
        buf += '.';
      }
    } else {
      if (buf === '0' && val !== '00') {
        buf = val;
      } else {
        buf += val;
      }
    }

    appState.calcBuffer = buf;
    var amtEl = typeof document !== 'undefined' ? document.getElementById('trans-amount') : null;
    if (amtEl) amtEl.value = fmtDisplay(buf);
    updateAmtSym();
    updateKeypadDoneButton();
  }

  var service = {
    openCalculatorKeypad: openCalculatorKeypad,
    closeCalculatorKeypad: closeCalculatorKeypad,
    handleCalculatorKeyPress: handleCalculatorKeyPress,
    updateKeypadDoneButton: updateKeypadDoneButton
  };

  if (typeof window !== 'undefined') {
    window.CalculatorKeypadService = service;
    window.openCalculatorKeypad = openCalculatorKeypad;
    window.closeCalculatorKeypad = closeCalculatorKeypad;
    window.handleCalculatorKeyPress = handleCalculatorKeyPress;
    window.updateKeypadDoneButton = updateKeypadDoneButton;
  }

  return service;
}));
