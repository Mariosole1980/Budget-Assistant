# Architectural Decision — The Most Important Next Step

**Date:** 2026-08-09
**Author:** Senior Software Architect (ownership of the project)
**Status:** DECISION — no code changed in this phase

---

## TL;DR

**The most important next step is NOT modularizing `app.js`.**

It is fixing a **real, reachable, irreversible data-loss bug** in the transaction
deduplication/sync logic, and adding a **focused test harness** around that logic so
the fix cannot regress.

Modularization of `app.js` is deferred. It is a maintainability concern, not a
correctness bug, and doing it now — with zero tests and an active data-loss bug in
the sync path — would be high-risk and low-immediate-value.

---

## Evidence from the real code

### Finding 1 (CRITICAL): Content-based dedup silently deletes legitimate transactions

[`app.js`](../app.js:668) — `mergeAndDeduplicateTransactions()`:

- First dedups by **ID** (correct — a UUID is unique).
- Then does a **second content-based dedup** using key
  `user_id|date|amount|type|category|account_from|account_to|note`
  ([`app.js`](../app.js:713)).

This collapses **two legitimately distinct transactions that happen to have identical
content** (e.g. two coffees at €3.50 on the same day from the same account) into a
single row. The second one is dropped from `state.transactions` and from the
`offline_transactions` cache.

This runs on **every** `loadData()` ([`app.js`](../app.js:4329)) and **every**
`forceSyncNow()` ([`app.js`](../app.js:21698)) — i.e. every app start and every sync.

**The codebase already knows content-matching is wrong.** In
[`deleteTransaction()`](../app.js:5081) there is an explicit comment:

> *"Content-based 'duplicate' matching was removed because it could delete legitimate
> identical transactions (same date/amount/category/note)."*

Yet the same flawed content-matching is still used in the merge path.

### Finding 2 (CRITICAL, latent): `cleanDuplicateTransactions()` permanently deletes from the cloud

[`app.js`](../app.js:3974) — `cleanDuplicateTransactions()`:

- Uses the **same content-based key** to group transactions.
- For any group with >1 member, it keeps one and **permanently DELETES the rest from
  the cloud database** ([`app.js`](../app.js:4060): `.delete().in('id', batch)`).

This is **irreversible data loss** in the database. It is exposed on `window`
([`app.js`](../app.js:4078)) and has no automatic call site, so it is currently a
latent bomb (only fires if invoked manually), but it must be neutralized.

### Finding 3 (HIGH): Zero automated tests

[`package.json`](../package.json:7):

```json
"test": "echo \"Error: no test specified\" && exit 1"
```

A 29,246-line, data-critical app has **no test suite**. This is why the data-loss bug
above survived: there is no safety net. It also makes every future refactor (including
the eventual modularization) dangerous.

### Finding 4 (MEDIUM, deferred): `app.js` is a 29,246-line monolith

- 558 top-level functions, 92 top-level `let/var/const`, 68 async functions.
- This is a maintainability problem, not a correctness bug.
- It is **not** the most important next step because it does not cause user-facing
  failure today, and refactoring it without tests is high-risk.

### Finding 5 (LOW / already handled): Security posture is sound

- The hardcoded Supabase key in [`app.js`](../app.js:455) is a **publishable/anon key**
  (`sb_publishable_...`), which is safe by design — RLS protects the data.
- The `service_role` key is only read from environment
  ([`functions/api/delete-account.js`](../functions/api/delete-account.js:33)), never
  hardcoded.
- Cloudflare Functions validate JWTs and use the service role only server-side.
- The RLS remediation (commit `ee55fec`) is what makes the publishable key safe.

### Finding 6 (LOW, deferred): Release pipeline divergence

Two paths exist (`build_and_deploy.ps1` vs `scripts/release-deploy.js`). Documented in
[`plans/release-pipeline-mapping.md`](release-pipeline-mapping.md). Operational, not
user-facing; deferred.

---

## Candidate evaluation

| # | Problem | Importance | Likelihood | Fix risk | Benefit | Timing |
|---|---------|-----------|-----------|----------|---------|--------|
| 1 | Content-dedup data loss (merge) | **CRITICAL** | **HIGH** (every sync) | LOW | HIGH | **NOW** |
| 2 | Cloud-delete data loss (cleanup) | **CRITICAL** | LOW (manual) | LOW | HIGH | **NOW** |
| 3 | Zero automated tests | HIGH | CERTAIN | LOW-MED | HIGH | **NOW** |
| 4 | app.js monolith (modularization) | MEDIUM | LOW | HIGH | MED-LONG | LATER |
| 5 | Release pipeline divergence | MEDIUM | LOW | MED | MED | LATER |
| 6 | Security | — | — | — | — | DONE (prior phase) |
| 7 | Stale refs / www artifacts | LOW | LOW | LOW | LOW | LATER |

**Decision:** Fix #1 and #2 (the data-loss bugs) and add #3 (a focused test harness)
as the safety net. Defer #4 (modularization) until data integrity is secured and tests
exist.

---

## Proposed solution

### Step 1 — Remove content-based dedup from the merge path (fixes Finding 1)

In `mergeAndDeduplicateTransactions()`:
- **Keep** the ID-based dedup (the `idMap` / `Object.values(idMap)` logic).
- **Remove** the second content-based dedup block ([`app.js`](../app.js:710-723)).
- Result: the function becomes a pure ID-based union of cloud + local-pending
  transactions. Distinct identical-content transactions are preserved.

This is a **small, surgical, reversible** change. It does not alter the offline queue,
the sync flush, or the UI. It only stops the merge from collapsing distinct rows.

### Step 2 — Neutralize `cleanDuplicateTransactions()` (fixes Finding 2)

- **Do not** run it automatically (it already has no automatic call site).
- Change its content-based grouping to **ID-based only**, so it can never delete a
  legitimate distinct transaction. If a group has >1 member with the same ID, keep one;
  otherwise never delete.
- Keep it exposed on `window` (harmless once ID-based) or remove the cloud-delete
  branch entirely. Prefer removing the cloud-delete branch to eliminate the irreversible
  path.

### Step 3 — Add a focused test harness around the sync/dedup logic (Finding 3)

- Extract the two pure functions (`mergeAndDeduplicateTransactions`,
  `getPendingLocalTransactions`) into a small, dependency-free module that can be
  `require()`d by a Node test runner, **without** changing production behavior (the
  functions are currently top-level in `app.js`; we add a thin export or a standalone
  copy used by tests, then wire the app to the same module).
- Add a minimal test runner (Node's built-in `node:test` — no new framework) with cases:
  1. Two distinct identical-content transactions are **both** preserved.
  2. A transaction in the offline sync queue is preserved across a merge.
  3. A `local_` prefixed transaction is preserved.
  4. A transaction with a non-UUID id is preserved.
  5. A transaction in the delete guard set is dropped.
  6. Cloud + local-pending with the same ID dedup to one (ID-based).
- Wire `npm test` to run these (replace the placeholder in
  [`package.json`](../package.json:7)).

### Step 4 — Verify and checkpoint

- Run the new test suite.
- Manual smoke test: create two identical transactions, sync, confirm both remain.
- Commit as a single reversible checkpoint.

---

## Why this is the best choice

1. **It prevents irreversible data loss** — the user's stated top priority. A budget
   app that silently drops or deletes legitimate transactions destroys user trust and
   cannot be undone.
2. **Lowest risk of all candidates** — the fix is a small, surgical removal of a known
   wrong code path, and the codebase itself documents that content-matching is wrong.
3. **Enables everything else** — the test harness is the precondition for the eventual
   `app.js` modularization. Refactoring a monolith with zero tests is reckless; with
   tests around the core data logic, modularization becomes safe and incremental.
4. **Small, reversible, testable** — fits the user's rules (no big refactor at once,
   every change verifiable).

## Risks of this change

- **Low.** The merge function is called in two places (`loadData`, `forceSyncNow`),
  both of which already rely on the ID-based union. Removing the content-dedup can only
  *increase* the number of rows kept; it cannot drop rows. The only behavioral change is
  that genuinely duplicated rows (same content, different IDs) will now both appear —
  which is the correct behavior, since the app cannot know they are duplicates.
- The test harness is additive and does not touch production behavior.

## What is explicitly NOT done now

- **No `app.js` modularization.** Deferred until the data-loss fix is in and the test
  harness exists.
- **No bundler / ES modules / framework introduction.**
- **No UI, database redesign, Family logic, or OTA architecture changes.**
- **No release-pipeline or www-artifact changes** (documented, deferred).

## Implementation plan (ordered, each step reversible)

1. Extract `mergeAndDeduplicateTransactions` and `getPendingLocalTransactions` into a
   testable module (no behavior change).
2. Add `node:test`-based tests covering the cases above; wire `npm test`.
3. Remove the content-based dedup block from the merge function.
4. Neutralize `cleanDuplicateTransactions` (ID-based only / remove cloud-delete branch).
5. Run tests + manual smoke test (two identical transactions survive a sync).
6. Commit as a single checkpoint.
7. Re-audit; only then consider modularizing `app.js` subsystem-by-subsystem.
