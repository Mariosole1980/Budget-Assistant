# 🔍 Forensic Data-Integrity Report — "Resurrected" Deleted Transactions

**Date:** 2026-08-30
**Scope:** budget-assistant (Android + Web, Supabase backend)
**Type:** Forensic audit (READ-ONLY). No data was modified, deleted, or migrated.

---

## 0. Executive Summary

The app uses a **soft-delete model** (`status='deleted'` + `deleted_at`/`deleted_by`) for the trash bin, with a **hard-delete** (`.delete()`) only when the user permanently deletes from the trash. The corruption is caused by **three auto-recovery / auto-sync mechanisms that re-activate or re-upload soft-deleted or permanently-deleted transactions**, combined with a **wrong localStorage key** that makes the "never resurrect deleted items" guard ineffective.

**Root cause (single most important bug):** [`autoSyncMissingTransactionsToCloud()`](app.js:4573) reads the trash exclusion list from the key `trash_transactions` (line 4580), but the **entire rest of the app** stores trash under `deleted_transactions_trash`. The exclusion set is therefore **always empty**, so any transaction that is still present in local state but missing from the cloud's `status='active'` set gets **re-uploaded via `upsert`**, resurrecting it in Supabase and then propagating to every device.

---

## 1. DATA FLOW DIAGRAM

```
                        ┌─────────────────────────────────────────────┐
                        │              SUPABASE (cloud)               │
                        │  transactions (status='active'|'deleted')   │
                        │  sync_tombstones                            │
                        │  profiles / recurring_templates            │
                        └───────▲─────────────────────────▲───────────┘
                                │ ① fetch active only      │ ③ upsert (resurrect!)
                                │  (status='active')       │
        ┌───────────────────────┴──────────┐   ┌───────────┴───────────────────┐
        │        ANDROID (Capacitor)       │   │            WEB                │
        │  state.transactions (in-memory)  │   │  state.transactions (in-memory)│
        │  offline_transactions (LS)       │   │  offline_transactions (LS)     │
        │  deleted_transactions_trash (LS) │   │  deleted_transactions_trash(LS)│
        │  money_manager_sync_queue (LS)   │   │  money_manager_sync_queue (LS) │
        └──────────────────────────────────┘   └───────────────────────────────┘
```

### The DELETE lifecycle (as designed)

```
User deletes tx
   │  deleteTransaction(id)  [app.js:6061]
   ├─► save to trash  →  deleted_transactions_trash  (LS)
   ├─► deleteTransactionOffline  →  remove from state.transactions + offline_transactions
   ├─► enqueueSyncMutation('delete', id)  →  money_manager_sync_queue
   └─► Supabase: UPDATE status='deleted', deleted_at, deleted_by   (SOFT delete)
            └─► writeSyncTombstones('transactions', id)  →  sync_tombstones

User permanently deletes from trash
   │  deleteSingleTrashItem(id)  [app.js:36821]  /  emptyTrashBin()  [app.js:34301]
   ├─► remove from deleted_transactions_trash  (LS)
   └─► Supabase: DELETE row  (HARD delete)
```

### The RESURRECTION paths (the bug)

```
PATH A (PRIMARY) — autoSyncMissingTransactionsToCloud  [app.js:4573]
   Called from: loadData() [app.js:4870]  and  forceSyncNow() [app.js:27226]
   ┌─► cloud fetch returns ONLY status='active' rows  [app.js:27172]
   ├─► local state still has the tx (stale on Web / missed realtime / re-added by merge)
   ├─► excludedIds reads WRONG key 'trash_transactions'  →  EMPTY  [app.js:4580]  ★BUG★
   └─► tx not in cloudIds, not excluded, status!='deleted' locally
        └─► upsert(tx)  →  RESURRECTED in Supabase  →  propagates to all devices

PATH B — cachedMissingFromCloud merge  [app.js:4877-4884, 27235-27238]
   ┌─► offline_transactions cache still contains the tx
   ├─► tx not in updatedCloudIds (was hard-deleted / soft-deleted)
   └─► re-added to state.transactions  →  shows in UI again

PATH C (LATENT) — autoRestoreMistakenlyDeletedManualTransactions  [app.js:5412]
   ┌─► defined + exported (line 5558) but NOT currently called anywhere
   └─► if ever invoked: calls backend /api/restore-transactions which re-activates
        ALL status='deleted' rows via service-role key  [functions/api/restore-transactions.js:154]

PATH D — processSyncQueue 'delete' action  [app.js:26103]
   └─► only SOFT-deletes (status='deleted'); never hard-deletes. Rows persist in DB.
```

---

## 2. A. ROOT CAUSE

The **primary root cause** is the **wrong localStorage key** in [`autoSyncMissingTransactionsToCloud()`](app.js:4580):

```js
// app.js:4580  — WRONG KEY (never written anywhere)
const trash = JSON.parse(localStorage.getItem('trash_transactions') || '[]') || [];

// Everywhere else in the app — CORRECT KEY
localStorage.setItem('deleted_transactions_trash', ...)   // 20+ occurrences
```

Because `trash_transactions` is never written, the `excludedIds` set is **always empty**. The function's own comment says: *"Collect deleted IDs from trash and sync queue so we NEVER resurrect deleted items"* — but the guard is dead code.

**Secondary contributing causes:**
1. **`cachedMissingFromCloud` merge** ([app.js:4877](app.js:4877), [app.js:27237](app.js:27237)) re-adds any transaction still in the `offline_transactions` cache that isn't in the cloud — including ones that were deleted.
2. **Soft-delete model + hard-delete only on trash-empty**: `processSyncQueue` 'delete' ([app.js:26103](app.js:26103)) only sets `status='deleted'`; rows persist in the DB until trash is emptied. Any mechanism that re-activates or re-uploads them resurrects them.
3. **Latent server-side restore endpoint** ([functions/api/restore-transactions.js](functions/api/restore-transactions.js:154)) that re-activates ALL `status='deleted'` rows using the service-role key (bypasses RLS). Currently not called, but is a landmine.

---

## 3. B. WHICH DATA IS CORRECT

**The Android device's local dataset is the source of truth** for what the user actually sees and intends, **provided** it reflects the user's real deletions. However, the forensic finding is that **no single store is currently trustworthy** because the resurrection bug has been writing stale data back to Supabase.

What we know:
- The user states Android had the "correct" dataset.
- Supabase is the **shared sync hub** — it is the only store that both devices read from, so it is the **de-facto coordination point**.
- The `profiles` table has **28 rows** (verified via anon key), confirming real user data exists.
- The `transactions` table is **RLS-protected** (verified: anon key returns 0 rows while profiles returns 28) — so I **cannot** read the actual transaction rows with the publishable key.

**Conclusion:** The correct dataset is the **Android local state + the user's intended deletions**. Supabase should be reconciled to match Android's intended state, NOT the reverse. But this must be done **only after** the resurrection bug is fixed, and only with explicit confirmation of which IDs the user actually deleted.

---

## 4. C. WHERE THE "DEAD" TRANSACTIONS COME FROM

Resurrected transactions come from **four sources**, in order of likelihood:

1. **`offline_transactions` localStorage cache** — a stale copy of a deleted transaction that was never removed (or was re-added by the `cachedMissingFromCloud` merge). This is the most common source.
2. **`state.transactions` (in-memory) on a device that missed the deletion** — e.g., the Web device never received the realtime DELETE/UPDATE event, or its local state was stale. `autoSyncMissingTransactionsToCloud` then re-uploads it.
3. **Supabase rows with `status='deleted'`** that were never hard-deleted (because permanent delete from trash is the only hard-delete, and it can fail or be skipped). The latent restore endpoint would re-activate these.
4. **`money_manager_sync_queue`** — a queued `save`/`upsert` mutation for a transaction that was later deleted; if the queue isn't purged, it re-uploads.

---

## 5. D. WHICH CODE RESURRECTS THEM

| # | Function | Location | Mechanism | Active? |
|---|----------|----------|-----------|---------|
| 1 | `autoSyncMissingTransactionsToCloud` | [app.js:4573](app.js:4573) | Re-uploads local txs missing from cloud via `upsert`; wrong trash key → no exclusion | **YES** (called at [app.js:4870](app.js:4870), [app.js:27226](app.js:27226)) |
| 2 | `cachedMissingFromCloud` merge | [app.js:4877](app.js:4877), [app.js:27237](app.js:27237) | Re-adds cached txs not in cloud back to state | **YES** |
| 3 | `autoRestoreMistakenlyDeletedManualTransactions` | [app.js:5412](app.js:5412) | Re-activates ALL `status='deleted'` | **LATENT** (not called) |
| 4 | Backend `/api/restore-transactions` | [functions/api/restore-transactions.js:154](functions/api/restore-transactions.js:154) | Re-activates ALL `status='deleted'` via service-role | **LATENT** (only if #3 called) |
| 5 | `processSyncQueue` 'delete' | [app.js:26103](app.js:26103) | Only soft-deletes; rows persist | **YES** (by design) |
| 6 | `handleRealtimeTransactionChange` INSERT | [app.js:26442](app.js:26442) | Re-adds INSERTed txs to state | **YES** (by design) |

---

## 6. E. WHY WEB / ANDROID LOST CONSISTENCY

1. **Different local caches, one shared cloud.** Each device keeps its own `offline_transactions` + `state.transactions`. They only converge through Supabase.
2. **The resurrection bug writes stale data back to the cloud.** When the Web device (with stale local state) runs `forceSyncNow`, `autoSyncMissingTransactionsToCloud` re-uploads a transaction the user had deleted on Android. Supabase now has it `status='active'` again.
3. **Android then pulls the resurrected row** on its next sync/realtime event, so Android's "correct" dataset gets corrupted too — matching the user's report that "after recent Gemini changes, Android state was also corrupted."
4. **The `cachedMissingFromCloud` merge** independently re-adds deleted transactions to local state on each device, so even without a cloud write, the UI shows them again.
5. **No durable per-device tombstone for permanent deletes.** `deleteSingleTrashItem`/`emptyTrashBin` hard-delete from Supabase but do **not** write a tombstone or purge the local `offline_transactions` cache / sync queue for those IDs, so the deletion is not durably propagated and can be undone by the auto-sync.

---

## 7. F. EXACTLY WHAT WILL CHANGE (proposed controlled fix — NOT yet applied)

> ⚠️ Per your instruction, this is the **plan only**. No code has been changed. The fix will be applied only after you approve.

1. **Fix the wrong trash key** in [`autoSyncMissingTransactionsToCloud()`](app.js:4580): change `trash_transactions` → `deleted_transactions_trash`. This makes the "never resurrect deleted items" guard actually work.
2. **Also exclude IDs from `offline_transactions` that carry `status='deleted'`** and from the `_recentlyDeletedTxIds` set (already partially done) — and add the trash IDs to the merge exclusion via `collectDeletedIds` deps so `cachedMissingFromCloud` also skips them.
3. **Purge permanently-deleted IDs from local caches**: in `deleteSingleTrashItem` and `emptyTrashBin`, also remove the IDs from `state.transactions`, `offline_transactions`, and `money_manager_sync_queue`, and write a durable tombstone to `sync_tombstones` so other devices apply the deletion.
4. **Make `processSyncQueue` 'delete' durable**: after a soft-delete is confirmed, write a tombstone (already done at [app.js:6142](app.js:6142)) and ensure the row is not re-uploaded by `autoSyncMissingTransactionsToCloud` (covered by fix #1/#2).
5. **Neutralize the latent restore landmine**: either remove `autoRestoreMistakenlyDeletedManualTransactions` and the `/api/restore-transactions` endpoint, or gate them behind an explicit, user-confirmed action (never auto-run).
6. **Add a permanent-delete tombstone table** (or reuse `sync_tombstones`) so hard-deletes propagate to all devices durably.

**Scope of change:** `app.js` (both web and `android/app/src/main/assets/public/app.js`), `js/transactionMerge.js`, and possibly `functions/api/restore-transactions.js`. No data migration, no mass delete, no reset.

---

## 8. G. HOW TO VERIFY IT WON'T HAPPEN AGAIN

1. **Unit tests** for `autoSyncMissingTransactionsToCloud` asserting that a transaction present in `deleted_transactions_trash` (and one with `status='deleted'`) is **never** included in the upsert payload.
2. **Unit tests** for `mergeAndDeduplicateTransactions` / `cachedMissingFromCloud` asserting deleted/trash IDs are excluded from the merged state.
3. **Integration test** simulating: create tx → soft-delete → permanent-delete from trash → run `forceSyncNow` → assert the tx is **not** re-uploaded to Supabase and **not** re-added to state.
4. **Manual verification on both devices**: delete a transaction on Android, empty the trash, then on Web run a full sync and confirm the transaction does not reappear; repeat in the reverse direction.
5. **DB audit query** (run with service-role, not anon): confirm zero `status='deleted'` rows remain after emptying trash, and that permanently-deleted IDs are absent from `transactions` and `sync_tombstones`.
6. **Regression check** after the fix: confirm normal create/edit/restore-from-trash still work (the fix must not break legitimate restores).

---

## 9. Verification limitation (important)

I attempted to verify the actual Supabase transaction state directly. Findings:
- `profiles` → **28 rows** visible (anon key).
- `transactions` → **0 rows** visible (anon key), `content-range: */0`.
- This is **RLS working correctly** — the publishable anon key cannot read transaction data without a user session.
- The **service-role key** (which bypasses RLS) is a **Cloudflare server-side secret** (`env.SUPABASE_SERVICE_ROLE_KEY`) and is **not available in this workspace**, so I cannot run the definitive DB audit from here.

**To complete the DB-level verification, one of these is needed:**
- A valid **user session JWT** (from a logged-in browser/Android), or
- The **service-role key** (from Cloudflare secrets / Supabase dashboard), or
- Running the audit query from the **Supabase SQL editor** (dashboard).

I can provide the exact read-only SQL/query to run once you supply one of these.

---

## 10. Recommended next step

The forensic audit is complete. The root cause is identified with high confidence (wrong trash key at [app.js:4580](app.js:4580) + the `cachedMissingFromCloud` merge). **No data has been touched.**

---

## 11. FIX IMPLEMENTATION & VERIFICATION (completed)

The controlled fix plan was approved and implemented. **No database rows were modified, deleted, or migrated.** The fix is entirely in application code.

### 11.1 Root cause (confirmed)

[`autoSyncMissingTransactionsToCloud()`](app.js:4711) read the permanently-deleted exclusion list from the **wrong** localStorage key (`trash_transactions`) instead of the correct `deleted_transactions_trash`. The exclusion set was therefore **always empty**, so permanently-deleted transactions still present in local state were **re-uploaded to Supabase via `upsert`**, resurrecting them and propagating to every device. Multiple secondary paths could also reintroduce them.

### 11.2 Files changed

| File | Change |
|------|--------|
| [`app.js`](app.js) (root, canonical) | Added `collectPermanentlyDeletedTxIds()`, `purgePermanentlyDeletedTxIds()`; hardened `autoSyncMissingTransactionsToCloud`, `mergeAndDeduplicateTransactions`, `loadData`, `forceSyncNow`, `processSyncQueue`, `handleRealtimeTransactionChange`, `syncLocalTransactionsToCloud`; neutralized `autoRestoreMistakenlyDeletedManualTransactions`; fixed `deleteSingleTrashItem`/`emptyTrashBin` to purge + tombstone. |
| [`js/transactionMerge.js`](js/transactionMerge.js) | `collectDeletedIds` now accepts `deps.permanentlyDeletedTxIds` and excludes them from the merge. |
| [`functions/api/restore-transactions.js`](functions/api/restore-transactions.js) | `onRequestPost` now returns **410 Gone** (neutralized). |
| [`android/app/src/main/assets/public/app.js`](android/app/src/main/assets/public/app.js) | Re-synced from fixed root `app.js` (was a stale build artifact). |
| [`android/app/src/main/assets/public/js/transactionMerge.js`](android/app/src/main/assets/public/js/transactionMerge.js) | Re-synced from fixed root. |
| [`android/app/src/main/assets/public/functions/api/restore-transactions.js`](android/app/src/main/assets/public/functions/api/restore-transactions.js) | Re-synced from fixed root. |
| [`www/app.js`](www/app.js) | Regenerated via `npm run version:sync` (web mirror). |
| [`test/resurrectionPrevention.test.js`](test/resurrectionPrevention.test.js) | New A–F regression suite. |
| [`scratch/forensic_db_audit_console.js`](scratch/forensic_db_audit_console.js) | Read-only DB audit script (browser console, authenticated session). |

### 11.3 Behavior changed

- **Correct trash key**: all exclusion logic now reads `deleted_transactions_trash` (with legacy `trash_transactions` migration + warning).
- **Defensive exclusion**: a future key mismatch can no longer silently empty the exclusion set.
- **Permanent-delete tombstones**: `permanent_deleted_tx_ids` (durable) + cloud `sync_tombstones` are written on permanent delete.
- **Purge**: permanently-deleted IDs are removed from `state.transactions`, `offline_transactions`, and `money_manager_sync_queue`.
- **No re-upload**: `autoSyncMissingTransactionsToCloud` and `syncLocalTransactionsToCloud` filter permanently-deleted IDs before upsert.
- **No merge reintroduction**: `cachedMissingFromCloud` (both `loadData` and `forceSyncNow`) excludes permanently-deleted IDs.
- **No stale queue replay**: `processSyncQueue` drops `save`/`upsert` mutations for permanently-deleted IDs.
- **No realtime reintroduction**: `handleRealtimeTransactionChange` skips INSERT for permanently-deleted IDs.
- **Restore neutralized**: `autoRestoreMistakenlyDeletedManualTransactions` is a no-op; `/api/restore-transactions` returns 410.

### 11.4 Tests performed (all pass)

`test/resurrectionPrevention.test.js` — **13/13 pass** (A, B1–B8, C, D, E, F). Full suite: **145/145 pass** (`npm test`).

- **A**: create → sync → soft delete → permanent delete → forceSyncNow → NOT re-uploaded.
- **B1–B8**: permanently-deleted ID cannot return via trash/legacy/cache/queue/tombstone aggregation, purge, merge, stale queue save/upsert, realtime INSERT, syncLocal, or autoRestore.
- **C**: legitimate active transaction still syncs.
- **D**: Android and Web converge (dedup by id).
- **E**: permanently-deleted on Android excluded from Web.
- **F**: permanently-deleted on Web excluded from Android.

### 11.5 DB audit (pending user action)

The definitive Supabase audit requires an authenticated session or the service-role key (not available in this workspace). Run [`scratch/forensic_db_audit_console.js`](scratch/forensic_db_audit_console.js) in the logged-in browser console (READ-ONLY) and paste the JSON report back. It reports: active/deleted transaction counts, permanently-deleted IDs, orphan soft-deletes, resurrected IDs, stale queue mutations, and legacy trash-key presence.

### 11.6 Remaining risks

- **Already-corrupted Supabase rows**: rows that were already resurrected (re-uploaded) before this fix remain in the cloud. The fix prevents **new** resurrection but does not auto-delete existing bad rows. See recovery below.
- **RLS/tenant scope**: the audit uses the authenticated session; rows deleted by another family member may be hidden.
- **Legacy devices**: devices running the old bundled `app.js` (before this fix) can still resurrect until they update.

### 11.7 Recovery procedure for already-corrupted Supabase data (NOT yet executed)

Per the approved plan, **no DB cleanup has been performed**. When the user is ready, the controlled recovery is:

1. Run the read-only audit ([`scratch/forensic_db_audit_console.js`](scratch/forensic_db_audit_console.js)) to enumerate the exact resurrected IDs.
2. Confirm each resurrected ID is genuinely permanently-deleted (present in `permanent_deleted_tx_ids` / trash and absent from the user's intended active set).
3. For each confirmed ID, issue a **hard delete** (`.delete().eq('id', id)`) — NOT a soft delete — so it cannot be re-uploaded.
4. Write a `sync_tombstones` row for each so other devices apply the deletion.
5. Re-run the audit to confirm zero resurrected IDs remain.
6. Preserve a backup snapshot of the affected rows before any deletion (evidence).
