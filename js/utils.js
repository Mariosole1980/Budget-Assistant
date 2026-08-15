/**
 * utils.js
 *
 * Pure utility/helper functions extracted from app.js (Phase 2 of the modularization plan).
 * Zero application dependencies — no state, no DOM, no Supabase, no other app.js functions.
 * Only standard JS globals (String, Math, Date, Number, crypto) are used.
 *
 * UMD wrapper (same proven pattern as js/transactionMerge.js and js/constants.js):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.BAUtils + global aliases (so app.js needs no changes)
 *
 * Loaded BEFORE app.js via <script src="js/utils.js"> in index.html.
 * This also decouples web-ui.js's dependency on escapeHtml from app.js.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node / CommonJS (used by node:test)
        module.exports = factory();
    } else {
        // Browser global
        root.BAUtils = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ============================================================
    // HTML escaping
    // ============================================================
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }

    // ============================================================
    // Number / string parsing
    // ============================================================
    // Removes thousands separators ('.') so a display value like "5.000" or
    // "1.234.56" can be parsed back to a raw number.
    function stripThousandsSeparators(str) {
        if (!str) return str;
        return String(str).replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1');
    }

    // Parses a value to a float rounded to 2 decimals; returns 0 on NaN.
    function sanitizeFloat(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return 0;
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    // ============================================================
    // Greek / text normalization
    // ============================================================
    // Manual Greek accent map; returns UPPERCASE.
    function normalizeString(str) {
        if (!str) return '';
        let s = String(str).toLowerCase().trim();
        const map = {
            'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
            'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ'
        };
        let res = '';
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            res += map[c] || c;
        }
        return res.toUpperCase();
    }

    // NFD normalization, strips accents + punctuation, lowercase, trim.
    function normalizeGreekString(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Removes accents
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?¿€]/g, "") // Removes punctuation
            .trim();
    }

    // ============================================================
    // Color helpers
    // ============================================================
    function getRandomColor() {
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#ff5722', '#607d8b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Converts a hex color to an "r,g,b" string for use in rgba() backgrounds/shadows.
    // Falls back to the accent purple on parse failure.
    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
        if (!m) return '124,106,247';
        return parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16);
    }

    // ============================================================
    // Date formatting
    // ============================================================
    function formatISODateLocal(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatShortDate(date) {
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = String(date.getFullYear()).slice(-2);
        return `${d}.${m}.${y}`;
    }

    // ============================================================
    // UUID generation
    // ============================================================
    function generateUUID() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const BAUtils = {
        escapeHtml: escapeHtml,
        stripThousandsSeparators: stripThousandsSeparators,
        sanitizeFloat: sanitizeFloat,
        normalizeString: normalizeString,
        normalizeGreekString: normalizeGreekString,
        getRandomColor: getRandomColor,
        hexToRgb: hexToRgb,
        formatISODateLocal: formatISODateLocal,
        formatShortDate: formatShortDate,
        generateUUID: generateUUID
    };

    // Browser global aliases (so app.js needs no changes — pure cut-paste)
    if (typeof window !== 'undefined') {
        window.escapeHtml = escapeHtml;
        window.stripThousandsSeparators = stripThousandsSeparators;
        window.sanitizeFloat = sanitizeFloat;
        window.normalizeString = normalizeString;
        window.normalizeGreekString = normalizeGreekString;
        window.getRandomColor = getRandomColor;
        window.hexToRgb = hexToRgb;
        window.formatISODateLocal = formatISODateLocal;
        window.formatShortDate = formatShortDate;
        window.generateUUID = generateUUID;
    }

    return BAUtils;
});
