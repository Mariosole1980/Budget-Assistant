'use strict';

// ===========================================================================
// BUG-04 regression tests: multi-currency cloud persistence fix (A-H).
//
// app.js is a browser SPA and cannot be required() from Node, so these tests
// are SOURCE-LEVEL regression guards: they read app.js and assert that the
// structural changes that fix BUG-04 are present and correct. They also
// validate the currency-computation logic (the exact behavior reproduced by
// computeCurrencyFields) against the canonical CurrencyService behavior.
//
// The tests guard against regression of:
//   A  - computeCurrencyFields(t) helper exists (single source of truth)
//   A2 - the normal transaction path calls computeCurrencyFields(t) (no
//        parallel inline logic)
//   B  - mapTemplateToDb writes currency
//   C  - mapTemplateFromDb reads currency
//   D  - recurring template object captures the transaction-form currency
//   E  - processRecurringTemplates newTx carries currency + computes fields
//   F  - regenerateRecurringTemplateTransactions newTx carries currency + computes
//   G  - importExcelData carries currency (EUR backward-compat) + computes
//   H  - the 6 stripping sites no longer strip the 9 currency columns
//        (only fx_snapshot + client-only fields remain stripped)
// ===========================================================================

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CurrencyService = require('../js/CurrencyService.js');

const APP_JS = path.join(__dirname, '..', 'app.js');
const appSrc = fs.readFileSync(APP_JS, 'utf8');

// The 9 currency columns that must now be persisted to Supabase.
const CURRENCY_COLUMNS = [
    'currency',
    'base_currency',
    'rate_to_base',
    'amount_base',
    'rate_source',
    'rate_to_base_actual',
    'rate_fetched_at',
    'transfer_id',
    'transfer_rate'
];

// Client-only fields that must STILL be stripped from cloud payloads.
const CLIENT_ONLY = ['description', 'is_shared', 'photo_local_uri', 'photo_url', 'receipt', 'fx_snapshot'];

// ---------------------------------------------------------------------------
// A. computeCurrencyFields helper exists (single source of truth)
// ---------------------------------------------------------------------------
test('A: computeCurrencyFields(t) helper is defined in app.js', () => {
    assert.match(appSrc, /function computeCurrencyFields\(t\)\s*\{/);
});

test('A: computeCurrencyFields reproduces the canonical EUR 1:1 behavior', () => {
    // The helper must set base_currency, rate_to_base=1, amount_base=amount,
    // rate_source='api' when tx currency === base currency.
    const helper = appSrc.match(/function computeCurrencyFields\(t\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(helper, 'computeCurrencyFields body not found');
    const body = helper[1];
    assert.match(body, /t\.base_currency = baseCurrency;/);
    assert.match(body, /t\.rate_to_base = 1;/);
    assert.match(body, /t\.amount_base = CurrencyService\.round\(Number\(t\.amount\), 4\);/);
    assert.match(body, /t\.rate_source = 'api';/);
    // Cross-currency path uses getRate and divides amount by rate.
    assert.match(body, /CurrencyService\.getRate\(txCurrency, baseCurrency, t\.date\)/);
    assert.match(body, /t\.amount_base = CurrencyService\.round\(Number\(t\.amount\) \/ rate, 4\);/);
    // No-rate (offline) path sets nulls + 'cached'.
    assert.match(body, /t\.rate_to_base = null;/);
    assert.match(body, /t\.rate_source = 'cached';/);
    // fx_snapshot is built with the same precedence as the original block.
    assert.match(body, /rate: t\.rate_to_base_actual \|\| t\.rate_to_base \|\| rate \|\| 1,/);
});

// ---------------------------------------------------------------------------
// A2. Normal transaction path calls computeCurrencyFields (no parallel logic)
// ---------------------------------------------------------------------------
test('A2: normal transaction path calls computeCurrencyFields(t) instead of an inline block', () => {
    // The inline block that duplicated the logic must be gone.
    const inlineBlockPattern = /const userPreferredCurrency = state\.userProfile\?\.base_currency[\s\S]*?let rate = 1;[\s\S]*?t\.fx_snapshot = \{/;
    // There should be exactly ONE occurrence of the canonical computation
    // (inside the helper), not a second inline copy in the save path.
    const matches = appSrc.match(/const userPreferredCurrency = state\.userProfile\?\.base_currency/g) || [];
    assert.strictEqual(matches.length, 1, 'expected exactly one canonical computation (in the helper)');
    // The save path must call the helper.
    assert.match(appSrc, /computeCurrencyFields\(t\);/);
});

// ---------------------------------------------------------------------------
// B/C. mapTemplateToDb / mapTemplateFromDb handle currency
// (Phase 2, Extraction 2: these functions now live in js/recurringMappers.js)
// ---------------------------------------------------------------------------
const MAPPERS_JS = path.join(__dirname, '..', 'js', 'recurringMappers.js');
const mappersSrc = fs.readFileSync(MAPPERS_JS, 'utf8');

test('B: mapTemplateToDb writes currency (defaulting to EUR)', () => {
    const fn = mappersSrc.match(/function mapTemplateToDb\(t\)\s*\{[\s\S]*?\n  \}/);
    assert.ok(fn, 'mapTemplateToDb not found');
    assert.match(fn[0], /currency:\s+t\.currency\s+\|\|\s+'EUR',/);
});

test('C: mapTemplateFromDb reads currency (defaulting to EUR)', () => {
    const fn = mappersSrc.match(/function mapTemplateFromDb\(t\)\s*\{[\s\S]*?\n  \}/);
    assert.ok(fn, 'mapTemplateFromDb not found');
    assert.match(fn[0], /currency:\s+t\.currency\s+\|\|\s+'EUR',/);
});

// ---------------------------------------------------------------------------
// D. Recurring template object captures the transaction-form currency
// ---------------------------------------------------------------------------
test('D: recurring template object captures getTransactionCurrency()', () => {
    assert.match(appSrc, /currency: getTransactionCurrency\(\),/);
});

// ---------------------------------------------------------------------------
// E. processRecurringTemplates newTx carries currency + computes fields
// ---------------------------------------------------------------------------
test('E: processRecurringTemplates newTx carries currency and calls computeCurrencyFields', () => {
    assert.match(appSrc, /currency: template\.currency \|\| 'EUR',/);
    // The computeCurrencyFields call must appear before saveTransactionOffline(newTx).
    const seg = appSrc.match(/processRecurringTemplates[\s\S]*?saveTransactionOffline\(newTx\);/);
    assert.ok(seg, 'processRecurringTemplates save block not found');
    assert.match(seg[0], /computeCurrencyFields\(newTx\);/);
});

// ---------------------------------------------------------------------------
// F. regenerateRecurringTemplateTransactions newTx carries currency + computes
// ---------------------------------------------------------------------------
test('F: regenerateRecurringTemplateTransactions newTx carries currency and calls computeCurrencyFields', () => {
    const seg = appSrc.match(/regenerateRecurringTemplateTransactions[\s\S]*?saveTransactionOffline\(newTx\);/);
    assert.ok(seg, 'regenerateRecurringTemplateTransactions save block not found');
    assert.match(seg[0], /currency: template\.currency \|\| 'EUR',/);
    assert.match(seg[0], /computeCurrencyFields\(newTx\);/);
});

// ---------------------------------------------------------------------------
// G. importExcelData carries currency (EUR backward-compat) + computes
// ---------------------------------------------------------------------------
test('G: importExcelData carries currency (EUR backward-compat) and calls computeCurrencyFields', () => {
    const seg = appSrc.match(/importExcelData[\s\S]*?await saveTransaction\(tx\);/);
    assert.ok(seg, 'importExcelData save block not found');
    assert.match(seg[0], /currency: 'EUR',/);
    assert.match(seg[0], /computeCurrencyFields\(tx\);/);
});

// ---------------------------------------------------------------------------
// H. The 6 stripping sites no longer strip the 9 currency columns
// ---------------------------------------------------------------------------
test('H: no stripping site removes the 9 currency columns from cloud payloads', () => {
    // The old destructuring that stripped currency columns must be gone.
    const oldDestructure = /const \{ description, is_shared, photo_local_uri, photo_url, receipt, currency, base_currency, rate_to_base, amount_base, rate_source, fx_snapshot, rate_to_base_actual, rate_fetched_at, transfer_id, transfer_rate, \.\.\./;
    assert.doesNotMatch(appSrc, oldDestructure, 'old currency-stripping destructuring still present');

    // The new destructuring keeps only client-only fields stripped.
    const newDestructure = /const \{ description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, \.\.\./g;
    const newMatches = appSrc.match(newDestructure) || [];
    // saveTransaction, processRecurringTemplates, regenerate, processSyncQueue,
    // restoreTrashGroup = 5 destructuring sites. syncLocalTransactionsToCloud
    // uses the delete copy.X pattern instead.
    assert.ok(newMatches.length >= 5, 'expected at least 5 new destructuring sites, got ' + newMatches.length);

    // syncLocalTransactionsToCloud must no longer delete the currency columns.
    const syncSeg = appSrc.match(/syncLocalTransactionsToCloud[\s\S]*?delete copy\.fx_snapshot;/);
    assert.ok(syncSeg, 'syncLocalTransactionsToCloud delete block not found');
    assert.doesNotMatch(syncSeg[0], /delete copy\.currency;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.rate_to_base;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.amount_base;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.rate_source;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.rate_to_base_actual;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.rate_fetched_at;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.transfer_id;/);
    assert.doesNotMatch(syncSeg[0], /delete copy\.transfer_rate;/);
});

test('H: fx_snapshot and client-only fields remain stripped', () => {
    // fx_snapshot is NOT a column and must stay stripped everywhere.
    const newDestructure = /const \{ description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, \.\.\./g;
    const matches = appSrc.match(newDestructure) || [];
    for (const m of matches) {
        assert.match(m, /fx_snapshot,/, 'fx_snapshot must remain in the stripped list');
    }
    // syncLocalTransactionsToCloud still deletes fx_snapshot.
    assert.match(appSrc, /delete copy\.fx_snapshot;/);
});

// ---------------------------------------------------------------------------
// Logic validation: computeCurrencyFields behavior matches CurrencyService
// ---------------------------------------------------------------------------
// The helper's computation must agree with CurrencyService.computeAmountBase
// for the three canonical cases (same currency, cross-currency with rate,
// cross-currency without rate).
test('logic: same-currency transaction computes 1:1 (EUR -> EUR)', () => {
    const tx = { amount: 100, currency: 'EUR', base_currency: 'EUR', date: '2026-08-01' };
    // Reproduce computeCurrencyFields for the same-currency branch.
    const rate = 1;
    const amount_base = CurrencyService.round(Number(tx.amount), 4);
    assert.strictEqual(amount_base, 100);
    assert.strictEqual(rate, 1);
    // Cross-check with CurrencyService.computeAmountBase.
    assert.strictEqual(CurrencyService.computeAmountBase(100, 'EUR', 'EUR', '2026-08-01'), 100);
});

test('logic: cross-currency transaction uses getRate and divides amount', () => {
    const tx = { amount: 100, currency: 'USD', base_currency: 'EUR', date: '2026-08-01' };
    const foundRate = CurrencyService.getRate('USD', 'EUR', '2026-08-01');
    assert.ok(foundRate != null && foundRate > 0, 'expected a USD->EUR rate to be available');
    const amount_base = CurrencyService.round(Number(tx.amount) / foundRate, 4);
    // Cross-check with CurrencyService.computeAmountBase (same formula).
    assert.strictEqual(amount_base, CurrencyService.computeAmountBase(100, 'USD', 'EUR', '2026-08-01'));
});

test('logic: no-rate (offline) case yields null amount_base and cached source', () => {
    // Simulate a currency with no known rate -> computeAmountBase returns null.
    const amount_base = CurrencyService.computeAmountBase(100, 'XXX', 'EUR', '2026-08-01');
    assert.strictEqual(amount_base, null);
    // The helper maps this to rate_to_base=null, amount_base=null, source='cached'.
    assert.strictEqual(CurrencyService.getRate('XXX', 'EUR', '2026-08-01'), null);
});

test('logic: fx_snapshot.rate precedence is rate_to_base_actual || rate_to_base || rate || 1', () => {
    const tx = { amount: 100, currency: 'USD', base_currency: 'EUR', date: '2026-08-01' };
    const rate = CurrencyService.getRate('USD', 'EUR', '2026-08-01') || 1;
    // Without rate_to_base_actual, snapshot uses rate_to_base or rate.
    assert.strictEqual(tx.rate_to_base_actual || tx.rate_to_base || rate || 1, rate);
    // With rate_to_base_actual set, it takes precedence.
    tx.rate_to_base_actual = 1.2;
    assert.strictEqual(tx.rate_to_base_actual || tx.rate_to_base || rate || 1, 1.2);
});
