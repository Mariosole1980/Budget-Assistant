# Duplicate/Dead Code Finding — Category Budget Functions (app.js)

**Status:** Documented only — NO app.js behavior change in this remediation phase.
**Phase:** Remediation Priority 2 (duplicate/dead code analysis)
**Date:** 2026-08-09
**Scope:** `app.js` only. No UI, DB, Family, or OTA changes.

---

## 1. Summary

`app.js` contains **two complete blocks** of 5 category-budget functions that are
duplicated. Due to JavaScript function-declaration hoisting, the **second block**
(lines 6835–7080) is the **active** implementation, and the **first block**
(lines 6523–6833) is **dead** (overridden, never executed).

However, the two blocks are **not functionally identical**. The dead first block
supports **subcategory budgets**; the active second block **silently drops**
subcategory support. The HTML modal and single-instance helper functions prove that
subcategory budgets are a **real, intended feature** that the active code has
regressed.

**Decision (per user):** Document this finding. Do **not** change `app.js` behavior
in this remediation phase. The regression is real but fixing it is a behavior change
outside the "remove proven dead/duplicate code only" scope.

---

## 2. The 5 Duplicate Function Pairs

| Function | Block 1 (dead) | Block 2 (active) | Identical? |
|---|---|---|---|
| `renderCategoryBudgetsView` | 6523–6643 | 6835–6950 | No |
| `openCategoryBudgetModal` | 6682–6747 | 6953–6996 | No |
| `setBudgetAmountPreset` | 6750–6755 | 6999–7004 | **Yes** |
| `selectBudgetScope` | 6758–6771 | 7007–7020 | **Yes** |
| `saveCategoryBudgetFromModal` | 6774–6832 | 7023–7079 | No |

Each function ends with a `window.<fn> = <fn>;` assignment in both blocks.

---

## 3. Which Block Is Active?

Both blocks are top-level `function` declarations in the same scope. In JavaScript,
function declarations are hoisted and the **last declaration wins**. Therefore:

- **Block 2 (6835–7080) is ACTIVE.**
- **Block 1 (6523–6833) is DEAD** (overridden, unreachable).

Call sites (`renderStatsTab` at 6487–6488 and 6286–6287) invoke the active Block 2
implementation.

---

## 4. Key Differences (Block 1 vs Block 2)

### 4.1 `renderCategoryBudgetsView`
- **Block 1** supports subcategories:
  - `b.subcategory` handling (6543–6547) reads `catGroups[...].subcategories?.[b.subcategory]`.
  - `titleLabel` shows `(subcategory)` (6578).
  - Edit button passes subcategory: `openCategoryBudgetModal('${b.category}', '${b.subcategory||''}')` (6594).
  - **BUG:** references `container` without defining it (6642 `container.innerHTML = ...`) → would throw `ReferenceError` if called.
- **Block 2**:
  - Defines `const container = document.getElementById('stats-budgets-container'); if (!container) return;` (6836–6837) — **fixes the bug**.
  - Uses only `catGroups[catInfo.name || b.category]?.amount` (6857) — **no subcategory**.
  - Edit button passes only category: `openCategoryBudgetModal('${b.category}')` (6901).

### 4.2 `openCategoryBudgetModal`
- **Block 1** signature `(targetCategoryName = null, targetSubcategory = null)`:
  - `seenCats` Set for dedup (6693).
  - Calls `onBudgetCategoryChange()` (6725, 6737) to populate/show the subcategory select.
  - Matches existing budget by category **and** subcategory (6715–6718).
- **Block 2** signature `(targetCategoryName = null)`:
  - No `seenCats` dedup.
  - No `onBudgetCategoryChange()` call.
  - No subcategory handling.

### 4.3 `setBudgetAmountPreset` — **Identical** in both blocks.

### 4.4 `selectBudgetScope` — **Identical** in both blocks.

### 4.5 `saveCategoryBudgetFromModal`
- **Block 1**:
  - Reads `subcatSelect` (6777), `subcategoryName` (6785).
  - Finds existing by `id` OR `(category + subcategory)` (6799).
  - Saves `subcategory: subcategoryName` (6806).
  - Toast includes subcategory (6826–6827).
- **Block 2**:
  - No `subcatSelect`.
  - Hardcodes `subcategory: ''` (7053).
  - Finds existing by `id` OR `category` only (7046).
  - Toast shows category only (7073).

---

## 5. Evidence That Subcategory Budgets Are an Intended Feature

The subcategory budget feature is **not** dead UI. It is wired into the modal and
has dedicated single-instance helper functions:

- `index.html` 3815: `#budget-modal-subcat-container` (subcategory select container).
- `index.html` 3820: `#budget-modal-subcategory` (subcategory `<select>`).
- `index.html` 3805: category `<select>` has `onchange="onBudgetCategoryChange()"`.
- `app.js` 6646: `getSubcategoriesForCategoryName(catName)` — defined **once**.
- `app.js` 6657: `onBudgetCategoryChange()` — defined **once**, exposed as
  `window.onBudgetCategoryChange` (6680), and referenced by the HTML `onchange`.

Because these helpers exist only once and the HTML wires them up, the intended
behavior is that the modal shows a subcategory selector and saves per-subcategory
budgets. The active Block 2 never calls `onBudgetCategoryChange()` and never reads
the subcategory select, so the feature is **silently disabled** in production.

---

## 6. Root Cause

This is a **botched merge / regression**. The subcategory budget feature was
implemented in Block 1. A later change introduced Block 2 (an older or divergent
variant) that:
1. Fixed Block 1's missing-`container` bug, but
2. Lost the subcategory support.

Because the second declaration wins via hoisting, the regression became the active
behavior without any explicit removal of the feature.

---

## 7. Recommended Fix (NOT applied in this phase)

The correct canonical implementation is **Block 1's subcategory logic** combined
with **Block 2's `container` guard**:

1. Keep Block 1's `renderCategoryBudgetsView` but add
   `const container = document.getElementById('stats-budgets-container'); if (!container) return;`
   at the top (fixing the ReferenceError).
2. Keep Block 1's `openCategoryBudgetModal(targetCategoryName, targetSubcategory)`
   (with `seenCats` dedup and `onBudgetCategoryChange()` calls).
3. Keep Block 1's `saveCategoryBudgetFromModal` (reads/saves subcategory).
4. Delete the dead Block 2 (6835–7080) entirely.
5. Keep the single-instance helpers `getSubcategoriesForCategoryName` and
   `onBudgetCategoryChange` unchanged.

This restores the intended subcategory budget feature and removes the duplicate
code. **This is a behavior change and was deferred by the user.**

---

## 8. Why Not Applied Now

Per the remediation scope:
- "Μην κάνεις γενικό cleanup του app.js. Μόνο αποδεδειγμένα dead/duplicate code."
  (No general app.js cleanup; only proven dead/duplicate code.)
- "Αν ένα finding είναι false positive ή ήδη λυμένο, τεκμηρίωσέ το, μην το αλλάξεις."
  (If a finding is a false positive or already solved, document it, don't change it.)

Removing the dead Block 1 alone would be safe (it is overridden), but **keeping**
Block 2 as canonical would permanently drop the subcategory feature. Restoring
subcategory support is a **behavior change** that must be approved separately.

---

## 9. Verification Notes

- `setBudgetAmountPreset` and `selectBudgetScope` are byte-identical in both blocks;
  only the duplicate declarations are redundant, not the logic.
- No other call sites reference the dead Block 1 functions beyond the shared
  `window.*` assignments (which are overwritten by Block 2).
- Removing Block 1 (6523–6833) would not change runtime behavior, because Block 2
  already overrides it. The only reason to keep Block 1 is to restore subcategory
  support (a separate decision).

---

## 10. Follow-up

- Decide whether to restore subcategory budgets (Section 7) in a future phase.
- If subcategory budgets are intentionally removed, then delete Block 1 and the
  now-unused helpers `getSubcategoriesForCategoryName` / `onBudgetCategoryChange`,
  and remove the subcategory elements from the modal HTML.
- Re-run the duplicate/dead code analysis after any change.
