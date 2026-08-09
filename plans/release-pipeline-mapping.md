# Release Pipeline Mapping & Canonical Proposal

**Status:** Mapping + proposal only — NO scripts deleted or changed in this phase.
**Phase:** Remediation Priority 3 (release pipeline mapping)
**Date:** 2026-08-09
**Scope:** `build_and_deploy.ps1`, `scripts/*`, `package.json`. No app.js / UI / DB changes.

---

## 1. Executive Summary

There are **two divergent release paths** that overlap heavily but are not
equivalent:

- **Path A — `build_and_deploy.ps1`** (PowerShell, legacy): inline version bump →
  www mirror → Capgo OTA → Android native build → Cloudflare deploy (1 project) →
  git commit.
- **Path B — `scripts/release-deploy.js`** (Node, fail-safe): clean-tree guard →
  `version-bump.js` → `version-sync.js` → `version-check.js` → git commit →
  Cloudflare deploy (2 projects) → live verification.

`package.json` already declares **Path B** as the canonical entry point
(`release:deploy` and `build-deploy` both route to `release-deploy.js`).

**Recommendation:** Make **Path B** the single canonical release path and fold the
Android/Capgo steps from Path A into it as an optional native-release stage. Do not
delete anything without approval.

---

## 2. Inventory of Release-Related Scripts

| File | Role | Used by |
|---|---|---|
| `build_and_deploy.ps1` | Legacy full pipeline (web + native + OTA) | Manual / Path A |
| `scripts/release-deploy.js` | Fail-safe web release orchestrator | Path B (`npm run release:deploy`) |
| `scripts/version-bump.js` | Increments `version.json`, then calls `version-sync.js` | Path B |
| `scripts/version-sync.js` | Syncs version markers across index.html, sw.js, app.js, build.gradle, ota-boot-loader.js, OTAEngine.js; mirrors root → www | Path B |
| `scripts/version-check.js` | Strict consistency check (markers + root/www parity + stale patterns) | Path B |
| `scripts/release-verify-live.js` | Live HTTP verification of both Cloudflare projects | Path B |
| `scratch/configure_signing.js` | Writes signing config into android/app/build.gradle | Path A |
| `package.json` scripts | `version:sync`, `version:bump`, `version:check`, `release:deploy`, `release:verify-live`, `build-deploy` | npm |

---

## 3. Path A — `build_and_deploy.ps1` (Legacy PowerShell)

Steps:
1. **Inline version bump** (lines 11–58): reads `version.json`, increments, then
   regex-replaces `build v\d+` in `app.js`, `// SW Version \d+` + `CACHE_NAME` in
   `sw.js`, `build v\d+` + `CURRENT_BUILD` + `sw.js?v=` + `app.js?v=` in
   `index.html`, writes `version.json`.
   - ⚠️ **Duplicates** `version-sync.js` logic but is **incomplete**: it does NOT
     sync `android/app/build.gradle` versionCode/versionName, `ota-boot-loader.js`
     BUNDLED_APP_JS/BUNDLED_STYLE_CSS, or `js/OTAEngine.js` BUNDLED_NATIVE_VERSION.
2. `node scratch/configure_signing.js` (line 63) — signing config.
3. **Rebuild www/** (lines 65–85): deletes www, copies app.js, js/, index.html,
   style.css, sw.js, manifest.json, icon.png, icon-192.png, xlsx.full.min.js,
   version.json, _headers, privacy.html.
   - ⚠️ Does **not** copy `clear.html`, `nuke.html`, `debug.html`,
     `ota-boot-loader.js` (unlike `version-sync.js`).
4. **Capgo OTA bundle** (lines 87–107): `npx @capgo/cli bundle zip
   com.budgetassistant.app -b "1.0.$newBuild"`, copies zip into www/, rewrites
   www/version.json with `{version, url, checksum}`.
5. **Capacitor sync** (lines 109–116): `npx cap sync android`.
6. **Gradle build** (lines 118–130): `assembleDebug assembleRelease bundleRelease`.
7. **Copy APKs/AAB to Desktop** (lines 132–148).
8. **Cloudflare deploy** (lines 151–162): `wrangler pages deploy www
   --project-name=budget-assistant-pwa` — **only 1 project**.
9. **Git commit** (lines 164–171): `git add -A; git commit -m "build v${newBuild}: ..."`.

---

## 4. Path B — `scripts/release-deploy.js` (Node, Fail-Safe)

Steps:
1. **Git working-tree guard** (lines 11–21): aborts if `git status --porcelain` is
   non-empty. Prevents releasing uncommitted work.
2. **Version bump** (lines 23–25): `node scripts/version-bump.js` →
   `version-sync.js` (full sync incl. gradle + OTA constants + www mirror).
3. **Strict version check** (lines 31–33): `node scripts/version-check.js`.
4. **Git commit BEFORE deploy** (lines 35–39): `git add -A; git commit -m "release:
   build v${newVersion} [automated release workflow]"`.
5. **Cloudflare deploy** (lines 41–50): deploys www to **both**
   `budget-assistant-pwa` and `money-manager-pwa`.
6. **Live verification** (lines 52–54): `node scripts/release-verify-live.js`.

---

## 5. Divergence / Duplication Analysis

| Concern | Path A (ps1) | Path B (node) | Verdict |
|---|---|---|---|
| Version bump | Inline, **incomplete** | `version-sync.js`, **complete** | Path B wins |
| Clean-tree guard | ❌ none | ✅ yes | Path B wins |
| Version consistency check | ❌ none | ✅ `version-check.js` | Path B wins |
| Commit before deploy | After deploy | Before deploy | Path B wins (safer) |
| Cloudflare projects | 1 (`budget-assistant-pwa`) | 2 (both) | Path B wins |
| Live verification | ❌ none | ✅ `release-verify-live.js` | Path B wins |
| Android native build | ✅ yes | ❌ no | Path A only |
| Capgo OTA bundle | ✅ yes | ❌ no | Path A only |
| Signing config | ✅ `configure_signing.js` | ❌ no | Path A only |
| www mirror completeness | Missing clear/nuke/debug/ota-boot-loader | Complete | Path B wins |

**Conclusion:** Path B is the superior web-release path and is already the declared
canonical entry point in `package.json`. Path A's only unique value is the
**Android native build + Capgo OTA** stage, which Path B lacks.

---

## 6. Proposed Canonical Pipeline (single release path)

**Primary: `npm run release:deploy` → `scripts/release-deploy.js`** (web release).

```
release-deploy.js
  1. git status --porcelain  → abort if dirty
  2. version-bump.js → version-sync.js   (bump + full marker sync + www mirror)
  3. version-check.js                     (strict consistency + www parity)
  4. git commit "release: build vN"       (commit BEFORE deploy)
  5. wrangler pages deploy www → budget-assistant-pwa
  6. wrangler pages deploy www → money-manager-pwa
  7. release-verify-live.js               (live HTTP verification)
```

**Optional native stage (folded from Path A, invoked separately):**
`npm run release:native` → a new `scripts/release-native.js` that does:
```
  1. node scratch/configure_signing.js
  2. npx cap sync android
  3. gradlew assembleDebug assembleRelease bundleRelease
  4. copy APKs/AAB to Desktop
  5. npx @capgo/cli bundle zip com.budgetassistant.app -b "1.0.$VERSION"
     → copy zip to www/, rewrite www/version.json {version,url,checksum}
  6. wrangler pages deploy www → budget-assistant-pwa  (re-deploy with OTA zip)
```

**Retire:** `build_and_deploy.ps1` (its web-release logic is fully superseded by
Path B; its native logic moves to `release-native.js`).

---

## 7. Rollback Plan

Because Path B commits **before** deploy and tags the release, rollback is
straightforward:

1. **Identify last good version:** `git log --oneline -n 5` to find the previous
   release commit (`release: build vN-1`).
2. **Restore source:** `git checkout <last-good-commit> -- app.js index.html sw.js
   version.json` (and any other changed files), then commit.
3. **Re-run web release:** `npm run release:deploy` to redeploy the restored www to
   both Cloudflare projects (version-check + live-verify will confirm).
4. **Native/OTA rollback:**
   - Android: rebuild from the restored source (`release:native`).
   - Capgo OTA: the previous OTA bundle remains on the CDN; Capgo's updater can be
     pointed back to the last-good bundle via the Capgo dashboard, or a new bundle
     with the restored version is uploaded.
5. **Verify:** `npm run release:verify-live` against both projects.

---

## 8. Risks / Notes

- **Do NOT run both paths in the same release** — they both bump `version.json`
  and both commit, which would produce a double bump and conflicting commits.
- `build_and_deploy.ps1` hardcodes `Set-Location "C:\Users\mario\Desktop\budget-assistant"`
  (line 7) — not portable; another reason to prefer the Node path (uses `__dirname`).
- `version-sync.js` mirrors `clear.html`, `nuke.html`, `debug.html`,
  `ota-boot-loader.js` to www/ — these are the "stale references" investigated in
  Priority 4. Their presence in the mirror list should be reconciled with that
  finding.
- The OTA zip is written into `www/` and then deployed; the `www/` folder is
  `.gitignore`'d but has tracked files (Priority 5). The OTA zip should not be
  committed to git.

---

## 9. Follow-up

- Approve the canonical pipeline (Section 6) before any script changes.
- Decide whether to create `scripts/release-native.js` and retire
  `build_and_deploy.ps1`.
- Reconcile the `version-sync.js` mirror list with the stale-reference findings
  (Priority 4).
