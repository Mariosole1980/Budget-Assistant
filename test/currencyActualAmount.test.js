'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const CurrencyService = require('../js/CurrencyService.js');

// ---------------------------------------------------------------------------
// BUG-02 regression: after an actual-amount correction, fx_snapshot.rate must
// be kept consistent with rate_to_base_actual / amount_base so that
// displayAmount (which prefers fx_snapshot.rate) matches toBase().
// ---------------------------------------------------------------------------

function makeTx({ amount = 100, currency = 'USD', base_currency = 'EUR', estimatedRate = 1.1, date = '2026-08-01' } = {}) {
    return {
        amount,
        currency,
        base_currency,
        date,
        rate_to_base: estimatedRate,
        rate_source: 'api',
        amount_base: CurrencyService.round(amount / estimatedRate, 4),
        fx_snapshot: {
            base: currency,
            quote: base_currency,
            rate: estimatedRate,
            date,
            source: 'api'
        }
    };
}

test('correctActualAmount updates fx_snapshot.rate to the actual rate', () => {
    const tx = makeTx({ amount: 100, estimatedRate: 1.1 });
    // Before correction, fx_snapshot.rate is the estimated rate.
    assert.strictEqual(tx.fx_snapshot.rate, 1.1);

    // User enters actual charged amount in base currency (e.g. 90 EUR for 100 USD).
    const actualInBase = 90;
    CurrencyService.correctActualAmount(tx, actualInBase);

    const expectedActualRate = CurrencyService.round(100 / 90, 8);
    assert.strictEqual(tx.rate_to_base_actual, expectedActualRate);
    assert.strictEqual(tx.rate_source, 'manual');
    // fx_snapshot.rate must now reflect the actual rate.
    assert.strictEqual(tx.fx_snapshot.rate, expectedActualRate);
    assert.strictEqual(tx.fx_snapshot.source, 'manual');
});

test('displayAmount and toBase are consistent after actual-amount correction', () => {
    const tx = makeTx({ amount: 100, estimatedRate: 1.1 });
    const actualInBase = 90;
    CurrencyService.correctActualAmount(tx, actualInBase);

    // amount_base was recomputed from the actual rate.
    const expectedBase = CurrencyService.round(100 / (100 / 90), 4); // = 90
    assert.strictEqual(tx.amount_base, expectedBase);

    // displayAmount in base currency must equal amount_base (via fx_snapshot.rate).
    const displayed = CurrencyService.displayAmount(tx, tx.base_currency);
    assert.strictEqual(displayed, tx.amount_base);
    // And toBase must also equal amount_base.
    assert.strictEqual(CurrencyService.toBase(tx), tx.amount_base);
});

test('correctActualAmount leaves fx_snapshot untouched when no snapshot present', () => {
    const tx = {
        amount: 100,
        currency: 'USD',
        base_currency: 'EUR',
        date: '2026-08-01',
        rate_to_base: 1.1,
        rate_source: 'api'
    };
    const result = CurrencyService.correctActualAmount(tx, 90);
    assert.strictEqual(result.rate_to_base_actual, CurrencyService.round(100 / 90, 8));
    assert.strictEqual(result.fx_snapshot, undefined);
});

test('correctActualAmount ignores invalid actual amounts', () => {
    const tx = makeTx({ amount: 100, estimatedRate: 1.1 });
    const before = JSON.stringify(tx);
    CurrencyService.correctActualAmount(tx, 0);
    CurrencyService.correctActualAmount(tx, -5);
    CurrencyService.correctActualAmount(tx, null);
    assert.strictEqual(JSON.stringify(tx), before);
});
