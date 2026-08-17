# Phase 2 — Notes Subsystem Extraction: Read-Only Dependency & Risk Analysis

**Status:** READ-ONLY ANALYSIS ONLY — no files were modified.
**Scope:** Proposed extraction of the Notes subsystem (~1,966 lines) out of the `app.js` monolith (32,538 lines, 1,387 KB) into a separate module.
**Date:** 2026-08-17

---

## 1. Executive Summary / Recommendation

> ## ⛔ DO NOT IMPLEMENT (as a separate `js/notes.js` module loaded via index.html `<script>` tag)

The Notes subsystem **cannot be safely extracted** into a separate module loaded via an `index.html` `<script>` tag, because of a **fatal OTA (Over-the-Air) incompatibility** combined with **heavy bidirectional coupling** and **interspersed non-Notes code**.

The only OTA-safe extraction pattern would require embedding a full self-sufficiency fallback *inside* `app.js` (like the CurrencyService bootstrap at [`app.js:1-416`](app.js:1)), which **defeats the entire size-reduction purpose** of the extraction. There is no clean win here.

---

## 2. What Belongs to the Notes Subsystem

### 2.1 Module-level state (in the Notes block)
Defined at [`app.js:16136-16139`](app.js:16136):
- `_currentEditingNoteId`
- `_currentEditingNotePinned`
- `_currentEditingNoteType`
- `_currentEditingNoteColor`

Additional module-level state inside the block:
- `_notesFilterCategory` (~[`app.js:16515`](app.js:16515))
- `_notesViewMode` (~[`app.js:16516`](app.js:16516))
- `_contextMenuNoteId` (~[`app.js:16620`](app.js:16620))
- `_noteAutoSaveTimer` (used by `closeNoteEditor`)

### 2.2 Functions (≈60)
The block spans [`app.js:16133-18098`](app.js:16133) (section header at 16133, last window-global assignment at 18098). Representative functions include:

**Editor / UI:**
`translateNotepadUI`, `restoreNoteEditorInitialPosition`, `bindNoteEditorFocusScroll`, `selectNoteColor`, `applyNoteReminderString`, `triggerCustomReminderInput`, `toggleNoteEditorColorPalette`, `toggleNoteEditorReminderTools`, `handleNoteEditorOverlayClick`, `openNoteEditor`, `closeNoteEditor`, `toggleNoteEditorPin`, `updateNoteEditorPinUI`, `onNoteReminderChanged`, `clearNoteEditorReminder`, `setNoteEditorType`, `addNoteEditorChecklistItemRow`, `addNoteEditorChecklistItem`, `saveNoteFromEditor`, `deleteNoteFromEditor`, `updateNoteEditorReminderDisplay`

**List / manager:**
`renderNotesList`, `setNotesFilterCategory`, `toggleNotesViewMode`, `showNoteContextMenu`, `quickSetNoteColor`, `triggerContextPin/Edit/Copy/Reminder/Delete`

**Persistence / sync:**
`loadNotes`, `saveNotes`, `deleteNote`, `toggleNotePinInline`, `upsertNoteToCloud`, `buildNotesScopeQuery`, `mergeNotes`, `mapNoteToDb`, `syncNotes`, `fetchNotesTrashFromCloud`

**Trash bin:**
`loadNotesTrash`, `saveNotesTrash`, `restoreNote`, `deleteNotePermanently`, `emptyNotesTrash`, `renderNotesTrashList`, `openNotesTrashModal`, `updateNotesTrashBadge`

### 2.3 Window globals exposed (must remain `window.*`)
At [`app.js:18071-18098`](app.js:18071) plus earlier assignments (16210, 16235, 16278, 16372, 16469, 16474, 16868, 16881, 16888-16951, 17015, 17025, 17032, 17138, 17672, 17834-17841). These are required by:
- `index.html` inline `onclick`/`onchange`/`oninput` handlers (see §4.2)
- External app.js callers (see §4.1)

---

## 3. Dependencies of the Notes Subsystem on app.js

The Notes subsystem is **heavily coupled** to app.js globals and the central `state` object:

| Dependency | Count in Notes block | Type |
|---|---|---|
| `state.` (central mutable state) | 142 | shared mutable global |
| `document.getElementById` | 70 | DOM |
| `document.querySelector` | 15 | DOM |
| `localStorage` | 8 | storage |
| `showToast` | 10 | app.js global fn |
| `closeModal` | 7 | app.js global fn |
| `openModal` | 3 | app.js global fn |
| `debounce` | 3 | app.js global fn |
| `escapeHtml` | 1 | app.js global fn |

**Implication:** The Notes module would depend on `state`, `openModal`, `closeModal`, `showToast`, `debounce`, `escapeHtml` — all defined in app.js. This is a **bidirectional (circular) dependency** at the module level:
- app.js → calls Notes functions (`syncNotes`, `renderNotesList`, `openNoteEditor`, `loadNotes`, `loadBudgets`)
- Notes → calls app.js functions (`openModal`, `closeModal`, `showToast`, `debounce`, `escapeHtml`)

Because everything is global, this resolves at runtime *only if* both scripts are loaded and calls happen after both are parsed. This creates a **fragile load-order dependency** and makes the module non-self-contained.

---

## 4. External Callers of Notes Functions

### 4.1 Direct callers inside app.js (outside the Notes block)

| Line | Caller | Function called | Guarded? |
|---|---|---|---|
| [`app.js:881`](app.js:881) | `applyLanguage` | `translateNotepadUI()` | ✅ `typeof` |
| [`app.js:1329`](app.js:1329) | `handleNotificationAction` | `openNoteEditor()` | ❌ direct |
| [`app.js:1571`](app.js:1571) | notification handler | `openNoteEditor()` | ❌ direct |
| [`app.js:2076`](app.js:2076) | `initApp` | `updateNotesTrashBadge()` | ✅ `typeof` |
| [`app.js:4104`](app.js:4104) | `loadOfflineData` | `loadNotes()` | ❌ direct |
| [`app.js:4105`](app.js:4105) | `loadOfflineData` | `loadBudgets()` (Category Budgets) | ❌ direct |
| [`app.js:5136`](app.js:5136) | `_updateUIImpl` | `renderNotesList()` | ❌ direct |
| [`app.js:8010`](app.js:8010) | `setupEventListeners` | `renderNotesList()` | ❌ direct |
| [`app.js:8017`](app.js:8017) | `setupEventListeners` | `openNoteEditor()` | ❌ direct |
| [`app.js:9451`](app.js:9451) | `switchTab` | `renderNotesList()` | ❌ direct |
| [`app.js:23480`](app.js:23480) | `forceSyncNow` | `await syncNotes()` | ❌ direct |
| [`app.js:25594`](app.js:25594) | custom date picker | `updateNoteEditorReminderDisplay()` | ✅ `typeof` |
| [`app.js:25915`](app.js:25915) | `openNotesManager` | `renderNotesList()` | ❌ direct |
| [`app.js:25916`](app.js:25916) | `openNotesManager` | `updateNotesTrashBadge()` | ✅ `typeof` |

**Critical:** **9 of 14 external callers are NOT `typeof`-guarded.** If Notes is removed from app.js, these direct calls throw `ReferenceError: X is not defined` at runtime.

### 4.2 index.html inline handlers (resolve to `window.*` globals)
Confirmed at [`index.html:1453-1532`](index.html:1453) (notes manager) and [`index.html:4641-4815`](index.html:4641) (note editor modal):
`toggleNotesViewMode`, `openNotesTrashModal`, `renderNotesList`, `setNotesFilterCategory`, `emptyNotesTrash`, `handleNoteEditorOverlayClick`, `closeNoteEditor`, `toggleNoteEditorPin`, `toggleNoteEditorReminderTools`, `toggleNoteEditorColorPalette`, `deleteNoteFromEditor`, `selectNoteColor`, `clearNoteEditorReminder`, `onNoteReminderChanged`, `setNoteEditorType`, `addNoteEditorChecklistItem`, `triggerContextPin/Edit/Copy/Reminder/Delete`.

These are **all** `window.*` references. If Notes is extracted and removed from app.js, and the running `index.html` does not load the new module, **every one of these inline handlers throws** when clicked.

### 4.3 web-ui.js
No references to Notes functions found. ✅

---

## 5. OTA-Safety Analysis (CRITICAL)

### 5.1 The OTA mechanism
- The Capgo OTA bundle is generated by [`scripts/release-native.js:86`](scripts/release-native.js:86): `npx @capgo/cli bundle zip com.budgetassistant.app ...`.
- **Authoritative project evidence** (developer comments in app.js) confirms the OTA bundle ships **only `app.js` + `style.css`**, NOT `index.html` or the `js/` modules:
  - [`app.js:4-8`](app.js:4) (CurrencyService bootstrap): *"The OTA engine only downloads app.js + style.css, NOT index.html or the other js/ files."*
  - [`app.js:18607`](app.js:18607): *"so it also works on devices that receive OTA updates, which only replace app.js/style.css and NOT index.html."*
  - [`app.js:18672`](app.js:18672): *"On installed devices the stale index.html may lay the input over the symbol area."*
- The `sw.js` ASSETS list ([`sw.js:4-29`](sw.js:4)) does **not** include the extracted `js/` modules (transactionMerge, utils, constants, translations, receiptStorage).

### 5.2 Why extraction breaks OTA-updated installs
If Notes is extracted to `js/notes.js` loaded via a new `<script>` tag in `index.html`:
1. **OTA-updated installs** get the NEW `app.js` (Notes removed) but keep the OLD bundled `index.html` (no `notes.js` script tag).
2. Result: Notes functions are **missing** from the global scope.
3. Every inline `onclick` handler in the old `index.html` (see §4.2) throws `ReferenceError`.
4. Every unguarded direct caller in the new `app.js` (see §4.1) throws `ReferenceError`.
5. **The Notes feature is completely broken** on all OTA-updated installs until the user installs a new APK.

### 5.3 The self-sufficiency guard pattern (and why it defeats the purpose)
The CurrencyService bootstrap ([`app.js:1-416`](app.js:1)) is the established pattern: it embeds a **full fallback implementation inside app.js** so the global is always available even when the module isn't loaded. Applying this to Notes would require embedding ~1,966 lines of fallback inside app.js — **negating the entire size reduction** (the module would still be ~78.8 KB inside app.js, plus the separate file).

**Conclusion:** There is **no OTA-safe extraction** that also achieves meaningful size reduction. The two goals are mutually exclusive under the current OTA pipeline.

---

## 6. Structural Finding: Interspersed Category Budgets Code

The Category Budgets functions are **interspersed in the middle of the Notes block**:
- `openNotesTrashModal` ends at [`app.js:17831`](app.js:17831)
- **`loadBudgets`** at [`app.js:17846`](app.js:17846)
- **`saveBudgets`** at [`app.js:17856`](app.js:17856)
- **`syncBudgets`** at [`app.js:17864`](app.js:17864)
- `toggleNoteEditorPin` resumes at [`app.js:17959`](app.js:17959)

These are **NOT** Notes functions — they belong to the Category Budgets subsystem. A clean Notes extraction must **split the block** and leave `loadBudgets`/`saveBudgets`/`syncBudgets` (and their `window.*` assignments at 17955-17957) in app.js. This complicates the "move lines 16133-18098" operation into a non-contiguous extraction.

---

## 7. Exact Lines / Functions to Move (if it were attempted)

- **Notes block:** [`app.js:16133-18098`](app.js:16133) (1,966 lines, ~78.8 KB)
- **Minus** the interspersed Category Budgets functions:
  - `loadBudgets` [`app.js:17846-17854`](app.js:17846)
  - `saveBudgets` [`app.js:17856-17862`](app.js:17856)
  - `syncBudgets` [`app.js:17864-17954`](app.js:17864)
  - `window.loadBudgets/saveBudgets/syncBudgets` [`app.js:17955-17957`](app.js:17955)
- **Net Notes extraction:** ~1,950 lines (~78 KB)

### Size reduction
- app.js: 32,538 lines / 1,387 KB
- Notes block: 1,966 lines / ~78.8 KB = **~6.0% of lines, ~5.7% of bytes**
- After extraction: app.js ≈ 30,590 lines / ~1,308 KB

**The size reduction is modest (~6%)** and is entirely negated by the OTA self-sufficiency guard requirement.

---

## 8. Benefits vs Regression Risk

### Benefits
- ~6% reduction in app.js size (marginal).
- Logical separation of the Notes feature (maintainability).
- Could enable isolated unit testing of pure functions (`mergeNotes`, `mapNoteToDb`, `buildNotesScopeQuery`).

### Regression risk (HIGH)
1. **OTA breakage (fatal):** Notes feature completely broken on all OTA-updated installs (§5.2).
2. **9 unguarded direct callers** in app.js throw `ReferenceError` (§4.1).
3. **~20 inline handlers** in index.html throw `ReferenceError` (§4.2).
4. **Circular dependency** between app.js and the Notes module (§3).
5. **Interspersed Category Budgets** code complicates the extraction (§6).
6. **Load-order fragility:** module must load before app.js calls its functions, but after app.js defines `state`/`openModal`/`showToast` — a narrow, fragile window.
7. **sw.js** does not precache the new module; network-first with cache fallback could serve a stale/missing module.

---

## 9. Verification Plan (if it were attempted)

1. `node --check app.js` and `node --check js/notes.js` — syntax.
2. `npm test` (62/62) — existing unit tests.
3. `scripts/verify-health.js` — static safety gate (0 FAIL).
4. `scripts/version-sync.js` — regenerate `www/` mirror; `fc /b` confirm byte-identical.
5. Puppeteer smoke test: open notes manager, create/edit/delete note, toggle pin, reminder, checklist, trash restore.
6. **OTA simulation:** load new app.js with OLD index.html (no notes.js script tag) → confirm Notes inline handlers throw (this is the expected failure that proves the OTA problem).
7. Confirm no duplicate function definitions remain (each count = 1).

---

## 10. Unexpected / Ambiguous Findings

1. **The Notes block is ~1,966 lines, not ~1,400** as originally estimated — 40% larger.
2. **Category Budgets functions are physically inside the Notes block** — the extraction is not a clean contiguous cut.
3. **The OTA bundle ships only app.js + style.css** (confirmed by three developer comments in app.js), contradicting the general capacitor-updater README which describes the *intended* full-www bundle. The project's actual observed behavior is authoritative.
4. **9 of 14 external callers are unguarded** — the codebase does not consistently use `typeof` guards for Notes functions, unlike the guarded CurrencyService/ReceiptStorage calls.
5. **The self-sufficiency guard pattern defeats the size-reduction goal** — the two objectives are mutually exclusive under the current OTA pipeline.

---

## 11. Final Recommendation

> ## ⛔ DO NOT IMPLEMENT

The Notes subsystem extraction into a separate `js/notes.js` module is **not OTA-safe** and would break the Notes feature on all existing APK installations that receive OTA updates. The heavy bidirectional coupling (142 `state.` refs, 70 `getElementById`, app.js globals), the 9 unguarded external callers, the ~20 inline handlers, the interspersed Category Budgets code, and the modest ~6% size reduction all compound the risk with little benefit.

**If modularization is still desired**, the only viable path is a **design change** to the release pipeline first (e.g., make the OTA bundle ship the full `www/` directory including `index.html` and `js/`), then re-evaluate. That is out of scope for this analysis and would require a separate architecture decision.
