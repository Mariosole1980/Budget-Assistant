# Tracked www Artifacts — Investigation & Recommendation

**Status:** Investigation complete — documented, NO git index changes applied in
this phase.
**Phase:** Remediation Priority 5 (tracked www artifacts)
**Date:** 2026-08-09
**Scope:** `.gitignore`, git index for `www/`, OTA zip handling, `.pagesignore`.

---

## 1. Summary

`www/` is listed in `.gitignore` (line 4) as a build artifact, yet **28 files under
`www/` are tracked in git** (force-added historically). These are stale build
artifacts that drift from the root source. Separately, a stale OTA bundle
`scratch/ota_1165.zip` is tracked despite `scratch/` being gitignored.

**Recommendation:** Untrack the `www/` build artifacts and the stale
`scratch/ota_1165.zip`. No build/deploy workflow change is required because `www/`
is regenerated from root on every release.

---

## 2. Evidence

### 2.1 `.gitignore` (lines 3–10)
```
# Build artifacts
www/
android/app/build/
android/.gradle/
android/build/
*.apk
*.zip
*.aab
```
`www/` and `*.zip` are both ignored.

### 2.2 Tracked files under `www/` (28 files)
`git ls-files www/` returns:
```
www/_headers
www/app.js
www/icon.png
www/index.html
www/js/AIEngine.js
www/js/CurrencyService.js
www/js/DecisionEngine.js
www/js/IntentCorpus.js
www/js/KnowledgeGraph.js
www/js/MemoryEngine.js
www/js/NLPProcessor.js
www/js/OnlineAIProvider.js
www/js/chart.js
www/js/chartjs-plugin-datalabels.js
www/js/fontawesome.min.css
www/js/supabase.js
www/js/webfonts/fa-brands-400.ttf
www/js/webfonts/fa-brands-400.woff2
www/js/webfonts/fa-regular-400.ttf
www/js/webfonts/fa-regular-400.woff2
www/js/webfonts/fa-solid-900.ttf
www/js/webfonts/fa-solid-900.woff2
www/manifest.json
www/privacy.html
www/style.css
www/sw.js
www/version.json
www/xlsx.full.min.js
```
These were force-added (first commit that added `www/app.js`: `047e046`).

### 2.3 OTA zip handling
- `www/com.budgetassistant.app_1.0.1181.zip` is **NOT tracked** (correctly ignored
  by `*.zip`).
- `scratch/ota_1165.zip` **IS tracked** (added in `210fd5f`, build v1166) despite
  `scratch/` being gitignored — a stale OTA bundle committed to git.

### 2.4 `.pagesignore`
```
Windsurf.exe
*.exe
*.zip
*.tar.gz
node_modules/
.wrangler/
.netlify/
.git/
android/
*.log
```
`*.zip` is excluded from Cloudflare Pages uploads.

---

## 3. Why the Tracked `www/` Files Are a Problem

1. **Stale build artifacts:** `www/` is regenerated from root on every release
   (both `build_and_deploy.ps1` and `scripts/version-sync.js` delete and recreate
   it). The tracked copies are snapshots that drift from root source.
2. **Noise in every release:** Each release regenerates `www/`, producing large
   diffs of generated files that are not meaningful source changes.
3. **Contradicts `.gitignore`:** The intent (per `.gitignore`) is that `www/` is a
   build artifact, not source. Tracking it defeats that intent.
4. **`version-check.js` parity check:** It compares root vs `www/` for
   `version.json`, `sw.js`, `index.html`, `app.js`. Since `www/` is regenerated
   from root, parity holds regardless of tracking; untracking does not break this.

---

## 4. Recommendation

### 4.1 Untrack `www/` build artifacts
```
git rm -r --cached www/
```
- Removes the 28 files from the git index **without deleting them from disk**.
- `www/` remains on disk (and in `.gitignore`), so local builds and deploys are
  unaffected.
- The next release regenerates `www/` from root as before.

### 4.2 Remove the stale OTA bundle from git
```
git rm --cached scratch/ota_1165.zip
```
- `scratch/` is gitignored; this file was force-added and is a pointless committed
  artifact.

### 4.3 No build/deploy workflow change required
- `www/` is already regenerated from root by both release paths.
- The OTA zip in `www/` is already untracked and ignored.
- `version-check.js` parity is unaffected.

---

## 5. Risk Note — OTA Zip vs `.pagesignore`

`capacitor.config.json` sets `CapacitorUpdater.autoUpdateUrl` to
`https://budget-assistant-pwa.pages.dev/version.json`, and `build_and_deploy.ps1`
writes the OTA zip into `www/` and deploys to Pages. However, `.pagesignore`
excludes `*.zip`, so the OTA zip is **not uploaded to Pages**. This means the
`url` field in `www/version.json`
(`https://budget-assistant-pwa.pages.dev/<zip>.zip`) may **404** on Pages.

This is an **OTA architecture / deployment concern** and is **out of scope** for
this remediation phase (the user scoped out OTA architecture changes). It is
documented here for a future phase. The Capgo updater may still work if the bundle
is served from another location, but the current Pages-based URL is suspect.

---

## 6. Why Not Applied Now

Per the remediation scope and the user's established preference to document
findings before applying changes, the git index changes (Section 4) are proposed
but not applied in this phase. They are low-risk (no runtime behavior change) but
modify the git index, so they require approval.

---

## 7. Follow-up

- Approve Section 4 to untrack `www/` and `scratch/ota_1165.zip`.
- Investigate the OTA zip / `.pagesignore` mismatch (Section 5) in a future phase.
- Re-run `version-check.js` after any change to confirm root/www parity still holds.
