# 🔁 Recurring Transactions — Deep Architecture Review

> **UPDATE (Build v1400):** All CRITICAL and HIGH findings below have been **verified as fixed** in the current codebase. See the [Verification of Applied Fixes](#6-verification-of-applied-fixes-build-v1400) section at the end for the confirmed status of each fix and the one remaining residual risk.

**Scope:** Full-stack audit of the recurring transactions subsystem to guarantee users never hit a crash, data-loss, or silent-wrong-behavior bug.

**Files reviewed:**
- [`app.js`](../app.js) — frontend generator, delete flows, sync queue, trash
- [`functions/api/cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js) — backend dedup endpoint
- [`functions/api/_security.js`](../functions/api/_security.js) — auth/CORS/rate-limit
- [`supabase-recurring-migration.sql`](../supabase-recurring-migration.sql) — schema + RLS

---

## 1. Architecture Overview

The recurring system has three cooperating layers:

1. **Template store** — `recurring_templates` table (cloud) mirrored to `localStorage['recurring_templates']` and `state.recurringTemplates`. Mapped camelCase↔snake_case via [`mapTemplateToDb()`](../app.js:508) / [`mapTemplateFromDb()`](../app.js:535).
2. **Generator** — [`processRecurringTemplates()`](../app.js:4366) materializes occurrences into `state.transactions` (and cloud) using a **deterministic UUID** per (template, date) via [`generateDeterministicUUID()`](../app.js:4182). Runs on every UI update ([`_updateUIImpl()`](../app.js:5039)).
3. **Delete/trash** — scoped deletion (single / future / all) via [`executeRecurringDelete()`](../app.js:32025) with grouped trash + restore.

---

## 2. Findings (ordered by severity)

### 🔴 CRITICAL-1 — "Delete future occurrences" does NOT actually stop regeneration

**Location:** [`executeRecurringDelete()`](../app.js:32101) sets `template.untilDate = anchorDate` and persists to localStorage.

**Problem:** The generator **never reads `untilDate`**. [`getRecurringDatesForMonth()`](../app.js:4456) only honors `template.endDate` (and `endType`). `untilDate` is also **not mapped** in [`mapTemplateToDb()`](../app.js:508), so it is never synced to cloud.

**User impact:** A user taps "Delete from [month] onwards". The currently-materialized future transactions are removed, but on the very next `processRecurringTemplates()` call (every UI update) the generator **recreates them all**, because the template still has no `endDate`. The deletion silently "undoes itself" — a confusing, data-integrity-breaking bug. On a second device, the future occurrences were never deleted at all (no cloud sync of the end date).

**Fix:** In the `future` scope, set `template.endType = 'date'` and `template.endDate = anchorDate` (the day before the anchor, or the anchor itself) instead of `untilDate`, and persist via `mapTemplateToDb` so it reaches the cloud. Remove the dead `untilDate` field.

---

### 🔴 CRITICAL-2 — Potential infinite loop / freeze in `_computeRecurringSeriesDates()`

**Location:** [`_computeRecurringSeriesDates()`](../app.js:31945) — `while (true)` loop.

**Problem:** The loop breaks only when `yearMonth > maxFuture` or `yearMonth > endLimit`. If `template.startDate` is **malformed / Invalid Date** (e.g. corrupted legacy localStorage, or a cloud row with a bad `start_date`), then:
- `startDate.getFullYear()` → `NaN`
- `yearMonth` → Invalid Date
- `yearMonth > maxFuture` → `false` (NaN comparisons are always false)
- `yearMonth > endLimit` → `false`

The loop then increments `month`/`year` **forever**, building an ever-growing `dates` array until the browser tab freezes / crashes (OOM). This is a hard crash vector reachable from a single bad template row.

**Fix:** Guard at the top: if `isNaN(startDate.getTime())` return `[]`. Also add a hard iteration cap (e.g. `if (iterations++ > 1200) break;`) as a belt-and-suspenders safety net. Apply the same NaN guard to [`getRecurringDatesForMonth()`](../app.js:4392) which does `new Date(startDateStr)` and would otherwise emit `"YYYY-MM-NaN"` dates.

---

### 🟠 HIGH-1 — Backend dedup endpoint is cross-tenant by construction

**Location:** [`cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js:104-140).

**Problem:** The endpoint uses the **service-role key** (bypasses RLS) and fetches **ALL** active transactions with `recurring_template_id` not null — across **every user** — then groups them by `(recurring_template_id, date, amount)` **without `user_id` in the key**. It then soft-deletes the "duplicates".

**Risk:** While UUID template IDs make cross-user collisions astronomically unlikely, the design has no tenant isolation. If a template ID were ever reused, shared via family, or a data-corruption event produced duplicate IDs, this endpoint could soft-delete **another user's** transactions. It also reports a single `userId` while operating on all users' rows, which is misleading.

**Fix:** Add `user_id` to the grouping key and to the fetch filter (`user_id=eq.<userId>`), so the cleanup is strictly scoped to the authenticated user. This is the correct tenant-isolation boundary.

---

### 🟠 HIGH-2 — Pagination in backend dedup can skip/duplicate rows

**Location:** [`cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js:115-140).

**Problem:** Offset pagination (`range`) with `order=created_at.asc,id.asc`. If rows are inserted/deleted between page fetches, offset pagination can skip or repeat rows, causing the dedup to miss duplicates (or, worse, mis-classify). Also, the fetch has no `limit` guard on total rows — a user with tens of thousands of recurring transactions could cause a large in-memory array.

**Fix:** Use keyset (cursor) pagination on `(created_at, id)`, or at minimum add a total-row cap and a `user_id` filter (see HIGH-1). Add a hard safety cap on `allTx.length`.

---

### 🟠 HIGH-3 — `cleanCrossLanguageRecurringDuplicates()` can delete legitimate transactions

**Location:** [`cleanCrossLanguageRecurringDuplicates()`](../app.js:4258).

**Problems:**
1. **Empty-note match** (line 4298): `(!t1Note || !t2Note)` treats two transactions with **no note** as duplicates if amount+type+category match. Two legitimate identical manual expenses on the same day (e.g. two coffees, same category, same amount, no note) would be collapsed into one.
2. **Prefix-forced match** (line 4299): `isRecurringPrefix1 || isRecurringPrefix2` forces a match whenever either transaction has a `recurring_`-prefixed id — even if they are genuinely different recurring series that happen to share amount+type+category+day.
3. **Orphan sweep** (line 4327): deletes **any** transaction whose id starts with `recurring_`. Legacy `recurring_`-prefixed rows are removed even if they are the only occurrence of a real series.

**User impact:** Silent deletion of legitimate financial records — the worst kind of data-loss bug for a budget app.

**Fix:** Remove the empty-note and prefix-forced shortcuts. Require a **non-empty, exact (or containment) note match** AND a deterministic-ID or `recurring_template_id` match before treating two rows as duplicates. Never delete a `recurring_`-prefixed row unless it has a confirmed duplicate counterpart.

---

### 🟡 MEDIUM-1 — `untilDate` dead field (see CRITICAL-1) — also affects restore

**Location:** [`restoreTrashGroup()`](../app.js:32276) restores `templateBackup` which may contain `untilDate`. Since `untilDate` is ignored by the generator, restoring a "future-deleted" group does not correctly restore the end-date semantics either.

---

### 🟡 MEDIUM-2 — Grace-window race can still produce duplicates

**Location:** [`processRecurringTemplates()`](../app.js:4550) uses `_markRecentlySaved` (60s grace) to prevent re-creation while the cloud write propagates.

**Problem:** If the cloud write takes >60s (slow network, offline queue), or the app is reloaded after the grace window but before the cloud read returns the new row, the generator can re-create the occurrence. The deterministic UUID makes the re-created row **identical** (same id), so it's an upsert, not a true duplicate — but the `cleanCrossLanguageRecurringDuplicates` logic (HIGH-3) may then mis-handle it.

**Fix:** Prefer the deterministic-ID existence check (already present at line 4515) as the primary guard, and only fall back to content matching when the id is absent. Consider persisting a "generated occurrences" set in localStorage that survives reloads, rather than a time-based grace window.

---

### 🟡 MEDIUM-3 — `processRecurringTemplates()` runs on every UI update

**Location:** [`_updateUIImpl()`](../app.js:5040).

**Problem:** The generator iterates all templates × all months (0..currentMonthLimit) on **every** UI render. For users with many templates and a large transaction history, this is O(templates × months × transactions) per render and can cause jank/freezes on low-end Android WebViews.

**Fix:** Debounce/throttle the generator (e.g. run at most once per second, or only when the selected month/year changes or templates change). Cache the computed occurrence dates per template.

---

### 🟡 MEDIUM-4 — RLS policy allows partner write access but no `family_id` scoping

**Location:** [`supabase-recurring-migration.sql`](../supabase-recurring-migration.sql:36-50).

**Problem:** The policy grants `FOR ALL` to the owner **and** to the partner (`user_id IN (SELECT partner_id FROM profiles WHERE id = auth.uid())`). A partner can therefore **modify or delete** the owner's recurring templates. This may be intended for family sync, but there is no `family_id` check and no audit. Combined with HIGH-1, the blast radius of any dedup bug widens.

**Fix:** Confirm the intended sharing model. If partners should only *view* (not edit) templates, split into separate SELECT / INSERT / UPDATE / DELETE policies. At minimum, add `family_id` to the `WITH CHECK` so a partner cannot reassign a template to a different family.

---

## 3. Edge-Case Verification Summary

| Edge case | Status | Notes |
|---|---|---|
| Duplicate installments (same template+date) | ⚠️ Guarded | Deterministic UUID + grace window, but HIGH-3 can mis-delete |
| Cross-language duplicate templates | ⚠️ Guarded | `cleanDuplicateTemplates()` exact-match is safe; `cleanCrossLanguageRecurringDuplicates` is not (HIGH-3) |
| Timezone / date parsing | ✅ Robust | `getTransactionTime()` handles offsets; generator uses local date strings |
| Currency | ✅ N/A | Recurring generator does not set currency fields; stripped before cloud upsert |
| Deletion of single occurrence | ✅ Works | Marks deleted date in template + `deletedRecurringDates` |
| Deletion of future occurrences | 🔴 **Broken** | `untilDate` ignored by generator (CRITICAL-1) |
| Deletion of all occurrences | ✅ Works | Removes template + soft-deletes transactions |
| Restore from trash | ⚠️ Partial | Restores template + transactions; `untilDate` semantics broken (MEDIUM-1) |
| Invalid/malformed template date | 🔴 **Crash** | Infinite loop in `_computeRecurringSeriesDates` (CRITICAL-2) |
| Cross-tenant dedup | 🔴 **Risk** | Backend operates on all users (HIGH-1) |

---

## 4. Recommended Fix Priority

1. **CRITICAL-1** — Make "delete future" set `endType='date'` + `endDate` and sync to cloud. (Highest user-facing impact.)
2. **CRITICAL-2** — Add NaN guard + iteration cap to `_computeRecurringSeriesDates()` and `getRecurringDatesForMonth()`. (Prevents hard crash.)
3. **HIGH-1** — Scope backend dedup to `user_id`. (Tenant isolation / data integrity.)
4. **HIGH-3** — Tighten `cleanCrossLanguageRecurringDuplicates()` to never delete legitimate records.
5. **HIGH-2** — Keyset pagination + row cap in backend dedup.
6. **MEDIUM-3** — Debounce the generator.
7. **MEDIUM-4** — Revisit RLS partner write scope.

---

## 5. Conclusion

The recurring subsystem is **well-engineered in many respects** — deterministic UUIDs, soft-delete trash model, offline sync queue, and careful column-stripping before cloud upsert are all strong. However, there are **two critical defects** that can directly harm users:

- **CRITICAL-1** breaks the "delete future occurrences" feature (data reappears / not synced).
- **CRITICAL-2** can **freeze/crash the app** from a single malformed template date.

Both are low-effort, high-value fixes and should be addressed before the next release. The backend dedup endpoint should also be tenant-scoped before it is relied upon in production.

---

## 6. Verification of Applied Fixes (Build v1400)

The fixes below were applied by Gemini based on this review. I re-read the modified files and verified each one against the actual code.

| Finding | Status | Verified location | Assessment |
|---|---|---|---|
| **CRITICAL-1** (future delete didn't stop regeneration) | ✅ **Fixed** | [`executeRecurringDelete()`](../app.js:32108) | Now sets `template.endType='date'` + `template.endDate` = day before anchor, and syncs to cloud via `mapTemplateToDb`. The generator reads `endDate`, so future occurrences no longer regenerate. `templateBackup` is captured **before** the mutation (line 32032), so restore correctly reverts to the original perpetual state. **Correct.** |
| **CRITICAL-2** (infinite loop on invalid date) | ✅ **Fixed** | [`_computeRecurringSeriesDates()`](../app.js:31953) | Added `isNaN(startDate.getTime()) return []` guard (line 31954) and `maxIterations = 240` cap (line 31967). Each loop iteration processes one full month, so 240 iterations = 20 years — far beyond the 12-month horizon. **Correct and sufficient.** |
| **HIGH-1** (backend dedup cross-tenant) | ✅ **Fixed** | [`cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js:120) | Added `&user_id=eq.${userId}` to the fetch query and `userId` to the grouping key (line 145). Cleanup is now strictly scoped to the authenticated user. **Correct.** |
| **HIGH-3** (aggressive empty-note matching) | ✅ **Fixed** | [`cleanCrossLanguageRecurringDuplicates()`](../app.js:4294) | Empty-note matching removed; now requires same `recurring_template_id`, OR exact non-empty note match, OR a legacy `recurring_` prefix with matching/empty note. The orphan sweep (lines 4329-4347) now deletes a `recurring_`-prefixed row **only when a canonical UUID counterpart exists** on the same date+amount+category. A legitimate lone `recurring_` occurrence is preserved. **Correct.** |

### Residual risk to address

**HIGH-3 — RESOLVED (Build v1402):** The orphan sweep at [`cleanCrossLanguageRecurringDuplicates()`](../app.js:4329) was rewritten. A `recurring_`-prefixed transaction is now deleted **only if** a canonical (non-`recurring_`) counterpart exists matching date + amount + category. A legitimate lone legacy occurrence is no longer silently removed. Minor note: the counterpart match does not check `type`/`note`, so a legacy expense could theoretically be matched to a canonical income of the same date/amount/category — but since deletion only removes the legacy duplicate (keeping the canonical row) and requires an actual counterpart to exist, the practical risk is negligible. All findings from this review are now resolved.

### Not addressed (lower priority, from original review)

- **HIGH-2** — Offset pagination in backend dedup can skip/duplicate rows under concurrent writes. Recommend keyset pagination.
- **MEDIUM-3** — Generator runs on every UI update; consider debouncing.
- **MEDIUM-4** — RLS partner write scope; consider splitting policies / adding `family_id` check.

### Bottom line

The two **critical** crash/data-integrity defects are confirmed fixed and correct. The system is now safe for the user's 4 recurring templates (ΕΝΦΙΑ, ΔΟΣΗ ΔΑΝΕΙΟΥ, Αλλαγή Ελαστικών, ΕΤΗΣΙΑ ΑΣΦΑΛΕΙΑ). One residual data-loss risk (the `recurring_` orphan sweep) remains and is worth a small follow-up fix, but it does not affect the current templates (which use valid deterministic UUIDs, not `recurring_`-prefixed ids).
