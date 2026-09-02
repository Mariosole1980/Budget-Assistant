/**
 * importParsers.js
 *
 * Pure data parsers for the CSV/Excel import wizard.
 * Extracted from app.js (Phase 2, Extraction 4).
 *
 * Handles raw text/row → structured data conversion.
 * Zero dependencies on state, DOM, Supabase, or storage.
 *
 * External dependency: normalizeImportDate calls formatISODateLocal,
 * which is provided by js/utils.js (window.formatISODateLocal in browser).
 * In Node, set global.formatISODateLocal before requiring this module.
 *
 * UMD wrapper (same proven pattern as other extracted modules):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.parseCSV, window.normalizeImportDate,
 *              window.normalizeImportAmount, window.resolveImportType
 *
 * Loaded BEFORE app.js via <script src="js/importParsers.js"> in index.html.
 * Must be loaded AFTER js/utils.js (requires window.formatISODateLocal).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory(root);
  } else {
    // Browser: expose as named globals
    var exports = factory(root);
    root.parseCSV              = exports.parseCSV;
    root.normalizeImportDate   = exports.normalizeImportDate;
    root.normalizeImportAmount = exports.normalizeImportAmount;
    root.resolveImportType     = exports.resolveImportType;
  }
})(typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : this), function (root) {
  'use strict';

  /**
   * Simple CSV parser that handles quoted fields, commas and newlines inside quotes.
   * Skips blank lines (rows where every field is empty).
   *
   * @param {string} text  Raw CSV text
   * @returns {string[][]} Array of rows, each row is an array of field strings
   */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    // Last field / row.
    if (field !== '' || row.length > 0) {
      row.push(field);
      if (row.some(c => c !== '')) rows.push(row);
    }
    return rows;
  }

  /**
   * Normalize a date string into YYYY-MM-DD.
   * Handles: Excel serial numbers, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD.
   *
   * Requires formatISODateLocal to be available as a global (provided by js/utils.js
   * in the browser, or set on global before requiring this module in Node tests).
   * In production, js/utils.js always loads before importParsers.js (guaranteed by
   * index.html loading order). No fallback needed.
   *
   * @param {string|number|null} value  Raw date value from import row
   * @returns {string}  ISO date string YYYY-MM-DD, or empty string if unparseable
   */
  function normalizeImportDate(value) {
    if (value == null) return '';
    let s = String(value).trim();
    if (!s) return '';
    // Excel serial date number.
    if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 60000) {
      const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return formatISODateLocal(d);
    }
    // Replace common separators.
    s = s.replace(/[./]/g, '-');
    // DD-MM-YYYY or DD/MM/YYYY -> YYYY-MM-DD
    let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    // YYYY-MM-DD
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
    // Try Date.parse fallback.
    const d = new Date(s);
    if (!isNaN(d.getTime())) return formatISODateLocal(d);
    return s;
  }

  /**
   * Normalize an amount string or number from an import row.
   * Handles: European format (1.234,56), US format (1,234.56),
   * currency symbols (€, $, £, ¥), and numeric values directly.
   *
   * @param {string|number|null} value  Raw amount value
   * @returns {number}  Parsed float, or 0 if unparseable
   */
  function normalizeImportAmount(value) {
    if (value == null) return 0;
    let s = String(value).trim();
    if (!s) return 0;
    // If it's already a number (e.g. from Excel), return it.
    if (typeof value === 'number') return value;
    // Remove currency symbols and spaces.
    s = s.replace(/[€$£¥\s]/g, '');
    // Handle European format: 1.234,56 -> 1234.56 ; 1,234.56 -> 1234.56
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // 1.234,56
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // 1,234.56
        s = s.replace(/,/g, '');
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Determine transaction type from the mapped type column or inflow/outflow columns.
   * Falls back to 'expense' when ambiguous.
   *
   * @param {string[]} row  One data row from the CSV/Excel import
   * @param {Object}   map  Column index map: { type, inflow, outflow, ... }
   * @returns {'income'|'expense'|'transfer'}
   */
  function resolveImportType(row, map) {
    const typeVal = map.type != null ? String(row[map.type] || '').trim().toLowerCase() : '';
    if (typeVal) {
      if (/income|εισόδ|εισοδ|credit|inflow|έσοδ|εσοδ/.test(typeVal)) return 'income';
      if (/expense|εκρο|outflow|debit|έξοδ|εξοδ/.test(typeVal)) return 'expense';
      if (/transfer|μεταφορά|μεταφορα/.test(typeVal)) return 'transfer';
    }
    // Fall back to inflow/outflow columns.
    const inflow  = map.inflow  != null ? normalizeImportAmount(row[map.inflow])  : 0;
    const outflow = map.outflow != null ? normalizeImportAmount(row[map.outflow]) : 0;
    if (inflow  > 0 && outflow <= 0) return 'income';
    if (outflow > 0 && inflow  <= 0) return 'expense';
    return 'expense';
  }

  return {
    parseCSV:              parseCSV,
    normalizeImportDate:   normalizeImportDate,
    normalizeImportAmount: normalizeImportAmount,
    resolveImportType:     resolveImportType,
  };
});
