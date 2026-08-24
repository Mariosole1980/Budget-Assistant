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

// ---------------------------------------------------------------------------
// GUARD (i18n key coverage): every data-i18n* attribute used in index.html and
// every TRANSLATIONS[...]['key'] reference in app.js must exist in BOTH el and en.
//
// ROOT CAUSE this guards against: when an agent (e.g. Gemini) adds a new UI string
// via data-i18n in index.html with a hardcoded (usually Greek) default but forgets
// to register the key in js/translations.js, applyLanguage() silently skips the
// missing key and the element keeps its hardcoded Greek content — so the English
// UI shows Greek "out of nowhere". This test makes any dangling key fail loudly.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

test('every data-i18n key used in index.html exists in both el and en', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const attrs = ['data-i18n', 'data-i18n-html', 'data-i18n-title', 'data-i18n-placeholder'];
    const used = new Set();
    attrs.forEach(attr => {
        const re = new RegExp(`${attr}="([^"]+)"`, 'g');
        let m;
        while ((m = re.exec(html)) !== null) used.add(m[1]);
    });
    assert.ok(used.size > 100, 'expected many data-i18n keys in index.html');

    const missingInEl = [];
    const missingInEn = [];
    used.forEach(k => {
        if (!TRANSLATIONS.el[k]) missingInEl.push(k);
        if (!TRANSLATIONS.en[k]) missingInEn.push(k);
    });
    assert.deepStrictEqual(missingInEn, [], `data-i18n keys missing from EN: ${missingInEn.join(', ')}`);
    assert.deepStrictEqual(missingInEl, [], `data-i18n keys missing from EL: ${missingInEl.join(', ')}`);
});

test('every TRANSLATIONS[lang][key] reference in app.js exists in both el and en', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const re = /TRANSLATIONS\[(?:state\.)?lang\]\[['"]([^'"]+)['"]\]/g;
    const refs = new Set();
    let m;
    while ((m = re.exec(app)) !== null) refs.add(m[1]);
    assert.ok(refs.size > 50, 'expected many TRANSLATIONS references in app.js');

    const missingInEl = [];
    const missingInEn = [];
    refs.forEach(k => {
        if (!TRANSLATIONS.el[k]) missingInEl.push(k);
        if (!TRANSLATIONS.en[k]) missingInEn.push(k);
    });
    assert.deepStrictEqual(missingInEn, [], `app.js translation keys missing from EN: ${missingInEn.join(', ')}`);
    assert.deepStrictEqual(missingInEl, [], `app.js translation keys missing from EL: ${missingInEl.join(', ')}`);
});

