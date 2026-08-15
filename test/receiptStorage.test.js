// Phase 4 tests for js/receiptStorage.js (local receipt photo storage via IndexedDB).
//
// ReceiptStorage uses IndexedDB (a browser API), so we cannot run real DB
// operations under node:test. These tests focus on the compatibility contract
// that must not change during extraction:
//   1. The module exports the expected public API (save/load/remove/_getDB).
//   2. The IndexedDB DB/store names are preserved (changing them would orphan
//      every already-stored receipt on user devices).
//   3. The `load` backward-compatibility resolution (single `blob` vs `blobs`
//      array) behaves identically, verified with a minimal IndexedDB mock.
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const ReceiptStorage = require('../js/receiptStorage.js');

test('exports the expected public API', () => {
    assert.ok(ReceiptStorage, 'module should export an object');
    assert.strictEqual(typeof ReceiptStorage.save, 'function');
    assert.strictEqual(typeof ReceiptStorage.load, 'function');
    assert.strictEqual(typeof ReceiptStorage.remove, 'function');
    assert.strictEqual(typeof ReceiptStorage._getDB, 'function');
});

test('preserves the IndexedDB database and store names (data compatibility)', () => {
    // These exact strings are the on-device storage contract. Changing them
    // would orphan every already-stored receipt photo.
    assert.strictEqual(ReceiptStorage.DB_NAME, 'BudgetReceiptsDB');
    assert.strictEqual(ReceiptStorage.STORE_NAME, 'receipts');
});

// --- Minimal IndexedDB mock -------------------------------------------------
// Only enough surface to exercise ReceiptStorage.load()'s resolution logic.
function makeMockIndexedDB(result) {
    const req = {};
    const store = {
        get: () => req,
    };
    const tx = {
        objectStore: () => store,
        oncomplete: null,
        onerror: null,
        onabort: null,
    };
    const db = {
        transaction: () => tx,
    };
    const openReq = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: db,
    };
    global.indexedDB = {
        open: () => openReq,
    };
    return { openReq, req, tx, db };
}

// Flush all pending microtasks (including the double-await inside _getDB/load)
// so that load() has set up its request handler before we trigger it.
const flushMicrotasks = () => new Promise((r) => setImmediate(r));

test('load resolves [] when no record exists', async () => {
    ReceiptStorage._db = null; // reset cached connection so _getDB re-opens
    const { openReq, req } = makeMockIndexedDB(null);
    const p = ReceiptStorage.load('tx-1');
    openReq.onsuccess && openReq.onsuccess({ target: { result: openReq.result } });
    await flushMicrotasks(); // let _getDB resolve and load() set up the request handler
    req.result = null;
    req.onsuccess && req.onsuccess();
    const result = await p;
    assert.deepStrictEqual(result, []);
});

test('load resolves the blobs array when stored as blobs', async () => {
    ReceiptStorage._db = null; // reset cached connection so _getDB re-opens
    const { openReq, req } = makeMockIndexedDB(null);
    const blobs = [{ fake: 'blob-a' }, { fake: 'blob-b' }];
    const p = ReceiptStorage.load('tx-2');
    openReq.onsuccess && openReq.onsuccess({ target: { result: openReq.result } });
    await flushMicrotasks(); // let _getDB resolve and load() set up the request handler
    req.result = { id: 'tx-2', blobs, savedAt: 1 };
    req.onsuccess && req.onsuccess();
    const result = await p;
    assert.deepStrictEqual(result, blobs);
});

test('load wraps a single legacy blob into an array (backward compatibility)', async () => {
    ReceiptStorage._db = null; // reset cached connection so _getDB re-opens
    const { openReq, req } = makeMockIndexedDB(null);
    const blob = { fake: 'legacy-blob' };
    const p = ReceiptStorage.load('tx-3');
    openReq.onsuccess && openReq.onsuccess({ target: { result: openReq.result } });
    await flushMicrotasks(); // let _getDB resolve and load() set up the request handler
    req.result = { id: 'tx-3', blob, savedAt: 1 };
    req.onsuccess && req.onsuccess();
    const result = await p;
    assert.deepStrictEqual(result, [blob]);
});

test('load resolves [] for a record with neither blobs nor blob', async () => {
    ReceiptStorage._db = null; // reset cached connection so _getDB re-opens
    const { openReq, req } = makeMockIndexedDB(null);
    const p = ReceiptStorage.load('tx-4');
    openReq.onsuccess && openReq.onsuccess({ target: { result: openReq.result } });
    await flushMicrotasks(); // let _getDB resolve and load() set up the request handler
    req.result = { id: 'tx-4', savedAt: 1 };
    req.onsuccess && req.onsuccess();
    const result = await p;
    assert.deepStrictEqual(result, []);
});
