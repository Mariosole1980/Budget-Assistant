/**
 * calcKeypad.js
 *
 * Pure calculator buffer evaluation and display formatting.
 * Extracted from app.js (Phase 2, Extraction 1).
 *
 * Zero dependencies — no state, no DOM, no Supabase, no globals.
 *
 * UMD wrapper (same proven pattern as js/utils.js, js/transactionMerge.js):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.evaluateCalcBuffer, window.hasPendingMathOperator,
 *              window.formatCalcDisplay (used by app.js handlers)
 *
 * Loaded BEFORE app.js via <script src=js/calcKeypad.js> in index.html.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS (used by node:test)
    module.exports = factory();
  } else {
    // Browser: expose each function as a named global so app.js can call them
    // without any changes to its call sites.
    var exports = factory();
    root.evaluateCalcBuffer    = exports.evaluateCalcBuffer;
    root.hasPendingMathOperator = exports.hasPendingMathOperator;
    root.formatCalcDisplay     = exports.formatCalcDisplay;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Evaluates a raw calculator buffer string containing digits and operators.
   * Strips trailing operators before evaluating. Uses left-to-right evaluation
   * (no operator precedence — matches the in-app keypad UX).
   *
   * @param {string|null} buf  e.g. '5+3', '10/4', '100*'
   * @returns {string}         e.g. '8', '2.5', '100' (rounded to 2 decimals)
   */
  function evaluateCalcBuffer(buf) {
    if (!buf) return '0';
    let cleanBuf = String(buf).trim();
    while (cleanBuf.length > 0 && ['-', '+', '*', '/'].includes(cleanBuf.slice(-1))) {
      cleanBuf = cleanBuf.slice(0, -1);
    }
    if (!cleanBuf) return '0';
    try {
      const tokens = cleanBuf.match(/(\d+\.?\d*|[-+*/])/g);
      if (!tokens || tokens.length === 0) return '0';

      let total = parseFloat(tokens[0]) || 0;
      let currentOp = '+';

      for (let i = 1; i < tokens.length; i++) {
        const tok = tokens[i];
        if (['+', '-', '*', '/'].includes(tok)) {
          currentOp = tok;
        } else {
          const num = parseFloat(tok) || 0;
          if (currentOp === '+') total += num;
          else if (currentOp === '-') total -= num;
          else if (currentOp === '*') total *= num;
          else if (currentOp === '/') total = num !== 0 ? total / num : total;
        }
      }
      return String(Math.round(total * 100) / 100);
    } catch (e) {
      console.error('Calculation error:', e);
      return cleanBuf;
    }
  }

  /**
   * Returns true if the buffer contains a pending math operator (+, -, *, /).
   * Used to decide whether the Done button should show '=' or 'Τέλος'.
   *
   * @param {string|null} buf
   * @returns {boolean}
   */
  function hasPendingMathOperator(buf) {
    if (!buf) return false;
    return /[-+*/]/.test(String(buf));
  }

  /**
   * Formats a raw numeric buffer for display with Greek-style thousands
   * separators ('.'). Only plain numeric buffers (digits + optional decimal dot)
   * are formatted; expressions containing operators are returned as-is.
   *
   * @param {string|null} buf  e.g. '5000', '1234.56', '5+3'
   * @returns {string}         e.g. '5.000', '1.234.56', '5+3'
   */
  function formatCalcDisplay(buf) {
    if (!buf) return buf;
    const s = String(buf);
    if (!/^\d*\.?\d*$/.test(s)) return s;
    const dotIdx = s.indexOf('.');
    let intPart = dotIdx === -1 ? s : s.slice(0, dotIdx);
    const decPart = dotIdx === -1 ? '' : s.slice(dotIdx);
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return intPart + decPart;
  }

  return {
    evaluateCalcBuffer: evaluateCalcBuffer,
    hasPendingMathOperator: hasPendingMathOperator,
    formatCalcDisplay: formatCalcDisplay,
  };
});
