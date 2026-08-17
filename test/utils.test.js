'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
    escapeHtml,
    stripThousandsSeparators,
    sanitizeFloat,
    normalizeString,
    normalizeGreekString,
    getRandomColor,
    hexToRgb,
    formatISODateLocal,
    formatShortDate,
    generateUUID,
} = require('../js/utils.js');

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
test('escapeHtml escapes HTML special characters', () => {
    assert.strictEqual(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    assert.strictEqual(escapeHtml("it's & <b>"), 'it&#039;s &amp; &lt;b&gt;');
});

test('escapeHtml returns empty string for null/undefined', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
});

test('escapeHtml coerces non-strings to string', () => {
    assert.strictEqual(escapeHtml(42), '42');
});

// ---------------------------------------------------------------------------
// stripThousandsSeparators
// ---------------------------------------------------------------------------
test('stripThousandsSeparators removes thousands separators', () => {
    assert.strictEqual(stripThousandsSeparators('5.000'), '5000');
    assert.strictEqual(stripThousandsSeparators('1.234.56'), '1234.56');
    assert.strictEqual(stripThousandsSeparators('1234'), '1234');
});

test('stripThousandsSeparators returns falsy input unchanged', () => {
    assert.strictEqual(stripThousandsSeparators(''), '');
    assert.strictEqual(stripThousandsSeparators(null), null);
    assert.strictEqual(stripThousandsSeparators(undefined), undefined);
});

// ---------------------------------------------------------------------------
// sanitizeFloat
// ---------------------------------------------------------------------------
test('sanitizeFloat parses and rounds to 2 decimals', () => {
    assert.strictEqual(sanitizeFloat('12.345'), 12.35);
    assert.strictEqual(sanitizeFloat('7'), 7);
    assert.strictEqual(sanitizeFloat('0.1'), 0.1);
});

test('sanitizeFloat returns 0 for NaN', () => {
    assert.strictEqual(sanitizeFloat('abc'), 0);
    assert.strictEqual(sanitizeFloat(undefined), 0);
});

// ---------------------------------------------------------------------------
// normalizeString (manual Greek accent map, UPPERCASE)
// ---------------------------------------------------------------------------
test('normalizeString strips Greek accents and uppercases', () => {
    assert.strictEqual(normalizeString('Καλημέρα'), 'ΚΑΛΗΜΕΡΑ');
    assert.strictEqual(normalizeString('άέήίόύώ'), 'ΑΕΗΙΟΥΩ');
    assert.strictEqual(normalizeString('  hello  '), 'HELLO');
});

test('normalizeString returns empty string for falsy input', () => {
    assert.strictEqual(normalizeString(''), '');
    assert.strictEqual(normalizeString(null), '');
});

// ---------------------------------------------------------------------------
// normalizeGreekString (NFD normalization, lowercase, strip accents/punctuation)
// ---------------------------------------------------------------------------
test('normalizeGreekString strips accents and punctuation, lowercases', () => {
    assert.strictEqual(normalizeGreekString('Καλημέρα!'), 'καλημερα');
    assert.strictEqual(normalizeGreekString('Σούπερ Μάρκετ'), 'σουπερ μαρκετ');
    assert.strictEqual(normalizeGreekString('  Α,Β.Γ  '), 'αβγ');
});

test('normalizeGreekString returns empty string for falsy input', () => {
    assert.strictEqual(normalizeGreekString(''), '');
    assert.strictEqual(normalizeGreekString(null), '');
});

// ---------------------------------------------------------------------------
// getRandomColor
// ---------------------------------------------------------------------------
test('getRandomColor returns a hex color from the palette', () => {
    const valid = /^#[0-9a-f]{6}$/i;
    for (let i = 0; i < 50; i++) {
        assert.match(getRandomColor(), valid);
    }
});

// ---------------------------------------------------------------------------
// hexToRgb
// ---------------------------------------------------------------------------
test('hexToRgb converts hex to r,g,b string', () => {
    assert.strictEqual(hexToRgb('#ff0000'), '255,0,0');
    assert.strictEqual(hexToRgb('00ff00'), '0,255,0');
    assert.strictEqual(hexToRgb('#0000ff'), '0,0,255');
});

test('hexToRgb falls back to accent purple on parse failure', () => {
    assert.strictEqual(hexToRgb('not-a-color'), '124,106,247');
    assert.strictEqual(hexToRgb(''), '124,106,247');
});

// ---------------------------------------------------------------------------
// formatISODateLocal
// ---------------------------------------------------------------------------
test('formatISODateLocal formats as YYYY-MM-DD with zero padding', () => {
    assert.strictEqual(formatISODateLocal(new Date(2026, 7, 5)), '2026-08-05');
    assert.strictEqual(formatISODateLocal(new Date(2026, 0, 1)), '2026-01-01');
});

// ---------------------------------------------------------------------------
// formatShortDate
// ---------------------------------------------------------------------------
test('formatShortDate formats as D.M.YY', () => {
    assert.strictEqual(formatShortDate(new Date(2026, 7, 5)), '5.8.26');
    assert.strictEqual(formatShortDate(new Date(2026, 0, 1)), '1.1.26');
});

// ---------------------------------------------------------------------------
// generateUUID
// ---------------------------------------------------------------------------
test('generateUUID returns a valid UUID v4 format', () => {
    const uuid = generateUUID();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('generateUUID produces unique values', () => {
    const set = new Set();
    for (let i = 0; i < 100; i++) set.add(generateUUID());
    assert.strictEqual(set.size, 100);
});
