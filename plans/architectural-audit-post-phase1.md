# Architectural Audit Report — Budget Assistant (Post-Phase-1 Cleanup)

**Date:** 2026-08-09
**Scope:** Fresh audit of the cleaned repository. No changes made — findings only.
**Method:** Static analysis of build pipeline, config files, security posture, and code structure.

---

## Executive Summary

The repository is fundamentally sound: the build pipeline is coherent, `www/` is in perfect sync with root source, and the Android bundle ships current code. However, the audit surfaced **1 critical bug**, **4 high-priority issues**, and several medium/low concerns. The most urgent is a **service-worker cache version mismatch** that breaks the version-check tooling and could cause stale-cache behavior.

---

## 🔴 CRITICAL

### C1. `sw.js` CACHE_NAME version mismatch
- **File:** [`sw.js:3`](../sw.js:3)
- **Issue:** `CACHE_NAME = 'money-manager-v1117-'` but the actual version is **1177** ([`version.json:1`](../version.json:1), [`sw.js:1`](../sw.js:1), [`android/app/build.gradle:10`](../android/app/build.gradle:10)).
- **Root cause:** [`build_and_deploy.ps1:36`](../build_and_deploy.ps1:36) bumps `// SW Version` but does **not** update the `CACHE_NAME` string. Only [`scripts/version-sync.js:40`](../scripts/version-sync.js:40) updates it, and `build_and_deploy.ps1` never calls `version-sync.js`. So the cache name drifts every build.
- **Impact:** [`scripts/version-check.js:37`](../scripts/version-check.js:37) expects `money-manager-v1177-` → **version check fails**. The `CACHE_NAME` no longer reflects the SW version, undermining cache-busting correctness.

---

## 🟠 HIGH

### H1. `icon-192.png` missing from `www/` (broken PWA install icon)
- **Files:** [`build_and_deploy.ps1:67-77`](../build_and_deploy.ps1:67) vs [`manifest.json:33`](../manifest.json:33)
- **Issue:** The build copies `icon.png` but **not** `icon-192.png` to `www/`. Yet `manifest.json` references `icon-192.png` (and `_headers` has a rule for `/icon-192.png`). Verified: `www/icon-192.png` does not exist.
- **Impact:** PWA manifest references a 404 → broken/blank install icon on Android/PWA install.

### H2. Hardcoded commit message in deploy script
- **File:** [`build_and_deploy.ps1:160`](../build_and_deploy.ps1:160)
- **Issue:** Every build commits with `"build v${newBuild}: Decrease More card spacing, increase title/subtitle font sizes"` — a stale, unrelated message.
- **Impact:** Git history is misleading; every commit claims the same unrelated change.

### H3. AI endpoints: no rate limiting, optional auth, open CORS
- **Files:** [`functions/api/ai.js:5`](../functions/api/ai.js:5), [`functions/api/coach.js`](../functions/api/coach.js), [`js/OnlineAIProvider.js:44-48`](../js/OnlineAIProvider.js:44)
- **Issue:** The AI functions accept `Access-Control-Allow-Origin: '*'`, and JWT verification is **optional** ("supports Guest Mode"). The client only sends an auth header if a session exists ([`OnlineAIProvider.js:44`](../js/OnlineAIProvider.js:44)); otherwise it calls unauthenticated.
- **Impact:** Anyone can call the Gemini-backed endpoints and consume the API quota (cost/abuse risk). No rate limiting exists.

### H4. `test_models` debug endpoint exposed in production
- **File:** [`functions/api/ai.js:61-77`](../functions/api/ai.js:61)
- **Issue:** A `test_models` mode lists all Gemini models and is reachable in production.
- **Impact:** Unnecessary attack surface / info disclosure; a debug path shipped to prod.

---

## 🟡 MEDIUM

### M1. `cleartext: true` + `allowMixedContent: true` in Capacitor
- **File:** [`capacitor.config.json:7`](../capacitor.config.json:7), `:10`
- **Issue:** Cleartext HTTP and mixed content are enabled globally.
- **Impact:** Weakens transport security; should be scoped to only the specific dev hosts if needed.

### M2. `Browser` plugin `androidScheme: "http"` inconsistent
- **File:** [`capacitor.config.json:22`](../capacitor.config.json:22)
- **Issue:** The Browser plugin uses `http` scheme while the app uses `https`.
- **Impact:** Inconsistent scheme handling; likely a copy-paste artifact.

### M3. `package.json` name is stale (`money-manager`)
- **File:** [`package.json:2`](../package.json:2)
- **Issue:** Package name still `money-manager` after the rename to `budget-assistant`.
- **Impact:** Cosmetic, but confusing for tooling/CI that reads the name.

### M4. `_headers` references non-existent debug files
- **File:** [`_headers`](../_headers)
- **Issue:** Cache rules exist for `/clear.html`, `/nuke.html`, `/ota-poc.html`, `/ota-proof.html`, `/test-version.js` — none of these files exist (verified 0 matches).
- **Impact:** Dead config; implies leftover debug/test pages were removed but their header rules remain.

### M5. Heavy debug logging in production bundle
- **File:** [`app.js`](../app.js) — 268 `console.*` calls
- **Issue:** Verbose `[DEBUG closeModal]` ([`app.js:9946`](../app.js:9946)), `[REALTIME-DEBUG]` ([`app.js:21521`](../app.js:21521)), `[DEBUG] settings-subscreen-back-btn` ([`app.js:24429`](../app.js:24429)) logs ship to production.
- **Impact:** Performance overhead, internal-state exposure in console, noisy logs.

### M6. Global error handler shows raw `alert()` to users
- **File:** [`app.js:293`](../app.js:293)
- **Issue:** On any uncaught error, the app shows a raw `alert()` with the message and line number.
- **Impact:** Poor UX; leaks internal error details to end users.

### M7. Hardcoded one-off data-cleanup logic in main app
- **File:** [`app.js:4733`](../app.js:4733), `:4745`, `:4758`
- **Issue:** Specific cleanup for "644.92€", "ΔΑΝΕΙΟ ΣΠΙΤΙΩΝ", "ENFIA 273.01€" transactions runs on every load.
- **Impact:** One-off data migration baked into the hot path; should be a one-time migration, not per-load logic.

### M8. Android bundled web assets committed to repo
- **File:** `android/app/src/main/assets/public/`
- **Issue:** A full copy of the web app is committed under the Android project (derived from `www/` by `cap sync`). Currently in sync (verified hash match), but it's a large derived artifact in version control.
- **Impact:** Repo bloat; risk of drift if `cap sync` isn't run; should be gitignored and regenerated.

---

## 🟢 LOW / OBSERVATIONS

### L1. Duplicate version-bump tooling
- [`scripts/version-bump.js`](../scripts/version-bump.js) → calls `version-sync.js`, but [`build_and_deploy.ps1`](../build_and_deploy.ps1) does its own inline regex bumping and never calls these scripts. Two parallel versioning paths that can drift (as seen in C1).

### L2. Hardcoded Supabase URL/anon key in client
- [`app.js:439`](../app.js:439) — Supabase URL + anon key in the client bundle. This is **expected** for Supabase (anon keys are public), but the URL is duplicated across `app.js` and all three `functions/*.js` as fallbacks. Centralizing via env would reduce duplication.

### L3. `functions/api/delete-account.js` — good practice confirmed
- [`functions/api/delete-account.js:33`](../functions/api/delete-account.js:33) correctly reads `SUPABASE_SERVICE_ROLE_KEY` from `env` (not hardcoded) and returns 500 if missing. This is the correct pattern. The anon-key fallback is publishable and acceptable.

### L4. `www/` and Android bundle are in sync
- Verified `app.js`, `index.html`, `style.css` hashes match between root, `www/`, and `android/app/src/main/assets/public/`. The build pipeline correctly regenerates these.

---

## Recommended Priority Order

1. **Fix C1** — make `build_and_deploy.ps1` update the `CACHE_NAME` (or call `version-sync.js`), so version-check passes and cache naming is correct.
2. **Fix H1** — add `icon-192.png` to the `www/` copy step in `build_and_deploy.ps1`.
3. **Fix H2** — parameterize the git commit message (e.g., read from a changelog or accept an argument).
4. **H3/H4** — add rate limiting + require auth on AI endpoints; remove/guard `test_models`.
5. **M1/M2** — tighten Capacitor security config (disable cleartext/mixed content; fix Browser scheme).
6. **M4** — prune stale `_headers` rules.
7. **M5/M6/M7** — strip debug logs, replace raw `alert()` with a styled toast, move one-off cleanups to a migration.
8. **M8/L1** — gitignore the Android bundled assets; unify version-bump tooling.

---

## Re-audit Status (2026-08-09, after release-pipeline consolidation `e42614b`)

The following prior findings were **resolved** by the release-pipeline consolidation and subsequent hardening:

| ID | Finding | Status |
|----|---------|--------|
| C1 | `sw.js` CACHE_NAME mismatch | ✅ Resolved — `version-sync.js` now updates CACHE_NAME |
| H1 | `icon-192.png` missing from `www/` | ✅ Resolved — `version-sync.js` mirror list copies it |
| H2 | Hardcoded commit message | ✅ Moot — `build_and_deploy.ps1` retired to `archive/` |
| H3 | AI endpoints: no rate limit, open CORS | ✅ Resolved — shared `_security.js` enforces CORS restriction, rate limiting (30/min/IP), body-size guard, optional JWT |
| H4 | `test_models` debug endpoint | ✅ Resolved — endpoint removed (0 matches in repo) |
| M1 | `cleartext: true` + mixed content | ✅ Resolved — `cleartext: false`, `allowMixedContent: false` |
| M2 | Browser `androidScheme: "http"` | ✅ Resolved — now `"https"` |
| M4 | Stale `_headers` debug rules | ✅ Resolved — `_headers` is clean |
| L1 | Duplicate version-bump tooling | ✅ Resolved — single canonical path |

### New finding & fix (this re-audit)

**N1. `functions/api/delete-account.js` used `Access-Control-Allow-Origin: *` and bypassed the shared security module.**
- A destructive, high-privilege endpoint (permanently deletes user accounts via `SUPABASE_SERVICE_ROLE_KEY`) was inconsistent with the hardened AI endpoints: it allowed any origin to attempt the call and had no rate limiting or body-size guard.
- **Fix applied:** `delete-account.js` now imports `validateRequest`/`corsHeadersFor` from `_security.js`, restricting CORS to the app's allowed origins and adding rate limiting + body-size guard. The app calls this endpoint via a same-origin relative fetch ([`app.js:27876`](../app.js:27876)), so legitimate use is unaffected.

### Remaining (lower priority, from prior audit)
- **M3** — `package.json` name still `money-manager` (cosmetic).
- **M5** — heavy debug logging in production bundle.
- **M6** — raw `alert()` global error handler.
- **M7** — hardcoded one-off data-cleanup logic in the hot path.
- **M8** — Android bundled web assets committed to repo.

*This report is informational. The N1 fix is the only code change made during this re-audit.*
