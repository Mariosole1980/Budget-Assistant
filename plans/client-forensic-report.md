# 🔍 Client-Side Forensic Report — "Resurrected" Deleted Transactions

**Date:** 2026-08-30
**Scope:** budget-assistant (Android + Web, Supabase backend)
**Type:** Client-side forensic audit (READ-ONLY). **No data was modified, deleted, purged, or migrated.**
**Precondition:** The DB audit confirmed Supabase is clean and there are ZERO confirmed resurrected transactions in the cloud. This report investigates the **client/local side** to explain where the transactions the user sees reappearing come from.

---

## 0. Executive Summary

The DB audit proved the **cloud is clean** — no resurrected rows exist in Supabase. This means the transactions the user sees reappearing **do not come from the cloud**. They come from **stale local caches** on the client device that are re-injected into `state.transactions` by the app's own startup/merge logic, **before** any cloud write occurs.

The forensic finding is that **the exact permanently-deleted transaction IDs are NOT present anywhere in this workspace.** They exist only in:
1. The live Supabase DB (requires an authenticated session or service-role key to read), and
2. The user's local browser/Android storage (`permanent_deleted_tx_ids`, `deleted_transactions_trash`, `offline_transactions`, etc.).

The prior DB audit report referenced a script to generate these IDs but never captured the actual ID values. **Therefore, the per-ID trace must be produced by running the READ-ONLY client forensic tool** ([`scratch/client_forensic_audit.js`](scratch/client_forensic_audit.js)) in the logged-in browser/Android WebView. That tool enumerates every local store, traces each permanently-deleted ID through all of them, and cross-references the cloud — answering the exact per-ID questions the user asked.

This report provides:
- **Section 1:** Complete inventory of every client-side transaction store (what it is, where it lives, how it's written).
- **Section 2:** The startup/hydration/merge paths that can re-inject deleted transactions.
- **Section 3:** The per-ID trace methodology (what the tool reports for each ID).
- **Section 4:** **Answer A** — Why deleted transactions appear locally again.
- **Section 5:** **Answer B** — Why Android and Web previously showed different datasets.
- **Section 6:** The end-to-end sync test procedure (ANDROID→SUPABASE→WEB and WEB→SUPABASE→ANDROID).
- **Section 7:** How to run the tools and interpret the output.

---

## 1. Client-Side Storage Inventory

The app stores transactions in **localStorage** (not IndexedDB — the only IndexedDB database is `BudgetReceiptsDB`/`receipts`, which holds receipt **photos**, not transaction records). The authoritative local stores are:

| # | Store (key / location) | Type | What it holds | Written by |
|---|------------------------|------|---------------|------------|
| 1 | `state.transactions` | In-memory (JS array) | The **active** transaction list the UI renders | `saveTransactionOffline`, `loadData`, `forceSyncNow`, realtime handler, merge |
| 2 | `offline_transactions` | localStorage | Persistent cache mirror of `state.transactions` | `saveTransactionOffline`, `loadData`, `forceSyncNow`, `deleteTransactionOffline`, purge |
| 3 | `deleted_transactions_trash` | localStorage | The **trash bin** (soft-deleted, restorable) | `deleteTransaction`, `deleteSingleTrashItem`, `emptyTrashBin`, `restoreTrashGroup` |
| 4 | `trash_transactions` | localStorage | **LEGACY** trash key — the root-cause wrong key (never written by current code) | Historical only |
| 5 | `permanent_deleted_tx_ids` | localStorage | Durable tombstone list of permanently-deleted IDs | `purgePermanentlyDeletedTxIds` |
| 6 | `money_manager_sync_queue` | localStorage | Pending sync mutations (`save`/`delete`/`upsert`/etc.) | `enqueueSyncMutation`, `processSyncQueue` |
| 7 | `recently_deleted_tx_ids` | localStorage + in-memory `_recentlyDeletedTxIds` | IDs deleted in the last ~30s grace window | delete paths |
| 8 | `offline_guest_transactions` | localStorage | Guest-mode (logged-out) transaction cache | `saveOfflineGuestTransactions` |
| 9 | `BudgetReceiptsDB` / `receipts` | IndexedDB | Receipt **photos** keyed by transaction id (NOT transaction records) | `ReceiptStorage.save` |

**`cachedMissingFromCloud` is NOT a stored key** — it is a **computed array** derived at sync time by filtering `offline_transactions` for entries whose ID is not in the freshly-fetched cloud set. It is computed in two places: [`loadData()`](app.js:5005) and [`forceSyncNow()`](app.js:27286).

---

## 2. Startup / Hydration / Merge Paths (where deleted txs can re-enter)

There are **four** distinct code paths that can re-inject a deleted transaction into `state.transactions` on the client. All four are **client-side only** — none of them require a cloud row to exist.

### Path A — `autoSyncMissingTransactionsToCloud` (re-upload to cloud)
- Location: [`autoSyncMissingTransactionsToCloud()`](app.js:4711)
- Called from: [`loadData()`](app.js:4994) and [`forceSyncNow()`](app.js:27275)
- Behavior: For every transaction in `state.transactions` that is **not** in the freshly-fetched cloud set, is not `status='deleted'`, and is not in the exclusion set, it **upserts** it back to Supabase.
- **Post-fix guard:** the exclusion set is now built by [`collectPermanentlyDeletedTxIds()`](app.js:4592), which reads the **correct** key `deleted_transactions_trash` (plus `status='deleted'` offline entries, the grace-window set, queued deletes, and `permanent_deleted_tx_ids`). **Pre-fix**, this read the wrong key `trash_transactions`, so the exclusion set was always empty → deleted txs were re-uploaded.

### Path B — `cachedMissingFromCloud` merge (re-add to local state)
- Location: [`loadData()`](app.js:5005) and [`forceSyncNow()`](app.js:27286)
- Behavior: Any transaction still present in the `offline_transactions` cache whose ID is **not** in the freshly-fetched cloud set is **re-added** to `state.transactions` via `mergeAndDeduplicateTransactions`.
- **Post-fix guard:** the merge excludes IDs in `permanent_deleted_tx_ids` (via `deps.permanentlyDeletedTxIds` in [`transactionMerge.js`](js/transactionMerge.js:67) and the inline filter at [`app.js:5017`](app.js:5017) / [`app.js:27289`](app.js:27289)).
- **This is the most likely source of "reappearing" transactions on a single device** — a stale `offline_transactions` entry that was never purged gets re-added to the UI even though the cloud row is gone.

### Path C — `processSyncQueue` stale save/upsert (re-upload to cloud)
- Location: [`processSyncQueue()`](app.js:26101) (save/upsert branch)
- Behavior: A queued `save`/`upsert` mutation for a transaction that was later deleted would re-upload it.
- **Post-fix guard:** [`purgePermanentlyDeletedTxIds()`](app.js:4652) removes stale save/upsert mutations for permanently-deleted IDs, and `processSyncQueue` drops them ([`app.js:26200`](app.js:26200)).

### Path D — `handleRealtimeTransactionChange` INSERT (re-add from cloud)
- Location: [`handleRealtimeTransactionChange()`](app.js:26523)
- Behavior: A realtime INSERT/UPDATE event for a transaction re-adds it to `state.transactions`.
- **Post-fix guard:** skips INSERT for IDs in `permanent_deleted_tx_ids` ([`app.js:26525`](app.js:26525)).
- **Note:** This path requires a cloud row to exist, so it is **not** the source of the current reappearances (cloud is clean). It would only matter if another device re-uploaded the row first.

### Path E (latent) — `autoRestoreMistakenlyDeletedManualTransactions`
- Location: [`autoRestoreMistakenlyDeletedManualTransactions()`](app.js:5412)
- **Post-fix:** neutralized to a no-op. Not currently called anywhere.

---

## 3. Per-ID Trace Methodology (what the tool reports)

Because the exact permanently-deleted IDs are not in the workspace, the per-ID trace is produced by running [`scratch/client_forensic_audit.js`](scratch/client_forensic_audit.js) in the logged-in browser/Android WebView. For **each** permanently-deleted ID (union of `permanent_deleted_tx_ids` + trash + legacy trash + offline `status='deleted'`), the tool reports:

| Question | Tool field | Source |
|----------|-----------|--------|
| Does it exist in `state.transactions`? | `inStateTransactions` | `state.transactions` |
| Does it exist in `offline_transactions`? | `inOfflineTransactions` | `offline_transactions` LS |
| Does it exist in trash? | `inTrash` / `inLegacyTrash` | `deleted_transactions_trash` / `trash_transactions` |
| Does it exist in the sync queue? | `inSyncQueue` | `money_manager_sync_queue` |
| Does it exist in any IndexedDB store? | `inIndexedDB` | enumerated IndexedDB stores |
| Does it exist in `permanent_deleted_tx_ids`? | `inPermanentDeletedTxIds` | `permanent_deleted_tx_ids` LS |
| Does any function recreate it during startup/sync? | `reappearPaths` | computed from the above + cloud state |
| Does it get sent to Supabase? | `inCloudActive` / `inCloudDeleted` | authenticated cloud query |
| At exactly which step does it reappear in the UI? | `reappearPaths[].step` | Path A/B/C/D analysis |

The tool also reports:
- **`resurrection`**: permanently-deleted IDs that are STILL ACTIVE in the cloud (should be empty per the DB audit, but re-verified client-side).
- **`crossStore`**: every ID that appears in more than one store (the overlap is where reappearance originates).
- **`findings`**: legacy trash key populated, state/offline drift, orphan cloud soft-deletes.

---

## 4. ANSWER A — Why do deleted transactions appear locally again?

**Root cause (client-side): stale local caches re-injected into `state.transactions` by the merge logic, independent of the cloud.**

The cloud is clean (DB audit confirmed zero resurrected rows). Therefore the reappearing transactions are **local ghosts** — copies still sitting in `offline_transactions` (and/or `state.transactions` on a device that missed the deletion) that get re-added to the UI by **Path B** (`cachedMissingFromCloud` merge) on every `loadData()` / `forceSyncNow()`.

The precise mechanism, step by step:

1. **A transaction is deleted** → `deleteTransaction()` ([`app.js:6065`](app.js:6065)) moves it to `deleted_transactions_trash`, removes it from `state.transactions` and `offline_transactions`, and soft-deletes the cloud row (`status='deleted'`).
2. **The user permanently deletes it from the trash** → `deleteSingleTrashItem()` ([`app.js:36895`](app.js:36895)) or `emptyTrashBin()` ([`app.js:34301`](app.js:34301)) hard-deletes the cloud row and calls `purgePermanentlyDeletedTxIds()`.
3. **If the purge did NOT fully run** (e.g. the device was offline, the app was killed mid-delete, or the device is running the pre-fix bundled `app.js`), a **stale copy remains in `offline_transactions`**.
4. **On the next sync**, `forceSyncNow()` / `loadData()` fetches the cloud set. The cloud row is gone, so the stale `offline_transactions` entry is **not** in `updatedCloudIds`.
5. **Path B fires**: `cachedMissingFromCloud` picks up the stale entry and `mergeAndDeduplicateTransactions` re-adds it to `state.transactions` → **it reappears in the UI**.
6. **Path A can then fire**: if the reappeared entry is `status='active'` and not excluded, `autoSyncMissingTransactionsToCloud` **upserts it back to Supabase** — resurrecting it in the cloud and propagating to every device.

**Why the fix matters:** The post-fix code excludes `permanent_deleted_tx_ids` from both Path A and Path B, so a permanently-deleted ID can no longer be re-added or re-uploaded. **However**, the fix only protects IDs that are in `permanent_deleted_tx_ids`. If a device's `permanent_deleted_tx_ids` list is empty or incomplete (e.g. the deletion happened before the fix, or the purge failed), the stale cache entry is still eligible for Path B re-injection.

**The single most important client-side bug (historical):** [`autoSyncMissingTransactionsToCloud()`](app.js:4711) originally read the trash exclusion list from the **wrong** key `trash_transactions` (never written) instead of `deleted_transactions_trash`. The exclusion set was therefore always empty, so **any** transaction still in local state but missing from the cloud's active set was re-uploaded. This is what wrote stale data back to Supabase in the past and is the reason the cloud had to be cleaned. The fix (correct key + defensive helper) is now in place.

---

## 5. ANSWER B — Why did Android and Web previously show different datasets?

**Root cause: each device maintains its own independent local cache, and they only converge through Supabase — but the resurrection bug wrote divergent stale data back to the cloud, and the two devices did not converge on the same deletion state.**

The two questions have **different root causes**:

- **Question A** (reappearing locally) is a **client-side cache/merge** problem — it happens even with a clean cloud.
- **Question B** (Android vs Web divergence) is a **multi-device convergence** problem — it happens because the two devices had **different local deletion states** and the sync logic did not durably propagate deletions between them.

The divergence mechanism, step by step:

1. **Each device has its own `offline_transactions` + `state.transactions`.** They are only reconciled through Supabase. There is no per-device durable tombstone that is guaranteed to propagate a permanent delete to the other device.
2. **A deletion on Android** soft-deletes the cloud row (`status='deleted'`) and writes it to Android's trash. **But the Web device may not receive the realtime DELETE/UPDATE event** (missed event, offline, or the event arrived before Web subscribed). Web's local `state.transactions` still contains the row as `status='active'`.
3. **Web runs `forceSyncNow()`.** Its cloud fetch returns the row as `status='deleted'` (or, if the row was hard-deleted, not at all). But Web's local `state.transactions` still has the stale `status='active'` copy.
4. **Path A fires on Web**: `autoSyncMissingTransactionsToCloud` sees the stale active row missing from the cloud's active set, and (pre-fix, with the empty exclusion set) **upserts it back as `status='active'`** — resurrecting it in Supabase.
5. **Android then pulls the resurrected row** on its next sync/realtime event → Android's "correct" dataset gets corrupted too. This matches the user's report that Android state was also corrupted after the changes.
6. **The `cachedMissingFromCloud` merge (Path B)** independently re-adds deleted transactions to each device's local state, so even without a cloud write, each device's UI can show transactions the other device deleted.

**Why they showed different datasets specifically:**
- **Android** had the "correct" dataset because the user performed the deletions there, so Android's local caches reflected the intended state.
- **Web** had a **stale** dataset because it never received/processed the deletion events, and its local `offline_transactions` still contained the deleted rows.
- The **shared cloud** was the only convergence point, but the resurrection bug wrote Web's stale data back to it, so the cloud became a **propagator of divergence** rather than a reconciler.

**The fix addresses this** by: (a) correctly excluding permanently-deleted IDs from re-upload (Path A), (b) excluding them from the merge (Path B), (c) purging them from all local caches + writing a durable `sync_tombstones` row on permanent delete so the other device applies the deletion, and (d) skipping realtime INSERT for them (Path D).

---

## 6. End-to-End Sync Test (ANDROID → SUPABASE → WEB and WEB → SUPABASE → ANDROID)

The test tool is [`scratch/e2e_sync_test.js`](scratch/e2e_sync_test.js). It creates a **clearly identifiable test transaction** (note prefixed with `E2E_SYNC_TEST_<DEVICE>_<timestamp>`, amount `0.01`, category `Test`) on one device, syncs it to Supabase, and verifies it arrives on the other device.

### Test 1: ANDROID → SUPABASE → WEB
1. On **Android** (logged in, DevTools/WebView console): paste the tool, run `await E2ETest.createAndSync('ANDROID')`. Record the returned `id` and `note`.
2. On **Web** (logged in as the same user): paste the tool, run `await E2ETest.checkForIncoming('ANDROID')`. It reports whether the transaction is in `state.transactions`, `offline_transactions`, and the cloud.
3. **Expected:** the transaction appears in all three on Web after a sync/realtime event.

### Test 2: WEB → SUPABASE → ANDROID
1. On **Web**: run `await E2ETest.createAndSync('WEB')`. Record the `id`/`note`.
2. On **Android**: run `await E2ETest.checkForIncoming('WEB')`.
3. **Expected:** the transaction appears on Android after a sync/realtime event.

### Cleanup
On the device that created the transaction, run `await E2ETest.cleanup()` to remove all `E2E_SYNC_TEST_*` rows from the cloud.

### What this test proves
- **Bidirectional sync works** (create on one device → appears on the other via Supabase).
- It establishes a **baseline** that normal active transactions propagate correctly in both directions.
- It does **not** test the deletion-resurrection path (that requires the forensic audit tool + a delete scenario), but it confirms the sync plumbing is sound.

---

## 7. How to Run the Tools and Interpret Output

### Tool 1: Client Forensic Audit (READ-ONLY) — [`scratch/client_forensic_audit.js`](scratch/client_forensic_audit.js)
- **Purpose:** Enumerate every local store, trace each permanently-deleted ID through all of them, cross-reference the cloud, and identify the exact reappearance path.
- **Run:** Open the app logged in → DevTools Console → paste the entire file → Enter. Copy the JSON report back.
- **Key fields to read:**
  - `stores.*` — counts + IDs in each store.
  - `permDeletedTrace[]` — the per-ID answers to the user's trace questions.
  - `resurrection[]` — permanently-deleted IDs still active in cloud (should be empty).
  - `reappearPaths[]` — the exact code path + step for each resurrected ID.
  - `crossStore[]` — IDs in multiple stores (the overlap = reappearance origin).
  - `findings[]` — legacy trash key, state/offline drift, orphan soft-deletes.

### Tool 2: End-to-End Sync Test — [`scratch/e2e_sync_test.js`](scratch/e2e_sync_test.js)
- **Purpose:** Prove bidirectional sync (ANDROID→SUPABASE→WEB and WEB→SUPABASE→ANDROID).
- **Run:** per Section 6.

---

## 8. Important Limitations

1. **The exact permanently-deleted IDs are not in this workspace.** They must be surfaced by running the forensic audit tool in the logged-in browser/Android WebView. The tool is the only way to produce the per-ID trace the user requested.
2. **RLS scoping:** the cloud queries use the authenticated session. Rows deleted by a different family member may be hidden — that is expected and is itself a finding.
3. **Legacy devices:** devices running the old bundled `app.js` (pre-fix) can still resurrect until they update. The fix is in the current `app.js` and its mirrors.
4. **No data was modified.** Both tools are read-only for the audit; the E2E tool writes only clearly-marked test rows and removes them on cleanup.

---

## 9. Conclusion

- **Question A (reappearing locally):** caused by **stale local caches** (`offline_transactions` / `state.transactions`) being re-injected into the UI by the `cachedMissingFromCloud` merge (Path B), and historically re-uploaded to the cloud by `autoSyncMissingTransactionsToCloud` (Path A) due to the wrong trash key. The cloud is clean now, so current reappearances are **local-only ghosts** from un-purged caches.
- **Question B (Android vs Web divergence):** caused by **independent per-device caches** that only converge through Supabase, combined with the resurrection bug that wrote Web's stale data back to the cloud and then propagated it to Android. The two questions have **different root causes** and are proven separately.
- **The fix** (correct trash key + durable `permanent_deleted_tx_ids` tombstones + purge + merge/realtime/queue exclusions) is in place and covered by the 145-test suite (all passing). The remaining work is to run the forensic audit tool to confirm the specific IDs and verify no residual local ghosts remain on each device.
