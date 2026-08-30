'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
    mergeAndDeduplicateTransactions,
    getPendingLocalTransactions,
    collectDeletedIds,
    collectActiveDeletionIds,
} = require('../js/transactionMerge.js');

// ---------------------------------------------------------------------------
// mergeAndDeduplicateTransactions
// ---------------------------------------------------------------------------

test('keeps two transactions with identical content but different ids', () => {
    const cloud = [
        { id: '11111111-1111-1111-1111-111111111111', date: '2026-08-09', amount: 5.0, type: 'expense', category: 'Coffee', user_id: 'u1' },
    ];
    const local = [
        { id: '22222222-2222-2222-2222-222222222222', date: '2026-08-09', amount: 5.0, type: 'expense', category: 'Coffee', user_id: 'u1' },
    ];

    const result = mergeAndDeduplicateTransactions(cloud, local);

    assert.strictEqual(result.length, 2, 'both identical-content transactions must be kept');
    const ids = result.map((t) => t.id).sort();
    assert.deepStrictEqual(ids, [
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
    ]);
});

test('deduplicates by id (same id in cloud and local -> one record)', () => {
    const cloud = [{ id: 'a', amount: 10 }];
    const local = [{ id: 'a', amount: 10 }];

    const result = mergeAndDeduplicateTransactions(cloud, local);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'a');
});

test('local pending record wins over cloud record with same id', () => {
    const cloud = [{ id: 'a', amount: 10, note: 'cloud' }];
    const local = [{ id: 'a', amount: 12, note: 'local-edit' }];

    const result = mergeAndDeduplicateTransactions(cloud, local);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].amount, 12);
    assert.strictEqual(result[0].note, 'local-edit');
});

test('excludes ids that are being deleted right now', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const local = [];
    const deps = { deletingTxIds: new Set(['a']) };

    const result = mergeAndDeduplicateTransactions(cloud, local, deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
});

test('excludes ids deleted in the recent grace window', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = { recentlyDeletedTxIds: new Set(['b']) };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'a');
});

test('excludes ids with a pending delete in the sync queue', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = { syncQueue: [{ action: 'delete', payload: 'a' }] };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
});

test('handles null/undefined inputs gracefully', () => {
    assert.deepStrictEqual(mergeAndDeduplicateTransactions(null, null), []);
    assert.deepStrictEqual(mergeAndDeduplicateTransactions(undefined, []), []);
    assert.deepStrictEqual(mergeAndDeduplicateTransactions([], undefined), []);
});

test('skips records without an id', () => {
    const cloud = [{ id: 'a', amount: 10 }, { amount: 99 }];
    const result = mergeAndDeduplicateTransactions(cloud, []);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'a');
});

// ---------------------------------------------------------------------------
// getPendingLocalTransactions
// ---------------------------------------------------------------------------

test('keeps local_ prefixed transactions', () => {
    const cached = [{ id: 'local_abc', amount: 5 }];
    const result = getPendingLocalTransactions(cached, {});
    assert.strictEqual(result.length, 1);
});

test('keeps transactions with no user_id', () => {
    const cached = [{ id: 'uuid-1', amount: 5, user_id: null }];
    const result = getPendingLocalTransactions(cached, {});
    assert.strictEqual(result.length, 1);
});

test('keeps transactions that are queued for save', () => {
    const cached = [{ id: 'uuid-1', amount: 5, user_id: 'u1' }];
    const deps = { syncQueue: [{ action: 'save', payload: { id: 'uuid-1' } }] };
    const result = getPendingLocalTransactions(cached, deps);
    assert.strictEqual(result.length, 1);
});

test('keeps transactions recently saved within the grace window', () => {
    const cached = [{ id: 'uuid-1', amount: 5, user_id: 'u1' }];
    const deps = { recentlySavedTxIds: new Set(['uuid-1']) };
    const result = getPendingLocalTransactions(cached, deps);
    assert.strictEqual(result.length, 1);
});

test('drops a fully-synced cloud transaction (valid uuid, no queue, not recent)', () => {
    const cached = [{ id: '11111111-1111-1111-1111-111111111111', amount: 5, user_id: 'u1' }];
    const result = getPendingLocalTransactions(cached, {});
    assert.strictEqual(result.length, 0);
});

test('keeps non-uuid ids (treated as local)', () => {
    const cached = [{ id: 'not-a-uuid', amount: 5, user_id: 'u1' }];
    const result = getPendingLocalTransactions(cached, {});
    assert.strictEqual(result.length, 1);
});

test('returns [] for non-array input', () => {
    assert.deepStrictEqual(getPendingLocalTransactions(null, {}), []);
    assert.deepStrictEqual(getPendingLocalTransactions('nope', {}), []);
});

// ---------------------------------------------------------------------------
// collectDeletedIds
// ---------------------------------------------------------------------------

test('collectDeletedIds merges all sources and stringifies', () => {
    const ids = collectDeletedIds({
        deletingTxIds: new Set(['a', 1]),
        recentlyDeletedTxIds: ['b'],
        syncQueue: [{ action: 'delete', payload: 'c' }, { action: 'save', payload: { id: 'x' } }],
    });
    assert.deepStrictEqual([...ids].sort(), ['1', 'a', 'b', 'c']);
});

// ---------------------------------------------------------------------------
// CLOUD-AUTHORITY (regression for "dozens of transactions disappeared from web")
// ---------------------------------------------------------------------------
// The cloud is the source of truth for what is ACTIVE. A stale local durable
// tombstone (permanentlyDeletedTxIds) must NEVER hide a cloud-active
// transaction. It is only excluded while being deleted right now (in-flight,
// recent grace window, or queued delete).

test('cloud-active transaction is NOT excluded by a stale durable tombstone', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = { permanentlyDeletedTxIds: new Set(['a']) };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    // 'a' is active in the cloud, so the stale tombstone must NOT hide it.
    assert.strictEqual(result.length, 2);
    const ids = result.map((t) => t.id).sort();
    assert.deepStrictEqual(ids, ['a', 'b']);
});

test('cloud-active transaction IS excluded while being deleted right now (in-flight)', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = {
        deletingTxIds: new Set(['a']),
        permanentlyDeletedTxIds: new Set(['a']),
    };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
});

test('cloud-active transaction IS excluded within the recent grace window', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = {
        recentlyDeletedTxIds: new Set(['a']),
        permanentlyDeletedTxIds: new Set(['a']),
    };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
});

test('cloud-active transaction IS excluded with a pending delete in the sync queue', () => {
    const cloud = [{ id: 'a', amount: 10 }, { id: 'b', amount: 20 }];
    const deps = {
        syncQueue: [{ action: 'delete', payload: 'a' }],
        permanentlyDeletedTxIds: new Set(['a']),
    };

    const result = mergeAndDeduplicateTransactions(cloud, [], deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'b');
});

// ---------------------------------------------------------------------------
// RESURRECTION PREVENTION (local-only transactions)
// ---------------------------------------------------------------------------
// A local-only transaction (not present in the cloud) that was permanently
// deleted must NEVER be re-introduced, even if it is not being deleted right
// now. The full deleted set (including durable tombstones) applies to local.

test('local-only permanently-deleted transaction is excluded (resurrection prevention)', () => {
    const cloud = [];
    const local = [{ id: 'local_a', amount: 10 }, { id: 'local_b', amount: 20 }];
    const deps = { permanentlyDeletedTxIds: new Set(['local_a']) };

    const result = mergeAndDeduplicateTransactions(cloud, local, deps);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'local_b');
});

test('local-only transaction excluded by in-flight deletion too', () => {
    const cloud = [];
    const local = [{ id: 'local_a', amount: 10 }];
    const deps = { deletingTxIds: new Set(['local_a']) };

    const result = mergeAndDeduplicateTransactions(cloud, local, deps);

    assert.strictEqual(result.length, 0);
});

// ---------------------------------------------------------------------------
// collectActiveDeletionIds
// ---------------------------------------------------------------------------

test('collectActiveDeletionIds excludes durable tombstones (only in-flight/recent/queued)', () => {
    const ids = collectActiveDeletionIds({
        deletingTxIds: new Set(['a']),
        recentlyDeletedTxIds: ['b'],
        syncQueue: [{ action: 'delete', payload: 'c' }, { action: 'save', payload: { id: 'x' } }],
        permanentlyDeletedTxIds: new Set(['z']),
    });
    // 'z' is a durable tombstone and must NOT appear in the active deletion set.
    assert.deepStrictEqual([...ids].sort(), ['a', 'b', 'c']);
});

test('collectActiveDeletionIds returns empty set for no deps', () => {
    const ids = collectActiveDeletionIds({});
    assert.strictEqual(ids.size, 0);
});
