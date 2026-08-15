'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const TRANSLATIONS = require('../js/translations.js');

// ---------------------------------------------------------------------------
// Structure: exactly two languages, each a flat map of string -> string
// ---------------------------------------------------------------------------
test('TRANSLATIONS exposes exactly the el and en languages', () => {
    const langs = Object.keys(TRANSLATIONS).sort();
    assert.deepStrictEqual(langs, ['el', 'en']);
});

test('each language is a flat object of non-empty string values', () => {
    for (const lang of ['el', 'en']) {
        const dict = TRANSLATIONS[lang];
        assert.ok(dict && typeof dict === 'object', `missing language: ${lang}`);
        for (const [key, value] of Object.entries(dict)) {
            assert.strictEqual(typeof key, 'string', `key not a string in ${lang}`);
            assert.strictEqual(typeof value, 'string', `value for "${key}" in ${lang} is not a string`);
            assert.ok(value.length > 0, `value for "${key}" in ${lang} is empty`);
        }
    }
});

// ---------------------------------------------------------------------------
// Key parity: both languages must define the same set of keys
// ---------------------------------------------------------------------------
test('el and en define the exact same set of translation keys', () => {
    const elKeys = Object.keys(TRANSLATIONS.el).sort();
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    assert.deepStrictEqual(elKeys, enKeys, 'el and en key sets differ');
});

// ---------------------------------------------------------------------------
// Core navigation / UI keys exist in both languages
// ---------------------------------------------------------------------------
test('core navigation keys exist in both languages', () => {
    for (const key of ['nav_trans', 'nav_stats', 'nav_accounts', 'nav_more']) {
        assert.ok(TRANSLATIONS.el[key], `el missing key: ${key}`);
        assert.ok(TRANSLATIONS.en[key], `en missing key: ${key}`);
    }
});

test('fab_add_transaction key exists and differs by language', () => {
    const el = TRANSLATIONS.el.fab_add_transaction;
    const en = TRANSLATIONS.en.fab_add_transaction;
    assert.ok(el && el.length > 0, 'el fab_add_transaction missing');
    assert.ok(en && en.length > 0, 'en fab_add_transaction missing');
    assert.notStrictEqual(el, en, 'fab_add_transaction should differ between languages');
});

// ---------------------------------------------------------------------------
// app_version key used by getActiveBuildLabel
// ---------------------------------------------------------------------------
test('app_version key exists in both languages', () => {
    assert.ok(TRANSLATIONS.el.app_version, 'el missing app_version');
    assert.ok(TRANSLATIONS.en.app_version, 'en missing app_version');
});
