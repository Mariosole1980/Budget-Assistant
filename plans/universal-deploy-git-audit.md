# 🔍 Universal Deploy / Release Pipeline — Read-Only Audit Report

**Status:** REPORT ONLY — no files modified.
**Scope:** Full audit of the Universal Deploy pipeline ([`scripts/release-all.js`](scripts/release-all.js:1)) and its dependencies ([`release-native.js`](scripts/release-native.js:1), [`release-deploy.js`](scripts/release-deploy.js:1), [`version-sync.js`](scripts/version-sync.js:1), [`version-bump.js`](scripts/version-bump.js:1), [`version-check.js`](scripts/version-check.js:1), [`release-verify-live.js`](scripts/release-verify-live.js:1)) for: accidental commits, file loss/overwrite, wrong-version deploy, deploy-before-checks, double deploy, missing safety gates, rollback failure, root/www/Android/OTA mismatch, dirty-tree deploy, and continue-after-failure.

---

## 1. Current Pipeline Flow (as implemented)

```
release-all.js
  Step 1  git status --porcelain  → abort if dirty (MANDATORY)
  Step 2  version-bump.js         → bumps version.json → runs version-sync.js
  Step 3  version-check.js        → STRICT (execSync, throws on fail)
  Step 4  verify-health.js        → STRICT (execSync, throws on fail)
  Step 5  git add -A + git commit → release state committed
  Step 6  release-native.js       → SINGLE Cloudflare deploy (inside)
  Step 7  release-verify-live.js  → STRICT (execSync, throws on fail)
```

`version-sync.js` (invoked by Step 2) modifies tracked files: `index.html`, `sw.js`, `app.js`, `js/translations.js`, `android/app/build.gradle`, `version.json` — then **deletes and recreates `www/`** and mirrors root files into it (including `version.json` and, if present, `ota-boot-loader.js` + `js/OTAEngine.js`).

`release-native.js` (Step 6) does: configure signing → `cap sync` → gradle builds → copy APK/AAB to Desktop → generate Capgo OTA zip → copy zip into `www/` → **rewrite `www/version.json` to OTA manifest format** → single Cloudflare Pages deploy.

---

## 2. What Is Already Safe ✅

| Area | Verdict | Evidence |
|---|---|---|
| **`git add -A` respects `.gitignore`** | Safe | `www/`, `scratch/`, `node_modules/`, `android/app/build/`, `*.apk`, `*.zip`, `*.aab`, `.wrangler/`, `.capgo_key_v2`, `release.keystore` all excluded. Confirmed via `git status --porcelain --ignored=matching` + `git check-ignore`. |
| **No file loss** | Safe | `git add -A` only stages, never deletes. `fs.rmSync(wwwDir)` in version-sync is immediately followed by recreate+mirror, and `www/` is gitignored. |
| **All version-sync-modified files are tracked** | Safe | `index.html`, `sw.js`, `app.js`, `js/translations.js`, `android/app/build.gradle`, `version.json` all tracked → their version bumps are correctly committed. |
| **`configure_signing.js` is tracked** | Safe | Despite `scratch/` being gitignored, `scratch/configure_signing.js` is tracked (pre-existing), so a fresh clone has it. |
| **Single Cloudflare deploy** | Safe (D2 done) | `release-all.js` no longer deploys directly; the only deploy is inside `release-native.js` Step 6. |
| **Mandatory gates** | Safe (D1 done) | Steps 3, 4, 7 use bare `execSync` (throws on non-zero) → pipeline stops on failure. Step 1 aborts on dirty tree. |
| **Live verification** | Safe | `release-verify-live.js` retries 4× for edge propagation and exits 1 on failure. |
| **Current untracked sweep scope** | Safe today | `git add -A --dry-run` currently stages only `scripts/release-all.js` + `plans/architecture-and-deploy-report.md`. |

---

## 3. Possible Risks ⚠️ (latent, not currently triggered)

### R1 — `ota-boot-loader.js` / `js/OTAEngine.js` accidental inclusion
- **Not tracked, NOT in `.gitignore`** (confirmed: `git check-ignore` returns exit 1).
- Currently **do not exist** on disk (confirmed via `dir`), so no immediate risk.
- **If they exist at release time** (left over from a previous native build), `version-sync.js` (lines 81–96) modifies them, and Step 5's `git add -A` would **sweep them into the release commit**.
- **Mitigated today** because Step 5 (commit) runs **before** Step 6 (native build that generates them). But a stale copy on disk would still be swept.

### R2 — `git add -A` broad sweep
- `git add -A` stages **every** untracked non-ignored file. Today only the report doc is untracked, but any stray file (temp script, debug artifact, new source file) not covered by `.gitignore` would be silently committed into a "release" commit.
- This is the **accidental-inclusion** vector the user asked about.

### R3 — `www/version.json` tracked-file format cycle (see §4 — this is actually a REAL problem, elevated)

### R4 — `release-deploy.js` still exists as a parallel path
- It performs its **own** Cloudflare deploy + commit. It is not called by `release-all.js`, but it remains runnable (`npm run release:deploy`). If someone runs it, it deploys web-only (no OTA) and commits — a **second, divergent release path** that could deploy a stale/partial state. Not a bug in the universal flow, but a footgun.

---

## 4. Real Problems 🔴

### P1 — `www/version.json` is tracked AND rewritten to OTA format after the commit → **release-blocking dirty tree on the NEXT release**

This is the **most serious finding**.

**The cycle:**
1. **Release N, Step 2:** `version-sync.js` deletes `www/`, recreates it, and mirrors root `version.json` (canonical `{"version": N}`) into `www/version.json`.
2. **Release N, Step 5:** `git add -A` + commit captures `www/version.json` in **canonical** format.
3. **Release N, Step 6:** `release-native.js` (line 93) rewrites `www/version.json` to **OTA format** (`{"version": "1.0.N", "url": ..., "checksum": ...}`).
4. **After Release N:** on-disk `www/version.json` = OTA format, but git HEAD = canonical format → **dirty working tree** (tracked files are NOT affected by `.gitignore`).
5. **Release N+1, Step 1:** `git status --porcelain` reports `www/version.json` as modified → **UNIVERSAL RELEASE ABORTS**.

**Current state confirms the mechanism:** git HEAD `www/version.json` is in OTA format (`1.0.1405`), matching on-disk — meaning the last commit captured OTA format (from a manual/native commit), NOT the canonical format the new Step 5 would produce. Under the new flow, the committed format (canonical) and post-release format (OTA) diverge, guaranteeing a dirty tree on the next run.

**Why it's a real problem:** The new `release-all.js` will succeed on the FIRST release after this change, then **fail on the SECOND release** at Step 1 with a dirty-tree abort that the user must manually resolve (commit or revert `www/version.json`). This breaks the "fully automated, fast" goal.

**Root cause:** `www/version.json` should never have been tracked — `www/` is gitignored, and this file's content is a build artifact that changes format mid-pipeline.

---

## 5. What I Recommend Changing (with risk levels)

> Principle: **do not change what is correct.** Only the items below address real problems or high-value safety. Everything else stays.

### REC-1 (FIXES P1) — Untrack `www/version.json` (highest priority, LOW risk)
- **Action:** `git rm --cached www/version.json` (one-time), so it becomes fully gitignored like the rest of `www/`.
- **Why:** Eliminates the canonical↔OTA format cycle entirely. `www/version.json` is a build artifact; it should not be in git. After untracking, Step 5's commit no longer includes it, and Step 6's OTA rewrite no longer dirties the tree.
- **Risk: LOW.** `www/` is already gitignored; this just makes `www/version.json` consistent with the rest of `www/`. The file is still generated and deployed every release. No functional change to web/OTA behavior.
- **Caveat:** This is a one-time repo change (removes a tracked file). Must be committed once. After that, the pipeline is self-consistent.

### REC-2 (FIXES R1) — Add `ota-boot-loader.js` and `js/OTAEngine.js` to `.gitignore` (LOW risk)
- **Action:** Add these two paths to `.gitignore`.
- **Why:** They are generated build artifacts (produced by the native/OTA step), not source. If they ever exist at release time, they must not be swept into a release commit.
- **Risk: LOW.** They are not currently tracked, so adding them to `.gitignore` changes nothing today but closes the latent accidental-inclusion vector.
- **Alternative (if they SHOULD be source):** track them deliberately and add them to the explicit commit allowlist (REC-3). But since they're generated only during native build and don't exist now, ignoring is the cleaner choice.

### REC-3 (FIXES R2) — Replace `git add -A` with an explicit allowlist (MEDIUM risk, HIGH safety value)
- **Action:** In Step 5, replace `git add -A` with an explicit list of the files that are allowed to change in a release:
  ```
  git add version.json index.html sw.js app.js js/translations.js android/app/build.gradle
  ```
  (plus any other tracked source files that legitimately change — see note below).
- **Why:** This is the **definitive** answer to the user's question about accidental inclusion. `git add -A` can never accidentally sweep an untracked file (like `ota-boot-loader.js`, a stray temp script, or a new debug file) into a release commit. An allowlist makes the release commit **provably** limited to known release files.
- **Risk: MEDIUM.** The allowlist must be maintained: if a new source file is added that should ship with a release, it must be added to the list, or it won't be committed (and Step 1's dirty-tree check would then block the NEXT release until it's committed). This is a maintenance burden and a new failure mode (forgetting to add a file).
- **Recommendation:** Given the user's explicit concern about accidental inclusion, the allowlist is the **safer** choice for a fully-automated pipeline. The maintenance risk is manageable because the set of release files is small and stable. **However**, if the user prefers minimal change, keeping `git add -A` is acceptable **only after** REC-1 and REC-2 are applied (which remove the two known accidental-inclusion vectors).

### REC-4 (FIXES R4) — Guard or remove the parallel `release-deploy.js` path (LOW risk, optional)
- **Action:** Either (a) add a warning/guard to `release-deploy.js` that it is deprecated in favor of `release-all.js`, or (b) leave it as-is.
- **Why:** It's a divergent web-only path that could deploy a stale state. Not a bug in the universal flow.
- **Risk: LOW.** This is a hygiene improvement, not a correctness fix. **Do not** change its behavior if the user still uses it.

---

## 6. What We Should NOT Touch 🚫

| Item | Reason |
|---|---|
| **Step 1 git status check** | Correct and essential — prevents dirty-tree deploys. Keep. |
| **Step 3 strict version-check** | Correct — prevents wrong-version deploy. Keep. |
| **Step 4 strict verify-health** | Correct — prevents deploy-before-checks. Keep. |
| **Step 7 strict live verify** | Correct — prevents false-success deploy. Keep. |
| **Single deploy inside release-native** | Correct (D2) — prevents double deploy. Keep. |
| **`version-sync.js` mirror logic** | Correct — it's the source of truth for `www/`. Keep. |
| **`.gitignore` build-artifact rules** | Correct — keep all existing rules. |
| **`release-native.js` OTA rewrite of `www/version.json`** | Correct behavior — the OTA manifest must be deployed. The fix is to untrack the file (REC-1), NOT to change this logic. |
| **`release-verify-live.js` retry logic** | Correct — handles edge propagation. Keep. |

---

## 7. Risk Summary Table

| Change | Fixes | Risk | Verdict |
|---|---|---|---|
| **REC-1:** untrack `www/version.json` | P1 (release-blocking) | **LOW** | **Recommended — do this** |
| **REC-2:** gitignore `ota-boot-loader.js` + `js/OTAEngine.js` | R1 (accidental inclusion) | **LOW** | **Recommended — do this** |
| **REC-3:** explicit `git add` allowlist | R2 (broad sweep) | **MEDIUM** | **Recommended if user wants provable safety; optional if REC-1+2 applied** |
| **REC-4:** guard parallel `release-deploy.js` | R4 (divergent path) | **LOW** | Optional hygiene |

---

## 8. Bottom Line

- **The pipeline is already safe** against: file loss, wrong-version deploy, deploy-before-checks, double deploy, and dirty-tree deploy — thanks to the mandatory gates and single-deploy design.
- **One REAL, release-blocking problem exists:** `www/version.json` is tracked and changes format mid-pipeline, guaranteeing a dirty-tree abort on the **second** release after this change. **Fix with REC-1 (untrack it).**
- **One latent accidental-inclusion vector exists:** `ota-boot-loader.js` / `js/OTAEngine.js` are untracked and unignored. **Fix with REC-2 (gitignore them).**
- **`git add -A` is "safe enough" today** but is the broad-sweep vector the user asked about. **REC-3 (explicit allowlist)** is the definitive hardening if the user wants provable commit safety; otherwise REC-1+REC-2 close the known vectors.
- **Do not touch** the mandatory gates, single-deploy design, or version-sync mirror logic — they are correct.

**Awaiting user approval before any implementation.**
