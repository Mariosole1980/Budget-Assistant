# Phase 4 — Bilingual User Guide Extraction: Read-Only Analysis

**Status:** READ-ONLY ANALYSIS — NO FILES MODIFIED
**Date:** 2026-08-17
**Scope:** Determine whether the Bilingual User Guide section (~514 lines) can be safely extracted from `app.js` under the current OTA architecture (OTA delivers only `app.js` + `style.css`).

---

## 1. Executive Verdict

> **DO NOT IMPLEMENT**

The Bilingual User Guide is a **DOM-driven UI subsystem**, not a self-contained module. It is deeply coupled to `state`, `openModal()`/`closeModal()`, and — critically — to a **global function surface that is invoked via inline `onclick` handlers baked into `index.html`**, which is **NOT part of the OTA bundle**. Extracting it to a `js/*.js` module would break OTA-updated installs because the old bundled `index.html` would still call the guide globals, but the new module (not shipped by OTA) would never be loaded.

Additionally, the guide depends on `CURRENT_BUILD`, a constant defined in `index.html` (not OTA-updated), and on `getAppBuildVersion()` (an external global not defined in `app.js`).

---

## 2. Exact Lines / Functions Involved

The Bilingual User Guide block is delimited by a section banner at [`app.js:31315`](app.js:31315)–[`app.js:31317`](app.js:31317) and ends at [`app.js:31826`](app.js:31826) (immediately before the FROZEN recurring block banner at [`app.js:31829`](app.js:31829)). **Total: ~512 lines.**

| # | Symbol | Lines | Type |
|---|---|---|---|
| 1 | `window._userGuideLang` | [`app.js:31319`](app.js:31319) | module state (global) |
| 2 | `updateUserGuideHeaderBadges()` | [`app.js:31321`](app.js:31321)–31334 | function |
| 3 | `window.openUserGuideModal` | [`app.js:31336`](app.js:31336)–31341 | global fn |
| 4 | `window.toggleUserGuideLanguage` | [`app.js:31343`](app.js:31343)–31347 | global fn |
| 5 | `window.filterUserGuide` | [`app.js:31349`](app.js:31349)–31353 | global fn |
| 6 | `window.clearUserGuideSearch` | [`app.js:31355`](app.js:31355)–31359 | global fn |
| 7 | `window.toggleGuideChapter` | [`app.js:31361`](app.js:31361)–31366 | global fn |
| 8 | `window.jumpToGuideChapter` | [`app.js:31368`](app.js:31368)–31374 | global fn |
| 9 | `highlightGuideQuery()` | [`app.js:31376`](app.js:31376)–31381 | function |
| 10 | `const USER_GUIDE_DATA` | [`app.js:31383`](app.js:31383)–31757 | data (~375 lines) |
| 11 | `renderUserGuideContent()` | [`app.js:31759`](app.js:31759)–31826 | function |

> **Excluded:** [`onboardingShowGuide()`](app.js:30547) at line 30547 is a **separate** AI-Coach tour function (calls `openAdvisorChat`, `appendChatMessage`). It is NOT part of the Bilingual User Guide modal subsystem and is heavily coupled to the advisor subsystem. It is out of scope.

---

## 3. Dependencies

### 3.1 State (`state`)
- `state.lang` — [`app.js:31326`](app.js:31326), [`app.js:31337`](app.js:31337)
- `state.version` — fallback in [`app.js:31323`](app.js:31323)

### 3.2 External globals (NOT defined in app.js)
- `CURRENT_BUILD` — defined in **`index.html:5379`** (`const CURRENT_BUILD = 1406;`), **NOT in the OTA bundle**. Used at [`app.js:31323`](app.js:31323), [`app.js:31390`](app.js:31390), [`app.js:31392`](app.js:31392). Guarded with `typeof CURRENT_BUILD !== "undefined"` + fallbacks.
- `getAppBuildVersion()` — referenced at [`app.js:31323`](app.js:31323) but **not defined anywhere in app.js or any js/*.js module** (only appears in `scratch_app_v1387.js`, a scratch copy). It is a phantom/legacy fallback that never resolves; the code falls through to `state.version || 1157`.

### 3.3 Other app.js functions
- `openModal()` — [`app.js:9095`](app.js:9095), called at [`app.js:31340`](app.js:31340)
- `closeModal()` — [`app.js:9493`](app.js:9493), called from `index.html:1579` (`onclick="closeModal('user-guide-modal')"`)

### 3.4 DOM
- `document.getElementById(...)` for: `user-guide-version-badge`, `user-guide-date-badge`, `user-guide-lang-label`, `user-guide-search-input`, `user-guide-search-clear`, `user-guide-body`, `guide-chap-*` — all elements live in the modal markup at [`index.html:1550`](index.html:1550)–1603.

### 3.5 Data
- `USER_GUIDE_DATA` (local const, self-contained bilingual content — the only truly self-contained part).

---

## 4. Global Surface Requirements (the decisive coupling)

The guide is driven by **inline `onclick` handlers baked into `index.html`**:

| Handler | index.html location |
|---|---|
| `openUserGuideModal()` | [`index.html:2478`](index.html:2478) (Legal & Info settings row) |
| `toggleUserGuideLanguage()` | [`index.html:1575`](index.html:1575) |
| `filterUserGuide(this.value)` | [`index.html:1590`](index.html:1590) |
| `clearUserGuideSearch()` | [`index.html:1594`](index.html:1594) |
| `closeModal('user-guide-modal')` | [`index.html:1579`](index.html:1579) |
| `toggleGuideChapter(...)` | generated dynamically in [`renderUserGuideContent`](app.js:31807) |
| `jumpToGuideChapter(...)` | generated dynamically in [`renderUserGuideContent`](app.js:31781) |

The modal **markup itself** (the `#user-guide-modal` overlay, header, search box, body container) lives in `index.html:1550–1603`. **None of this is shipped by OTA.**

---

## 5. OTA-Safety Analysis (the decisive factor)

### The constraint
- OTA delivers only `app.js` + `style.css` to existing installs.
- `index.html` and all `js/*.js` files are **NOT** updated by OTA.

### Scenario A — Extract to a new `js/userGuide.js` module (loaded via index.html `<script>`)
1. **New installs (fresh APK):** `index.html` loads the new module → globals exist → guide works. ✅
2. **OTA-updated installs (old APK + new app.js):** old `index.html` still has the inline `onclick="openUserGuideModal()"` handlers and the modal markup, but the new module is **never loaded** (not in the OTA bundle, and old `index.html` has no `<script>` tag for it) → `openUserGuideModal is not defined` → **guide completely broken** (and the Legal & Info row throws on tap). ❌

### Scenario B — Extract to the existing `js/utils.js`
- Same failure as Scenario A: old bundled `utils.js` lacks the guide globals → `ReferenceError` on OTA-updated installs. ❌

### Scenario C — Keep in app.js (status quo)
- Works on all installs because app.js is always OTA-updated and the inline `onclick` handlers in old `index.html` resolve to the app.js globals. ✅

### The only OTA-safe extraction
Would require shipping the new module in the OTA bundle (add to OTA `ASSETS` + `sw.js`) **and** updating `index.html` to load it — but `index.html` is not OTA-updated, so old installs would still lack the `<script>` tag. **This is impossible without changing the OTA pipeline** (which is out of scope and a hard blocker).

### Additional OTA coupling
- `CURRENT_BUILD` lives in `index.html` (not OTA-updated). The guide reads it with `typeof` guards + fallbacks, so it degrades gracefully — but this confirms the guide is architecturally tied to non-OTA files.

---

## 6. Expected Line / Size Reduction

| Component | Lines | Est. bytes (≈42.6 B/line) |
|---|---|---|
| `USER_GUIDE_DATA` (bilingual content) | ~375 | ~16 KB |
| Guide functions + globals | ~137 | ~5.8 KB |
| **Total** | **~512 lines** | **~21.8 KB** |

- `app.js` is **32,538 lines / 1,387 KB**.
- **Reduction: ~1.6%** (~21.8 KB of 1,387 KB).

### Practical benefit
- Modest (~1.6%) but real. The bulk is static bilingual content (`USER_GUIDE_DATA`), which is genuinely self-contained and could be a separate data module.
- **However**, the ~137 lines of guide *logic* are inseparable from the DOM/state/global-function coupling, so only the data portion is cleanly extractable — and even that is blocked by OTA.

---

## 7. Regression Risk

| Component | Risk if OTA-safe | Notes |
|---|---|---|
| `USER_GUIDE_DATA` (data only) | **LOW** | Pure data; could be a constants-style module. |
| `renderUserGuideContent` | **MEDIUM** | DOM-heavy; depends on `USER_GUIDE_DATA`, `highlightGuideQuery`, `window._userGuideLang`. |
| Global handlers (`openUserGuideModal`, etc.) | **HIGH** | Invoked by inline `onclick` in non-OTA `index.html`; extraction breaks them on OTA installs. |
| `updateUserGuideHeaderBadges` | **MEDIUM** | Depends on `CURRENT_BUILD` (index.html), `state.lang`, `state.version`. |

> **Effective risk on the live user base is HIGH** because of the OTA/global-function coupling, regardless of the per-component ratings.

---

## 8. Exact Verification Plan (if it were OTA-safe — NOT applicable here)

Since the verdict is DO NOT IMPLEMENT, the verification plan is provided only for completeness/documentation:

1. **Static gate:** Run `npm test` and `node scripts/verify-health.js` — confirm no brace/backtick imbalance and version consistency.
2. **Global surface check:** After extraction, grep `index.html` for `openUserGuideModal|toggleUserGuideLanguage|filterUserGuide|clearUserGuideSearch|toggleGuideChapter|jumpToGuideChapter` and confirm each resolves to a loaded global.
3. **Fresh-install smoke test:** Build APK, open Legal & Info → User Guide, toggle EN/ΕΛ, search, jump chapters, close.
4. **OTA-upgrade simulation:** Install old APK, push new app.js via OTA, tap the guide — **expected to FAIL** (this is the blocker).
5. **Regression:** Verify `onboardingShowGuide()` (AI Coach tour) is unaffected.

---

## 9. Conclusion

**Verdict: DO NOT IMPLEMENT**

1. **The guide is a DOM/state/global-coupled UI subsystem**, not a pure module. Its logic (~137 lines) is inseparable from `state`, `openModal`/`closeModal`, and the inline `onclick` surface in `index.html`.
2. **OTA incompatibility is fatal.** The guide globals are invoked by inline handlers in `index.html`, which is **not** part of the OTA bundle. Extracting to any `js/*.js` module breaks the guide on every OTA-updated install (`openUserGuideModal is not defined`).
3. **The only OTA-safe path requires changing the OTA pipeline** (shipping the new module + updating `index.html`), which is explicitly out of scope and reported as a **blocker**.
4. **Benefit is modest** (~1.6% / ~21.8 KB), dominated by static content that is already self-contained but still blocked by OTA.
5. **Additional coupling:** `CURRENT_BUILD` (defined in `index.html`, not OTA) and the phantom `getAppBuildVersion()` global confirm the guide is architecturally tied to non-OTA files.

**Recommendation:** Leave the Bilingual User Guide inside `app.js`. If the ~375-line `USER_GUIDE_DATA` content ever needs to be separated, that requires an OTA-pipeline change (ship the module + update `index.html`), which is a separate architectural decision and out of scope for this phase.
