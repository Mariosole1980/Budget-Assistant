# Desktop Web UX — Pre-Release Audit Report

**Status:** Audit complete — NO version bump, NO commit, NO Cloudflare deploy, NO Android/OTA release performed.
**Date:** 2026-08-09
**Canonical version:** 1191 (`version.json`)
**Scope:** Full pre-release verification of the Desktop Web UX changes (Phase 1 foundation, Phase 2 navigation, Phase 2B dashboard) before any production release.

---

## 1. What Was Checked

| # | Check | Result |
|---|-------|--------|
| 1 | `git diff` + `git status` | ✅ Reviewed (see §3 for unrelated changes) |
| 2 | New `desktop.css` (647 lines) | ✅ Reviewed in full |
| 3 | New `web-ui.js` (595 lines) | ✅ Reviewed in full |
| 4 | `index.html` changes | ✅ Reviewed (desktop.css link, web-ui.js script, dashboard section) |
| 5 | `scripts/version-sync.js` | ✅ Reviewed + fixed (added desktop.css, web-ui.js to filesToMirror) |
| 6 | `www/` artifact | ✅ Re-synced after app.js fix |
| 7 | Root ↔ `www/` parity | ✅ All desktop files IDENTICAL |
| 8 | Android/mobile isolation (`html.web-mode`) | ✅ Confirmed |
| 9 | Dependency / script-loading order | ✅ Confirmed correct |
| 10 | Duplicate / conflicting CSS/JS | ✅ No duplicates; 1 intentional override (FAB) |
| 11 | `style.css` vs `desktop.css` conflicts | ✅ No breaking conflicts |
| 12 | `npm test` | ✅ 16/16 pass |
| 13 | `node --check` (web-ui.js, app.js, version-sync.js) | ✅ All pass |
| 14 | Release pipeline includes new files | ✅ Confirmed (deploys on-disk `www/`) |
| 15 | `?v=1191` hardcoding vs `version.json` source-of-truth | ✅ `version.json` remains source-of-truth (see §4) |

---

## 2. What Is Correct

### 2.1 Android / mobile isolation (CRITICAL — verified safe)
- `index.html` (line 199–201): `web-mode` class is added to `<html>` **only** when NOT running inside Capacitor (`!window.Capacitor.isNativePlatform()`).
- `desktop.css`: **all 80 rules** are scoped behind `html.web-mode`. Mobile safety guards present:
  ```css
  html:not(.web-mode) #dashboard-screen,
  html:not(.web-mode) .desktop-dashboard-nav { display: none !important; }
  html:not(.web-mode).dashboard-active #dashboard-screen { display: none !important; }
  ```
- `web-ui.js`: every entry point guarded by `isWebMode()` (checks for `web-mode` class). The `autoInit()` fallback also guards on `isWebMode()`.
- **Conclusion:** The native Android/iOS app is never affected. The dashboard is force-hidden on mobile.

### 2.2 Script / dependency loading order
- `desktop.css` loaded **after** `style.css` (line 165 after 160) so it can override.
- `app.js` loaded at line 5110; `web-ui.js` loaded with `defer` at line 5114 → runs after app.js.
- All functions `web-ui.js` depends on are accessible:
  - Top-level `function` declarations (auto window properties): `getActiveTransactions`, `computeNetWorth`, `getDisplayCurrency`, `formatCurrency`, `getTransactionTime`, `getCategoryInfo`, `getCategoryDisplayName`, `getAccountBalanceInBase`, `openAddTransactionModal`, `switchTab`.
  - Explicit window bindings: `escapeHtml`, `forceCloseAllModals`, `getAccountDisplayName`, `openAdvisorChat`.
  - `window.CurrencyService` (self-healing export).

### 2.3 Dashboard overlay design (correct)
- Dashboard is a **desktop-only overlay**, NOT a tab. It is independent of `state.activeTab`, `TAB_ORDER`, and `switchTab`.
- `showDashboard()` adds `.active` to the dashboard screen (so body tab-active `!important` rules don't force-hide it), adds `dashboard-active` to `<html>`, and hides other tab screens.
- `initSwitchTabHook()` wraps `switchTab` to hide the dashboard whenever any tab is switched — no conflict with the tab system.
- Idempotency guards present (double-injection prevention): `desktop-sidebar-brand`, `desktop-topbar-add`, `desktop-dashboard-nav`, `desktop-shortcuts-ready`, `__desktopSwitchTabHooked`.

### 2.4 `www/` parity (verified)
After re-running `node scripts/version-sync.js` (which mirrored the `window.state` fix), these files are byte-identical between root and `www/`:
`index.html`, `style.css`, `desktop.css`, `web-ui.js`, `app.js`, `sw.js`, `manifest.json`, `version.json`.
`node scripts/version-check.js` → `[PASS] Version Check PASSED for v1191`.

### 2.5 Tests & syntax
- `npm test` → **16/16 pass**.
- `node --check web-ui.js`, `node --check app.js`, `node --check scripts/version-sync.js` → all pass.

---

## 3. Potential Problems / Notes

### 3.1 FIXED — Critical `window.state` bug (release-blocking, now resolved)
`web-ui.js` reads `window.state` in many places, but `state` is a top-level `const` in `app.js` (line 437), which does **NOT** become a window property in classic scripts. `window.state` was `undefined`, which would have caused: accounts list always empty, language always Greek, activeTab detection failure.

**Fix applied:** Added `window.state = state;` to `app.js` (after line 481). This is required for release correctness. Verified in both root and `www/`.

### 3.2 Intentional FAB override (not a bug)
- `style.css` (line 4844) relocates the FAB on desktop (`html.web-mode .fab { position: fixed; bottom: 32px; right: 32px; }`).
- `desktop.css` (line 119) hides the FAB on desktop (`html.web-mode .fab { display: none !important; }`).
- Since `desktop.css` loads after `style.css` and both use `!important`, the FAB is hidden on desktop (replaced by topbar/sidebar "Νέα Κίνηση" buttons). This is intentional. **No action needed.**

### 3.3 Unrelated changes in the working tree (NOT part of desktop UX work)
The working tree contains many changes unrelated to the Desktop Web UX. These must be committed (or handled) before `release-deploy.js` will run, because it **aborts on a dirty tree** (Step 1). See §5 for the exact commit list.

### 3.4 `www/` is gitignored but 28 files are force-tracked (pre-existing)
- `.gitignore` ignores `www/`, but 28 files under `www/` are force-tracked (documented in `plans/tracked-www-artifacts.md`). The recommendation there was to untrack them.
- **Important:** The Cloudflare Pages deploy (`wrangler pages deploy www`) uploads the **on-disk** `www/` directory, NOT the git-tracked files. So `www/desktop.css` and `www/web-ui.js` (untracked, gitignored) **WILL be deployed** because they exist on disk. Verified present and identical to root.
- This is a pre-existing condition, not introduced by the desktop UX work. Not release-blocking for the web deploy.

### 3.5 Minor gap in `version-check.js` (recommendation, not blocking)
`version-check.js` verifies root↔www parity only for `version.json`, `sw.js`, `index.html`, `app.js`. It does **not** check `desktop.css`/`web-ui.js` parity. Since I added them to `filesToMirror` and verified parity manually, this is not a current problem. **Recommendation:** add `desktop.css` and `web-ui.js` to the `filesToCompare` array in `version-check.js` for future safety.

---

## 4. `?v=1191` Hardcoding vs `version.json` Source-of-Truth — Evaluation

**Conclusion: `version.json` remains the source of truth. The hardcoded `?v=1191` is correct and self-healing — no change needed.**

Rationale:
1. `version-sync.js` (line 30) runs:
   ```js
   indexContent = indexContent.replace(/(\.js|\.css|\.json)\?v=\d+/g, `$1?v=${version}`);
   ```
   This rewrites **all** `?v=\d+` references in `index.html` (including `desktop.css?v=1191` and `web-ui.js?v=1191`) to the current version from `version.json` on every sync.
2. On the next release, `version-bump.js` increments `version.json`, then `version-sync.js` rewrites the hardcoded values to the new version. The hardcoded `1191` is just the current snapshot matching `version.json`.
3. This is consistent with how `app.js?v=1191` is already handled. `style.css` has no version param (pre-existing), but `desktop.css`/`web-ui.js` having `?v=` is **good** — it ensures cache-busting for the new files on each release.

**No action required.** The hardcoded value is not a maintenance hazard because version-sync auto-updates it.

---

## 5. Exactly Which Files to Commit

### 5.1 Desktop Web UX files (this work — MUST commit)
- `desktop.css` (new)
- `web-ui.js` (new)
- `app.js` (modified — `window.state` fix)
- `index.html` (modified — desktop.css link, web-ui.js script, dashboard section, version bumps)
- `scripts/version-sync.js` (modified — added desktop.css, web-ui.js to filesToMirror)
- `plans/web-ux-architecture.md` (new — design doc)
- `plans/web-ux-pre-release-audit.md` (new — this report)

### 5.2 Version-sync artifacts (regenerated by version-sync; commit to keep tree clean)
- `style.css`, `sw.js`, `version.json`, `manifest.json`, `icon.png`, `icon-192.png`
- `www/app.js`, `www/index.html`, `www/style.css`, `www/sw.js`, `www/version.json`, `www/manifest.json`, `www/icon.png` (tracked www files)

### 5.3 Unrelated changes present in the tree (NOT desktop UX work — decide separately)
- Android icon changes (`android/app/src/main/res/mipmap-*`, `drawable*`, `values/ic_launcher_background.xml`)
- `assets/` icon changes, `assets/logo/` (new)
- `node_modules/` changes (should NOT be committed — gitignored, but some tracked files drifted)
- `.wrangler/cache/pages.json`
- `package.json`
- `functions/api/cleanup-recurring-duplicates.js` (new)
- `scripts/generate-android-icons.js`, `scripts/generate-app-icon-variants.js`, `scripts/generate-logo.js` (new)
- `android/app/build.gradle` (version-sync touched versionCode/versionName)

> **Note:** `release-deploy.js` requires a **clean git tree** before it will run. All of the above (including unrelated changes) must be committed or stashed before any release. The unrelated changes should be reviewed/committed separately from the desktop UX work to keep the release history clean.

---

## 6. Is the Next Production Release Safe?

**Yes — the Desktop Web UX changes are safe to release**, with the following conditions:

1. ✅ The critical `window.state` bug is fixed (verified in root and `www/`).
2. ✅ Android/mobile isolation is airtight (`html.web-mode` gating + mobile safety guards).
3. ✅ `www/` parity confirmed; `version-check.js` passes.
4. ✅ All tests pass (16/16); all JS passes `node --check`.
5. ✅ Release pipeline deploys the on-disk `www/` which contains `desktop.css` and `web-ui.js`.
6. ✅ `?v=1191` is self-healing via version-sync; `version.json` remains source-of-truth.

**Prerequisite before release:** The git working tree must be clean (see §5). Commit the desktop UX files (and handle the unrelated changes) before running the release command.

---

## 7. Which Command to Use — Version Divergence Consideration

> **DECISION (2026-08-09):** The user wants **the same version on web AND Android**, while ensuring Android is **not affected** by the Desktop Web UX changes. This is satisfied by **Option B (`npm run release:all`)** — see §7.4. The Desktop UX is web-mode gated, so Android receives the same version via OTA but its appearance/behavior are completely unchanged.

### 7.1 The version-divergence concern (valid)

The project uses a **single canonical version** in `version.json` shared across web AND Android. It is synced to `index.html`, `app.js`, `sw.js`, `android/app/build.gradle` (versionCode/versionName), and the OTA engine.

A **web-only** release (`release:deploy`) bumps `version.json` (e.g. 1191 → 1192) and updates `android/app/build.gradle` versionCode, but does **not** rebuild/release the Android APK/AAB. Result: **web at 1192, Android at 1191** — version divergence.

### 7.2 Is the divergence a functional problem?

- **Web:** No problem — gets the new version with the Desktop UX.
- **Android:** Not functionally broken. The Desktop UX is web-mode gated (never runs on Android), and the `window.state` fix is a harmless no-op there. Android works correctly at 1191.
- **OTA note:** A web-only release does NOT generate a new Capgo OTA bundle, so `www/version.json` would be `{"version": 1192}` (no `url` field). The Android `forceAppUpdate` (app.js:20921) checks `if (!manifest || !manifest.url)` and would fall back to classic reload via its try/catch — not a crash, but the OTA path would be inert until a native release regenerates the bundle.

### 7.3 Two options

**Option A — Web-only release (accept divergence):**
```bash
npm run release:deploy
```
- Lowest risk, fastest. Android stays at 1191 until the next native release.
- Choose this if you don't need Android to carry the same version number right now.

**Option B — Universal release (keep web + Android in sync):**
```bash
npm run release:all
```
- Bumps the version ONCE and releases to BOTH web (Cloudflare) and Android (APK/AAB + Capgo OTA) simultaneously.
- Keeps web and Android at the same version — no divergence.
- Higher cost/risk (requires Android signing, Gradle build, Capgo upload), but keeps versions consistent.
- Choose this if you want web and Android to always share the same version number.

### 7.4 Recommendation (DECISION)

**Chosen: Option B — `npm run release:all` (universal release).**

The user wants **the same version on web AND Android**, while ensuring Android is **not affected** by the Desktop Web UX changes. This is fully satisfied by Option B:

1. **Same version:** `release:all` bumps the version once and releases to both web (Cloudflare) and Android (APK/AAB + Capgo OTA) simultaneously → no divergence.
2. **Android unaffected by the web changes:** The Desktop UX is web-mode gated:
   - `desktop.css` rules only apply under `html.web-mode` (never set on Android).
   - `web-ui.js` entry points all return early via `isWebMode()` (never runs on Android).
   - The dashboard is force-hidden on mobile.
   - The only shared change (`window.state = state;` in `app.js`) is a harmless no-op on Android.
   - So Android receives the same version via OTA but its appearance and behavior are **completely unchanged**.

> Both options require a clean git tree first (see §5).

---

## 8. Summary of Actions Taken During This Audit

| Action | Type |
|--------|------|
| Added `desktop.css` + `web-ui.js` to `filesToMirror` in `scripts/version-sync.js` | Fix (pipeline) |
| Added `window.state = state;` to `app.js` (critical bug fix) | Fix (correctness) |
| Re-ran `node scripts/version-sync.js` to mirror the app.js fix to `www/` | Sync |
| Verified root↔www parity for all desktop files | Verify |
| Ran `npm test` (16/16 pass) + `node --check` on all JS | Verify |
| Ran `node scripts/version-check.js` (PASS) | Verify |
| Evaluated `?v=1191` (no change needed — version.json is source-of-truth) | Verify |

**No version bump, no commit, no Cloudflare deploy, and no Android/OTA release were performed.**
