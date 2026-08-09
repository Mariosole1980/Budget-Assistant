# Release Pipeline Remediation Plan

**Status:** Plan only — NO scripts changed yet.
**Date:** 2026-08-09
**Scope:** Consolidate the two divergent release pipelines into one deterministic, reproducible path without losing any functionality.

---

## 0. Implementation Status

**Status:** ✅ IMPLEMENTED (2026-08-09).
- Created `scripts/release-native.js` (native/OTA stage).
- Added `release:native` to `package.json`.
- Retired `build_and_deploy.ps1` → `archive/`.
- Fixed a **stale-regex bug** in `version-sync.js` / `version-check.js` discovered
  during validation: the Greek guide title/version strings in `app.js` were refactored
  to be **dynamic** (read `CURRENT_BUILD` at runtime via template literals), but the
  sync/check still targeted the old static single-quote patterns. This caused dead
  sync code and false version-check failures. Fixed to verify the dynamic pattern.
- Sandbox-validated the full `version-sync` + `version-check` cycle → **PASS 100%**.

---

## 1. Current Flow (two divergent pipelines)

### Path A — `build_and_deploy.ps1` (PowerShell, legacy)
1. **Version bump (inline, incomplete):** reads `version.json`, `newBuild = current + 1`, then regex-replaces `build v\d+` in `app.js` and `index.html`, `// SW Version \d+` + `CACHE_NAME` in `sw.js`, `CURRENT_BUILD` + `sw.js?v=` + `app.js?v=` in `index.html`, writes `version.json`.
2. **Signing config:** `node scratch/configure_signing.js` (writes `versionCode`/`versionName` + signing block into `android/app/build.gradle`).
3. **www mirror (manual, incomplete):** deletes `www/`, recreates, copies `app.js`, `js/`, `index.html`, `style.css`, `sw.js`, `manifest.json`, `icon.png`, `icon-192.png`, `xlsx.full.min.js`, `version.json`, `_headers`, `privacy.html`.
4. **Capgo OTA bundle:** `npx @capgo/cli bundle zip com.budgetassistant.app -b "1.0.$newBuild"`, copies the zip into `www/`, rewrites `www/version.json` to `{version, url, checksum}` pointing at the OTA zip.
5. **Capacitor sync:** `npx cap sync android`.
6. **Gradle build:** `gradlew assembleDebug assembleRelease bundleRelease`.
7. **Copy APKs/AAB to Desktop.**
8. **Cloudflare deploy:** `wrangler pages deploy www --project-name=budget-assistant-pwa` (1 project only).
9. **Git commit AFTER deploy:** `git add -A; git commit -m "build v${newBuild}: <msg>"`.

### Path B — `scripts/release-deploy.js` (Node, fail-safe)
1. **Clean-tree guard:** `git status --porcelain` → abort if dirty.
2. **Version bump:** `node scripts/version-bump.js` → `version-sync.js` (complete marker sync + www mirror).
3. **Version check:** `node scripts/version-check.js` (strict consistency + root↔www parity).
4. **Git commit BEFORE deploy:** `git add -A; git commit -m "release: build vN [automated release workflow]"`.
5. **Cloudflare deploy:** `wrangler pages deploy www` → **both** `budget-assistant-pwa` and `money-manager-pwa`.
6. **Live verification:** `node scripts/release-verify-live.js` (HTTP checks both projects).

`package.json` declares Path B canonical: `release:deploy` and `build-deploy` both route to `release-deploy.js`.

---

## 2. Which pipeline is canonical vs actually used (evidence)

| Evidence | Finding |
|---|---|
| Git history `git log --oneline --all` | Path B format (`release: build vN [automated release workflow]`) used only v959–v982, then sporadically (v1012, v1017–1019, v1117). **Path A format (`build vN: automated release`) used continuously v983 → v1181 (current).** |
| `www/version.json` | Contains Capgo bundle `{url, checksum, version}` — **only Path A writes this**. |
| `www/` contains `com.budgetassistant.app_1.0.1181.zip` | Path A OTA artifact present. |
| `android/app/build.gradle` | `versionName "1.0.1181"` — Path A's format (Path B writes `1.0.0-vN`). |
| `package.json` scripts | Declares Path B canonical — **but this is aspirational, not what is run.** |

**Conclusion:** Path A is the pipeline **actually used** for every release since v983. Path B is declared canonical in `package.json` but has been effectively abandoned. The two are **not interchangeable** because they manage `www/version.json` and the OTA zip differently (see Risks).

---

## 3. Responsibilities matrix

| Responsibility | Path A (ps1) | Path B (node) | Notes |
|---|---|---|---|
| Version bump (version.json) | ✅ inline | ✅ `version-bump.js` | Both bump +1 |
| Sync index.html markers | ✅ partial | ✅ complete | Path B also syncs user-guide badge + all `?v=` |
| Sync sw.js markers | ✅ | ✅ | Both |
| Sync app.js guide strings | ❌ | ✅ | Path B syncs Greek+English guide titles/versions |
| Sync `ota-boot-loader.js` | ❌ | ✅ (file missing) | File does not exist at root — stale ref |
| Sync `js/OTAEngine.js` BUNDLED_NATIVE_VERSION | ❌ | ✅ | Path A misses this |
| Sync `android/app/build.gradle` versionCode/versionName | ✅ `configure_signing.js` | ✅ `version-sync.js` | Different versionName formats |
| www mirror | ✅ manual (incomplete) | ✅ `version-sync.js` (complete) | Path B mirrors more files |
| Capgo OTA bundle | ✅ | ❌ | **Path A only** |
| Capacitor sync | ✅ | ❌ | **Path A only** |
| Gradle APK/AAB build | ✅ | ❌ | **Path A only** |
| Copy APKs/AAB to Desktop | ✅ | ❌ | **Path A only** |
| Clean-tree guard | ❌ | ✅ | Path B only |
| Version consistency check | ❌ | ✅ | Path B only |
| Commit before deploy | ❌ (after) | ✅ (before) | Path B safer |
| Cloudflare deploy | 1 project | 2 projects | Path B deploys both |
| Live verification | ❌ | ✅ | Path B only |

---

## 4. Overlaps

- **Version bump** (both increment `version.json` by 1).
- **www mirror** (both rebuild `www/` from root).
- **Cloudflare deploy** (both deploy `www/` to `budget-assistant-pwa`).
- **Git commit** (both commit the release state).
- **Gradle versionCode/versionName sync** (both write it, different formats).

---

## 5. Differences

| Difference | Path A | Path B |
|---|---|---|
| OTA bundle generation | ✅ yes | ❌ no |
| Android native build | ✅ yes | ❌ no |
| Clean-tree guard | ❌ | ✅ |
| Version consistency check | ❌ | ✅ |
| Live verification | ❌ | ✅ |
| Commit timing | after deploy | before deploy |
| Cloudflare projects | 1 | 2 |
| `www/version.json` format | Capgo `{url,checksum,version}` | plain `{"version":N}` |
| OTA zip in www | ✅ preserved | ❌ wiped by version-sync |
| Portability | hardcoded `Set-Location` | `__dirname` |

---

## 6. Risks

### R1 — CRITICAL: Path B would break OTA if run as-is
`version-sync.js` deletes `www/`, recreates it, and writes `www/version.json` as plain `{"version": N}`. It does **not** copy the Capgo OTA zip. Running Path B would:
- Wipe the OTA zip from `www/`.
- Overwrite `www/version.json` (removing `url`/`checksum`).
- Deploy a `www/` whose `version.json` no longer points at a valid OTA bundle → **breaks OTA updates** for installed Android apps.

### R2 — HIGH: Two pipelines, two commit formats, double-bump hazard
Running both paths in one release double-bumps `version.json` and produces conflicting commits. The mapping doc already warns against this.

### R3 — MEDIUM: Path A version bump is incomplete
Path A does not sync `js/OTAEngine.js` `BUNDLED_NATIVE_VERSION` or the app.js guide version strings. This causes version-marker drift between web and native/OTA builds.

### R4 — MEDIUM: Path A has no safety checks
No clean-tree guard, no version consistency check, no live verification. A dirty tree or a partial sync can silently ship a broken build.

### R5 — LOW: Stale mirror references in Path B
`version-sync.js` lists `ota-boot-loader.js`, `clear.html`, `nuke.html`, `debug.html` which do not exist at root. Harmless (guarded by `existsSync`) but dead config.

### R6 — LOW: Path A hardcodes absolute path
`Set-Location "C:\Users\mario\Desktop\budget-assistant"` — non-portable.

### R7 — LOW: Path A deploys to only 1 Cloudflare project
`money-manager-pwa` is not updated by Path A, so the two live URLs can drift apart.

---

## 7. Proposed Target Architecture (single deterministic path)

**Decision:** Make **Path B (Node) the single canonical release path**, extended with Path A's unique native/OTA stage, and **retire `build_and_deploy.ps1`**. This preserves ALL functionality while gaining Path B's safety checks.

The key architectural fix: **decouple the OTA bundle from the web `www/version.json`** so Path B's clean www mirror no longer destroys OTA state.

### New canonical flow

**`npm run release:deploy` → `scripts/release-deploy.js`** (web release, unchanged safety):
1. Clean-tree guard.
2. `version-bump.js` → `version-sync.js` (complete sync + www mirror).
3. `version-check.js` (strict consistency + www parity).
4. Git commit BEFORE deploy.
5. Deploy www → `budget-assistant-pwa` + `money-manager-pwa`.
6. `release-verify-live.js`.

**`npm run release:native` → new `scripts/release-native.js`** (optional native/OTA stage, invoked separately after a web release):
1. `node scratch/configure_signing.js` (versionCode/versionName).
2. `npx cap sync android`.
3. `gradlew assembleDebug assembleRelease bundleRelease`.
4. Copy APKs/AAB to Desktop.
5. `npx @capgo/cli bundle zip com.budgetassistant.app -b "1.0.$VERSION"` → copy zip to `www/`, rewrite `www/version.json` with `{version,url,checksum}`.
6. Re-deploy www → `budget-assistant-pwa` (so the OTA zip + version.json reach the CDN).

### Why this is the technically safest solution
- **Preserves all functionality:** OTA, Capacitor sync, APK/AAB, both Cloudflare projects, live verification — everything from both paths is retained.
- **Adds safety:** clean-tree guard, version check, live verification, commit-before-deploy.
- **Removes the double-bump hazard:** one canonical entry point; native is an explicit, separate step.
- **Fixes R1:** the web release no longer touches OTA state; the native stage explicitly manages the OTA zip + `www/version.json`.
- **Fixes R3/R4/R6/R7:** complete version sync, safety checks, portable paths, both Cloudflare projects.

### Files to change
1. **Create `scripts/release-native.js`** — the native/OTA stage extracted from Path A.
2. **Edit `scripts/version-sync.js`** — remove stale mirror refs (`ota-boot-loader.js`, `clear.html`, `nuke.html`, `debug.html`) OR keep them (guarded). Keep as-is to minimize change; only remove if confirmed dead.
3. **Edit `package.json`** — add `release:native` script.
4. **Retire `build_and_deploy.ps1`** — move to `archive/` (do not delete, for rollback).
5. **Update `plans/release-pipeline-mapping.md`** — mark as superseded by this plan.

---

## 8. Rollback Strategy

Because Path B commits **before** deploy and the native stage is separate:

1. **Web rollback:** `git log --oneline -n 5` to find last-good release commit; `git checkout <last-good> -- app.js index.html sw.js version.json` (+ any other changed files); commit; re-run `npm run release:deploy`.
2. **Native/OTA rollback:** rebuild from restored source via `npm run release:native`; the previous OTA bundle remains on the CDN and Capgo can point back to it.
3. **Pipeline rollback:** `build_and_deploy.ps1` is preserved in `archive/` — restore it if the new flow has issues.
4. **Verify:** `npm run release:verify-live` against both projects.

---

## 9. Validation Plan (post-implementation)

- **Versioning:** `node scripts/version-check.js` passes; markers consistent across index.html, sw.js, app.js, gradle, OTAEngine.
- **www generation:** `version-sync.js` produces a clean www mirror; root↔www parity confirmed.
- **OTA:** `release-native.js` generates the bundle, writes `www/version.json` with url/checksum, zip present in www.
- **Capacitor sync:** `npx cap sync android` succeeds.
- **APK/AAB:** gradle builds succeed; artifacts copied to Desktop.
- **Cloudflare:** both projects deploy; `release-verify-live.js` passes.
- **Git state:** clean tree before release; single commit per release; no double-bump.
- **Live production:** `release-verify-live.js` confirms live version on both URLs.

---

## 10. Decision

Proceed with the target architecture in Section 7: **Path B as the single canonical web release path + a new `release-native.js` for the native/OTA stage, retiring `build_and_deploy.ps1`.** This is the technically safest solution because it preserves every existing capability while eliminating the divergent-pipeline hazard and adding deterministic safety checks.
