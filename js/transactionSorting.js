/**
 * transactionSorting.js
 *
 * Pure transaction date-parsing and sort-order functions.
 * Extracted from app.js (Phase 2, Extraction 3).
 *
 * Zero dependencies — no state, no DOM, no Supabase, no globals.
 * Uses only built-in Date, Date.UTC, Date.parse.
 *
 * UMD wrapper (same proven pattern as js/calcKeypad.js, js/recurringMappers.js):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.getTransactionTime, window.compareTransactions
 *              (compareTransactions must be global — used as .sort() callback)
 *
 * IMPORTANT: compareTransactions is used as a bare sort comparator throughout
 * app.js: array.sort(compareTransactions). It MUST remain accessible as
 * window.compareTransactions in the browser, which this UMD wrapper guarantees.
 *
 * Loaded BEFORE app.js via <script src="js/transactionSorting.js"> in index.html.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: expose as named globals so all .sort(compareTransactions) call
    // sites in app.js continue to work without any changes.
    var exports = factory();
    root.getTransactionTime  = exports.getTransactionTime;
    root.compareTransactions = exports.compareTransactions;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Returns the UTC epoch milliseconds for a transaction's effective timestamp.
   *
   * Priority: t.date > t.created_at
   *
   * Handles:
   *  - Plain YYYY-MM-DD (treated as UTC midnight — no local-time shift)
   *  - ISO 8601 with T separator
   *  - Legacy space-separated datetimes (2025-06-15 10:30:00)
   *  - Timezone offsets (Z, +HH:MM, -HH:MM, +HHMM)
   *  - Microsecond precision (truncated to ms)
   *  - Safari date-parsing quirks (manual regex fallback)
   *
   * @param {Object|null} t  Transaction-like object with optional date / created_at
   * @returns {number}       UTC epoch milliseconds, or 0 if unparseable
   */
  function getTransactionTime(t) {
    if (!t) return 0;
    // Prioritize user's explicitly chosen date and time (t.date) over system created_at timestamp
    const ref = t.date || t.created_at;
    if (!ref) return 0;
    if (typeof ref === 'number') return ref;
    if (ref instanceof Date) return ref.getTime();

    let str = String(ref).trim()
      .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T') // Normalize space separator
      .replace(/\s+([+-])/, '$1') // Remove spaces before timezone offset
      .replace(/\s+([Zz])/, '$1'); // Remove spaces before Z/z offset

    if (!str) return 0;

    // Check if it has any valid timezone offset (Z, z, +HH:MM, -HH:MM, +HHMM, -HHMM, +HH, -HH)
    const hasTZ = /[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(str);

    // Force UTC parsing by appending Z if no timezone is present
    if (!hasTZ) {
      str += 'Z';
    } else if (str.endsWith('z')) {
      str = str.slice(0, -1) + 'Z';
    }

    // Normalize timezone offsets to +HH:MM / -HH:MM format
    str = str.replace(/([+-]\d{2})$/, '$1:00');
    str = str.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

    // Robust regex-based manual parsing fallback for Safari compatibility and microsecond handling
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/);
    if (match) {
      const year   = parseInt(match[1], 10);
      const month  = parseInt(match[2], 10) - 1;
      const day    = parseInt(match[3], 10);
      const hour   = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      const second = match[6] ? parseInt(match[6], 10) : 0;

      let ms = 0;
      if (match[7]) {
        const msStr = match[7].substring(0, 3).padEnd(3, '0');
        ms = parseInt(msStr, 10);
      }

      const tzStr = match[8];
      let utcMs = Date.UTC(year, month, day, hour, minute, second, ms);

      if (tzStr !== 'Z') {
        const tzSign    = tzStr.charAt(0) === '+' ? 1 : -1;
        const tzHours   = parseInt(tzStr.substring(1, 3), 10);
        const tzMinutes = parseInt(tzStr.substring(4, 6), 10);
        const offsetMs  = (tzHours * 60 + tzMinutes) * 60 * 1000;
        utcMs -= tzSign * offsetMs;
      }
      return utcMs;
    }

    // Fallback to standard Date.parse if regex doesn't match
    const fallback = Date.parse(str);
    return isNaN(fallback) ? 0 : fallback;
  }

  /**
   * Comparator for Array.prototype.sort — sorts transactions in descending
   * chronological order (most recent first) using a 4-level tiebreaker:
   *
   *  1. date string (YYYY-MM-DD) descending
   *  2. full timestamp (t.date) descending
   *  3. created_at descending
   *  4. id ascending (final stable tiebreaker)
   *
   * Used directly as a sort callback: array.sort(compareTransactions)
   *
   * @param {Object|null} a
   * @param {Object|null} b
   * @returns {number}  negative if a sorts before b, positive if b sorts first
   */
  function compareTransactions(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    // Level 1: date descending (YYYY-MM-DD)
    const dateA = String(a.date || '').split('T')[0].split(' ')[0];
    const dateB = String(b.date || '').split('T')[0].split(' ')[0];
    if (dateA !== dateB) {
      return dateA < dateB ? 1 : -1;
    }

    // Level 2: User-selected transaction time descending (t.date timestamp ms)
    const timeA = getTransactionTime(a);
    const timeB = getTransactionTime(b);
    if (timeA !== timeB) {
      return timeB - timeA;
    }

    // Level 3: created_at timestamp descending (UTC epoch ms as tie-breaker)
    const createdA = a.created_at ? getTransactionTime({ date: a.created_at }) : 0;
    const createdB = b.created_at ? getTransactionTime({ date: b.created_at }) : 0;
    if (createdA !== createdB) {
      return createdB - createdA;
    }

    // Level 4: id ascending (unique fallback)
    const idA = String(a.id || '');
    const idB = String(b.id || '');
    if (idA !== idB) {
      return idA < idB ? -1 : 1;
    }

    return 0;
  }

  return {
    getTransactionTime:  getTransactionTime,
    compareTransactions: compareTransactions,
  };
});
