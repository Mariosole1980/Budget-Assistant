# Stale References Verification

**Status:** Verification complete — documented, NO changes applied in this phase.
**Phase:** Remediation Priority 4 (stale references)
**Date:** 2026-08-09
**Scope:** `index.html`, `sw.js`, `scripts/version-sync.js`, `capacitor.js`,
`clear.html`, `nuke.html`, `debug.html`, `ota-boot-loader.js`, `js/OTAEngine.js`.

---

## 1. Summary

Six files were flagged as potential stale references. Verification confirms that
**all six are missing from the repo** (not on disk, not in git HEAD), yet **five of
them are still referenced** by `index.html`, `sw.js`, or `scripts/version-sync.js`.
These are **dangling references** to files that were either never tracked or were
deleted in earlier builds.

No files were deleted or restored in this phase. This document classifies each
finding and proposes the cleanup.

---

## 2. File Existence Matrix

| File | On disk (root) | In git HEAD | Referenced by | Deleted in |
|---|---|---|---|---|
| `capacitor.js` | ❌ | ❌ (never tracked) | `index.html:163` | — |
| `clear.html` | ❌ | ❌ | `sw.js:106,113`; `version-sync.js` mirror | `25928c9` (v1087) |
| `nuke.html` | ❌ | ❌ | `version-sync.js` mirror | `25928c9` (v1087) |
| `debug.html` | ❌ | ❌ | `index.html:56,110,129,2252`; `version-sync.js` mirror | `25928c9` (v1087) |
| `ota-boot-loader.js` | ❌ | ❌ | `version-sync.js:72-79,109` | `ae91bff` (v1077) |
| `js/OTAEngine.js` | ❌ | ❌ | `version-sync.js:81-87` | `ae91bff` (v1077) |

---

## 3. Per-File Classification

### 3.1 `capacitor.js` — **Truly dead reference (broken 404)**
- **Evidence:** Never tracked in git (`git log --all -- capacitor.js` → empty).
  Not on disk. Not in native assets (`android/app/src/main/assets/public/` has
  `cordova.js`/`cordova_plugins.js` but no `capacitor.js`).
- **Why it's dead:** In Capacitor, `window.Capacitor` is injected by the **native
  bridge at runtime**, not by a `capacitor.js` script. `app.js` uses
  `window.Capacitor` (24 references) but always guards with
  `if (window.Capacitor ...)`. In native builds the bridge provides it; in web/PWA
  builds it is absent and the guards handle it.
- **Impact:** The `<script src="capacitor.js"></script>` at `index.html:163` 404s
  in every environment but is **harmless** (no functional dependency).
- **Classification:** Truly dead. **Proposal:** remove the `<script>` tag from
  `index.html:163`.

### 3.2 `debug.html` — **Dangling reference (deleted feature)**
- **Evidence:** Deleted in `25928c9` (v1087). Still referenced by `index.html` at
  lines 56, 110, 129 (developer-mode buttons navigate to `debug.html`) and 2252
  (Developer Control Panel row).
- **Impact:** In developer mode, tapping the diagnostics button navigates to a
  **404**.
- **Classification:** Referenced-only-by-old-tooling (dev-only feature). The dev
  panel was removed; the references are stale. **Proposal:** remove the four
  `debug.html` navigation references from `index.html` (or restore the file if the
  dev panel is still wanted).

### 3.3 `clear.html` — **Dangling reference (deleted feature)**
- **Evidence:** Deleted in `25928c9` (v1087). Referenced by `sw.js:106` (cache
  allow-list) and `sw.js:113` (navigation fallback returns 503 for it).
- **Impact:** The service worker has dead branches for a file that no longer
  exists.
- **Classification:** Truly dead. **Proposal:** remove the `clear.html` branches
  from `sw.js` (lines 106, 113).

### 3.4 `nuke.html` — **Dangling reference (deleted feature)**
- **Evidence:** Deleted in `25928c9` (v1087). Only referenced by the
  `version-sync.js` mirror list (line 106), which is guarded by `fs.existsSync` so
  it is silently skipped.
- **Impact:** None at runtime; stale entry in the mirror list.
- **Classification:** Referenced-only-by-old-tooling. **Proposal:** remove
  `'nuke.html'` from the `version-sync.js` mirror list.

### 3.5 `ota-boot-loader.js` — **Dangling reference (old OTA engine removed)**
- **Evidence:** Deleted in `ae91bff` (v1077). Referenced by `version-sync.js`
  lines 72–79 (guarded by `fs.existsSync`, so skipped) and the mirror list
  (line 109).
- **Context:** This was the **old custom OTA boot loader**. It was replaced by the
  **Capgo CapacitorUpdater** native plugin (configured in `capacitor.config.json`
  `plugins.CapacitorUpdater`). The OTA architecture change already happened; these
  are leftover references.
- **Classification:** Referenced-only-by-old-tooling. **Proposal:** remove the
  `ota-boot-loader.js` block (lines 72–79) and mirror entry (line 109) from
  `version-sync.js`.

### 3.6 `js/OTAEngine.js` — **Dangling reference (old OTA engine removed)**
- **Evidence:** Deleted in `ae91bff` (v1077). Referenced by `version-sync.js`
  lines 81–87 (guarded by `fs.existsSync`, so skipped).
- **Context:** Same as `ota-boot-loader.js` — old custom OTA engine replaced by
  Capgo.
- **Classification:** Referenced-only-by-old-tooling. **Proposal:** remove the
  `js/OTAEngine.js` block (lines 81–87) from `version-sync.js`.

---

## 4. Why Not Applied Now

Per the remediation scope:
- "Μην κάνεις γενικό cleanup... Μόνο αποδεδειγμένα dead/duplicate code."
- "Αν ένα finding είναι false positive ή ήδη λυμένο, τεκμηρίωσέ το, μην το
  αλλάξεις."
- The user's scope also says **NO UI changes** — removing the `debug.html`
  references and the `capacitor.js` script tag touches `index.html`, and the
  `clear.html` cleanup touches `sw.js`. These are low-risk but are behavior/UI
  adjacent, so they are documented and proposed rather than applied.

---

## 5. Proposed Cleanup (for a future approved phase)

1. `index.html:163` — remove `<script src="capacitor.js"></script>`.
2. `index.html:56,110,129,2252` — remove `debug.html` navigation references.
3. `sw.js:106,113` — remove `clear.html` cache/navigation branches.
4. `scripts/version-sync.js` — remove `nuke.html`, `debug.html`, `clear.html`,
   `ota-boot-loader.js` mirror entries and the `ota-boot-loader.js` /
   `js/OTAEngine.js` sync blocks.

All four are safe: they only remove references to files that do not exist, and the
`version-sync.js` blocks are already no-ops (guarded by `fs.existsSync`).

---

## 6. Verification Notes

- `git log --diff-filter=D` confirmed the deletion commits:
  - `clear.html`, `debug.html`, `nuke.html` → `25928c9` (v1087)
  - `ota-boot-loader.js`, `js/OTAEngine.js` → `ae91bff` (v1077)
- `capacitor.js` has no git history at all (never tracked).
- The native Android assets confirm `window.Capacitor` is bridge-injected, not
  script-loaded.
- No production functionality depends on any of these six files.

---

## 7. Follow-up

- Approve the cleanup in Section 5, or restore any file that is still needed
  (e.g., `debug.html` if the developer diagnostics panel is wanted).
- Reconcile the `version-sync.js` mirror list with the canonical release pipeline
  (see `plans/release-pipeline-mapping.md`).
