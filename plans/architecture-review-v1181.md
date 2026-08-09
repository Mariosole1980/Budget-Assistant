# Architecture Review — Budget Assistant (baseline v1181)

**Role:** Senior Software Architect — independent, evidence-based assessment
**Scope:** Full repository audit. No code changes were made.
**Baseline:** v1181 (production)
**Date:** 2026-08-09

---

## 1. Executive Summary

Budget Assistant is a **single-page, mobile-first personal/family finance app** that runs on **three surfaces simultaneously** from one codebase:

1. **Web/PWA** — served from Cloudflare Pages, with a Service Worker for offline + a custom JS OTA updater.
2. **Android native** — a Capacitor wrapper around the same `www/` web assets, with **Capgo** for OTA updates and custom native plugins (biometrics, secure mode, theme).
3. **Cloudflare Functions** — thin serverless proxies to the Gemini AI API.

The core of the application is a **~29,000-line monolith** ([`app.js`](app.js)) that contains essentially the entire application: state management, all UI rendering, all business logic, sync, realtime, auth, family, AI coach, import/export, notifications, recurring templates, trash bin, and multi-currency. It is loaded as a **classic global-scope script** (no modules, no build step, no bundler).

**The single most important architectural fact:** the app is a *working* monolith that has shipped 1,181 builds over 507 commits. It is **not broken**, but it is **structurally fragile** in ways that make every change risky. The good news is that the risk is **concentrated and identifiable**, not uniform.

**Verdict on the "modularize app.js" hypothesis:** Modularizing `app.js` *for its own sake* is **not** the right first move. The file is large but internally organized into coherent function clusters. The highest-value, lowest-risk improvements are **not** about splitting the file — they are about (a) fixing a **critical data-security exposure**, (b) **removing dead/duplicate code**, and (c) **de-risking the release pipeline**. A careful, incremental extraction of *specific* high-coupling subsystems (sync, realtime, AI) can follow, but only after the pipeline and data-layer risks are controlled.

---

## 2. Current Architecture

### 2.1 Runtime surfaces

```
                    ┌─────────────────────────────────────────────┐
                    │              index.html (5,012 lines)       │
                    │  Recovery bootloader + OTA updater + SW reg │
                    └───────────────┬─────────────────────────────┘
                                    │ loads (classic <script>, global scope)
        ┌───────────────────────────┼───────────────────────────────┐
        │                           │                               │
   js/supabase.js             js/*.js (AI stack)              app.js (29,246 lines)
   (vendored, minified)       CurrencyService.js               (entire app)
        │                           │                               │
        └───────────────────────────┴───────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
            Cloudflare Pages                   Capacitor (Android)
            (PWA + Functions)                  (same www/ assets)
                    │                                │
            Supabase (Postgres + Auth + Realtime)    Capgo OTA
```

### 2.2 Component inventory

| Component | Location | Size | Role |
|---|---|---|---|
| App monolith | [`app.js`](app.js) | 29,246 lines / 1.2 MB | Everything: state, UI, logic, sync, AI coach |
| HTML shell | [`index.html`](index.html) | 5,012 lines | Markup + recovery bootloader + OTA + SW registration |
| Service Worker | [`sw.js`](sw.js) | 131 lines | Offline cache, network-first, OTA-aware |
| Supabase client | [`js/supabase.js`](js/supabase.js) | 206 KB (minified) | Vendored full Supabase SDK → `window.supabase` |
| Currency | [`js/CurrencyService.js`](js/CurrencyService.js) | 568 lines | Multi-currency conversion (well-isolated class) |
| AI stack | [`js/AIEngine.js`](js/AIEngine.js), [`NLPProcessor.js`](js/NLPProcessor.js), [`MemoryEngine.js`](js/MemoryEngine.js), [`DecisionEngine.js`](js/DecisionEngine.js), [`IntentCorpus.js`](js/IntentCorpus.js), [`KnowledgeGraph.js`](js/KnowledgeGraph.js), [`OnlineAIProvider.js`](js/OnlineAIProvider.js) | ~1,000 lines total | Client-side AI intent parsing + online/offline fallback |
| Cloudflare Functions | [`functions/api/ai.js`](functions/api/ai.js), [`coach.js`](functions/api/coach.js), [`delete-account.js`](functions/api/delete-account.js), [`_security.js`](functions/api/_security.js) | ~600 lines | Gemini proxy, CORS, rate-limit, JWT check |
| Android native | [`android/`](android/) | — | Capacitor wrapper + `SecurityPlugin`, `NativeThemePlugin` |
| Build/deploy | [`build_and_deploy.ps1`](build_and_deploy.ps1), [`scripts/`](scripts/) | — | Version bump, www mirror, Capgo bundle, gradle, wrangler, git |
| Schema | [`supabase-schema.sql`](supabase-schema.sql) + 6 migration `.sql` files | — | Postgres schema + RLS |

### 2.3 State management

A single global mutable object `state` ([`app.js:437`](app.js:437)) holds ~40 fields: `transactions`, `accounts`, `categories`, `notes`, `budgets`, `currentUser`, `userProfile`, `partnerProfile`, `familyProfiles`, `syncStatus`, `lang`, `supabaseClient`, etc. There is **no reactive layer** — the app uses an imperative `updateUI()` / `_updateUIImpl()` render pipeline with manual DOM updates, plus a **reference-counted "no-transition" guard** and a **deferred-render timer** to prevent flicker.

### 2.4 Persistence

- **Cloud:** Supabase Postgres (transactions, accounts, categories, profiles, recurring templates, budgets, notes, trash).
- **Local:** `localStorage` for nearly everything (offline transactions, categories, accounts, sync queue, notifications, settings, cached user profiles) + **IndexedDB** for receipt photos and OTA bundle storage.
- **Sync:** a **sync queue** in `localStorage` (`money_manager_sync_queue`) for offline mutations, flushed on reconnect; full re-fetch with pagination (1000/page) in `forceSyncNow`; **Supabase Realtime** (`postgres_changes`) for live partner/family updates.

### 2.5 Authentication & multi-tenancy

- Supabase Auth (email/password + guest mode). Guest mode is a first-class feature.
- **Family/partner model:** `profiles` table links partners; `family_id` groups members. RLS policies allow a user to see their own rows + partner's rows.
- **Critical:** the *canonical* schema file disables RLS; a *later* migration enables it (see §3.1).

### 2.6 AI

Two paths: (1) **online** via Cloudflare Functions → Gemini (extract + advisor modes), and (2) **offline** fallback via the client-side NLP/Memory/Decision stack. The AI coach (advisor) is a large feature embedded in `app.js` (~2,500 lines of coach logic + conversation persistence).

### 2.7 OTA / versioning

- **Web/PWA:** inline updater in `index.html` polls `version.json` (cache-busted), and on a newer version clears caches, unregisters the SW, and hard-reloads. The SW itself is network-first and explicitly never caches `app.js`/`style.css`/`version.json`.
- **Android:** Capgo `CapacitorUpdater` with a public key, `autoUpdateUrl` pointing at the same `version.json`. The web updater is skipped when `window.Capacitor` is present to avoid a reload loop.
- **Version source of truth:** `version.json`; `scripts/version-sync.js` propagates it into `index.html`, `sw.js`, `app.js`, `build.gradle`, and mirrors to `www/`.

---

## 3. Major Architectural Problems

### 3.1 [CRITICAL — Security] RLS is disabled in the canonical schema

[`supabase-schema.sql`](supabase-schema.sql) does:

```sql
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
-- ...and creates "Allow public select/insert/update/delete" policies with USING (true)
```

The anon/publishable key is **hardcoded in the client** ([`app.js:455`](app.js:455)) and in the Functions fallback ([`functions/api/ai.js:43`](functions/api/ai.js:43)). A later migration, [`tenant-isolation-migration.sql`](tenant-isolation-migration.sql), *enables* RLS with proper user/partner policies — so the **production DB is likely protected today**. But the two files **directly contradict each other**, and re-running `supabase-schema.sql` (or anyone following it as "the schema") would **re-open the entire database to the public**: any user could read, modify, or delete every family's financial data. This is the single highest-severity issue in the repository.

- **What it solves:** eliminates a catastrophic data-exposure foot-gun.
- **Gain:** removes the risk of a full data breach on a schema reset.
- **Risk:** low — production already uses the isolated policies; this is a documentation/consistency fix.

### 3.2 [HIGH] The 29,000-line monolith + global scope

`app.js` is one file, one global scope. Every function is a global; dozens are explicitly attached to `window` (e.g. [`app.js:6644`](app.js:6644) `window.renderCategoryBudgetsView`). Consequences:

- **No encapsulation:** any function can read/mutate any other's state; there are no interfaces or boundaries.
- **Implicit coupling:** changing one feature can silently break another via shared globals.
- **Hard to test:** no module boundaries, no import graph, no unit-test seam.
- **Fragile defensive hacks accumulate** (see §3.4).

### 3.3 [HIGH] Duplicate/dead code from a bad merge

Five functions are **defined twice** in `app.js`:

| Function | First def | Second def |
|---|---|---|
| `renderCategoryBudgetsView` | 6523 | 6835 |
| `openCategoryBudgetModal` | 6682 | 6953 |
| `setBudgetAmountPreset` | 6750 | 6999 |
| `selectBudgetScope` | 6758 | 7007 |
| `saveCategoryBudgetFromModal` | 6774 | 7023 |

In JavaScript, the **second definition wins** (hoisting). The first block (lines 6523–6834, ~310 lines) is **dead code** that is never executed. The two `renderCategoryBudgetsView` implementations are **different** (the first handles subcategories, the second does not) — a clear sign of a botched merge or copy-paste. This is both wasted code and a **maintenance hazard**: a future edit to the "wrong" copy will silently do nothing.

### 3.4 [HIGH] Defensive hacks layered on the global architecture

The codebase contains multiple self-healing/watchdog mechanisms that exist *because* the global-scope architecture is fragile:

- **`FallbackCurrencyService`** ([`app.js:242`](app.js:242)): a complete inline duplicate of `CurrencyService` (~40 methods) plus a **watchdog with multiple timers** to re-install it if the async-loaded `js/CurrencyService.js` "clobbers" `window.CurrencyService` with a stale instance. The comment explicitly says it guarantees `"CurrencyService.isEnabled is not a function" can NEVER occur` — i.e. this is a scar from a past production incident.
- **Realtime suppression counter** ([`app.js:21266`](app.js:21266)): a global `_suppressRealtimeEvents` exposed via `Object.defineProperty` on `window`, with a documented "can get stuck" problem that required two more helpers (`suppressRealtimeFor`, `withRealtimeSuppression`) to fix.
- **Recovery Mode bootloader** in `index.html`: catches startup errors and timeouts, with a cache-reset escape hatch — a safety net for a fragile boot path.

These are not "bad code" per se — they are **rational responses to a fragile foundation**. But they are also **technical debt**: each is a workaround that adds complexity rather than removing the root cause.

### 3.5 [HIGH] Build/deploy pipeline duplication and drift

There are **two parallel release pipelines** that do overlapping work differently:

- [`build_and_deploy.ps1`](build_and_deploy.ps1) (PowerShell): regex version bump, www mirror, Capgo bundle, `cap sync`, gradle, deploy to **ONE** Pages project (`budget-assistant-pwa`), git commit.
- [`scripts/release-deploy.js`](scripts/release-deploy.js) (Node): git-clean check, version bump, consistency check, pre-deploy commit, deploy to **TWO** Pages projects (`budget-assistant-pwa` **and** `money-manager-pwa`), live verification.

**Drift:** the two scripts deploy to a different number of projects and use different version-bump mechanisms. The version bump itself is done by **regex string replacement** (`-replace 'build v\d+'`) across source files — fragile and easy to corrupt (e.g. the `version-sync.js` regexes already target specific strings like the user-guide badge).

### 3.6 [MEDIUM] Broken/stale references and committed build artifacts

- **`capacitor.js` is referenced in `index.html:163` but does not exist** at root or in `www/` — a guaranteed 404 on web (silently tolerated).
- **`clear.html`, `nuke.html`, `debug.html`, `ota-boot-loader.js`, `js/OTAEngine.js` are referenced** by `version-sync.js` and `sw.js` but **do not exist** — dead code paths in the versioning pipeline.
- **`www/` is in `.gitignore` but 28 files remain tracked** in git (committed before the ignore was added). The committed `www/` is a **stale snapshot** that diverges from root and even contains a committed OTA zip (`com.budgetassistant.app_1.0.1181.zip`).
- **4 CSS files** exist (`style.css` active; `live_style.css`, `original_style.css`, `preview_design.css` are reference/backup copies) — a source of confusion about which is canonical.
- **`archive/`** holds stale APKs, OTA zips, and a `v910_reconstructed` directory — evidence of past recovery work that should not be in the active repo.

### 3.7 [MEDIUM] Schema evolution via ad-hoc SQL files

There are **7 SQL files** (`supabase-schema.sql` + 6 migrations) with **no migration tool, no ordering, no idempotency guarantee, and no single source of truth**. The `tenant-isolation-migration.sql` contradicts `supabase-schema.sql` (§3.1). There is no way to know, from the repo alone, what the actual production schema is.

### 3.8 [MEDIUM] Client-side query logic tightly coupled to the RLS model

`forceSyncNow` ([`app.js:21583`](app.js:21583)) builds complex `.or()` filters combining `family_id`, `user_id`, and `partner_id` in four different branches. A comment at [`app.js:21694`](app.js:21694) notes a recovery feature was **disabled** because it caused "infinite upsert loops when RLS filtered out partner transactions." This coupling means any RLS change can silently break sync, and any sync change can break under RLS.

---

## 4. Technical Debt Assessment

| Area | Debt level | Notes |
|---|---|---|
| `app.js` monolith | **Very high** | 29k lines, global scope, no tests, no modules |
| Duplicate/dead code | **High** | ~310 lines dead budget code; duplicate CurrencyService |
| Defensive hacks | **High** | CurrencyService watchdog, realtime suppression counter, recovery bootloader |
| Release pipeline | **High** | Two divergent scripts, regex version bumps, stale www |
| Schema management | **High** | 7 ad-hoc SQL files, contradictory RLS |
| Vendored deps | **Medium** | `js/supabase.js` is a minified vendored SDK (206 KB) — hard to update/audit |
| AI stack | **Medium** | Client-side NLP is legacy; online path is the primary |
| Offline/sync | **Medium** | Sync queue + realtime + dedup is complex and fragile |
| CSS | **Medium** | 4 files, 201 KB active stylesheet, inline styles throughout |
| Android native | **Low** | Clean, small, well-scoped plugins |

**Overall:** the debt is **concentrated in the front-end monolith and the release tooling**, not in the backend or native layer. This is favorable: the highest-risk areas are the ones you already know are fragile.

---

## 5. Dependency / Coupling Analysis

### 5.1 Coupling map (what depends on what)

```
app.js (everything)
  ├── window.supabase          (js/supabase.js)      — data + auth + realtime
  ├── window.CurrencyService   (js/CurrencyService.js + inline fallback) — currency
  ├── window.AIEngine / NLP / Memory / Decision / OnlineAIProvider — AI
  ├── window.Capacitor         (native only)         — biometrics, secure mode, OTA
  ├── localStorage / IndexedDB                        — persistence
  └── DOM (index.html ids)                            — all rendering
```

### 5.2 Highest-coupling points

1. **The `state` object** — every subsystem reads/writes it. It is the de-facto global bus.
2. **`updateUI()` / `_updateUIImpl()`** — the single render pipeline that every mutation funnels through; it is the most-called function and the most likely to cause regressions.
3. **`window.CurrencyService`** — used by budgets, stats, transactions, export; the inline fallback + watchdog shows how critical and fragile this global is.
4. **The realtime/sync subsystem** — `forceSyncNow`, `handleRealtimeTransactionChange`, the suppression counter, and the sync queue are deeply interwoven with both the data layer and the UI render pipeline.
5. **The OTA/version system** — `version.json`, `sw.js`, `index.html` updater, Capgo, and the build scripts all must agree on the version; any drift breaks updates.

### 5.3 Hidden dependencies / implicit globals

- `window.CurrencyService` (with an inline duplicate + watchdog).
- `window._suppressRealtimeEvents` (a global counter exposed on `window`).
- `window._suppressTransitions`, `window._appLoaded`, `window._activeNoteReminders`, `window.AIDebugLog`.
- `window.supabase` (vendored SDK global).
- `state` — a single mutable global read by everything.
- `localStorage` keys used as an implicit cross-module channel (e.g. `offline_transactions`, `money_manager_sync_queue`, `cached_current_user`, `_ba_last_update_check`).
- The **missing `capacitor.js`** reference — a hidden broken dependency.

---

## 6. Risk Assessment

### 6.1 What is dangerous to touch

| Area | Risk | Why |
|---|---|---|
| **Realtime/sync** | **Extreme** | Global suppression counter, debounce, dedup, RLS coupling, documented "stuck" bugs. Any change risks data loss, loops, or flicker. |
| **`updateUI()` render pipeline** | **Extreme** | Every feature renders through it; anti-flicker guards are timing-sensitive (rAF + setTimeout + no-transition ref-counting). |
| **OTA/version pipeline** | **High** | A versioning mistake can brick updates for all users (web + Android). The web updater clears caches and unregisters the SW — a bug here = users stuck on old builds. |
| **CurrencyService** | **High** | Used everywhere; the watchdog exists because it broke in production before. |
| **Auth/family/RLS** | **High** | Multi-tenancy + guest mode + partner sync; an RLS or query change can expose data or break sync. |
| **AI coach** | **Medium** | Large feature but mostly additive; lower blast radius. |
| **Android native** | **Low** | Small, well-scoped; but a Capgo misconfiguration breaks OTA. |

### 6.2 What is safe to touch

- Dead/duplicate code removal (the unused budget functions, the missing-file references).
- Adding tests around pure logic (currency conversion, date formatting, dedup).
- Documentation of the schema and RLS state.
- The `www/` cleanup (removing stale tracked artifacts).

---

## 7. What Should NOT Be Changed (yet)

1. **Do not rewrite `app.js` into modules as a big-bang refactor.** The file works; a full rewrite is the highest-risk change possible and would almost certainly introduce regressions across 1,181 builds of accumulated behavior. This is the "don't refactor for refactoring's sake" case.
2. **Do not touch the realtime/sync subsystem** until there is a test harness and a clear understanding of the suppression/debounce invariants. It is the most fragile code in the repo.
3. **Do not change the OTA/version mechanism** without a rollback plan. It is load-bearing for both web and Android.
4. **Do not re-run `supabase-schema.sql`** against production — it would disable RLS.
5. **Do not change the AI coach's prompt/response contract** casually — the client parses a strict JSON schema from the Functions response; a mismatch breaks the feature.
6. **Do not remove the `FallbackCurrencyService` watchdog** until the root cause (async script clobbering) is eliminated — it is protecting production right now.

---

## 8. What Should Be Improved

### 8.1 Fix the RLS/schema contradiction (highest priority)
Make `supabase-schema.sql` reflect the *actual* production state (RLS enabled, tenant-isolated policies). Delete or clearly mark the contradictory "Allow public" policies. This is a documentation/consistency fix with near-zero runtime risk and eliminates the biggest foot-gun.

### 8.2 Remove dead/duplicate code
Delete the first (dead) copies of the five budget functions (lines 6523–6834). This is safe because the second definitions win and are the ones actually called. Also remove references to non-existent files (`capacitor.js`, `clear.html`, `nuke.html`, `debug.html`, `ota-boot-loader.js`, `js/OTAEngine.js`) or create them if they're actually needed.

### 8.3 Consolidate the release pipeline
Pick **one** pipeline (the Node `scripts/release-deploy.js` is the more robust one) and retire `build_and_deploy.ps1`, or make them share a single version-bump module. Replace regex string replacement with a single source of truth for the version number.

### 8.4 Clean up the repo
- Remove the stale tracked `www/` files from git (they're gitignored but still tracked).
- Remove `archive/` from the active repo (move to a tag/branch or external storage).
- Consolidate the 4 CSS files to one canonical `style.css`.

### 8.5 Add a test harness for pure logic
The highest-leverage, lowest-risk improvement: extract and unit-test the **pure functions** (currency conversion, date formatting, transaction dedup/merge, category classification). This creates a safety net *before* any larger refactor.

### 8.6 Introduce a real migration tool
Adopt a simple, ordered migration mechanism (even a numbered `migrations/` folder with a tracking table) so the schema has a single source of truth and is reproducible.

---

## 9. Alternative Solutions

### A. Do nothing / status quo
- **Pros:** zero risk; the app works.
- **Cons:** every change remains risky; debt grows; the RLS foot-gun stays live; the pipeline drift persists. Not viable for "evolve for years."

### B. Incremental extraction (recommended)
Extract subsystems **one at a time**, each behind a stable interface, with tests, without changing behavior:
1. Pure logic helpers → testable modules.
2. CurrencyService (already isolated) → formalize as the single source.
3. AI stack → already in `js/` files; formalize their interfaces.
4. Sync/realtime → extract *only after* tests exist for the pure parts.
- **Pros:** low risk per step; each step is independently shippable and revertible.
- **Cons:** slower; requires discipline to avoid "extraction for its own sake."

### C. Big-bang modularization / rewrite
Split `app.js` into ES modules with a bundler (Vite/Rollup), introduce a reactive state layer, etc.
- **Pros:** cleanest end state.
- **Cons:** **highest risk**; would touch the OTA/SW/Capgo pipeline (which expects specific file names like `app.js`), the `www/` mirror, and every render path. **Not recommended now.**

### D. Adopt a framework (React/Vue) + backend refactor
- **Pros:** modern DX.
- **Cons:** complete rewrite of a working app; would break the entire OTA/Android/PWA pipeline; years of behavior to re-implement. **Not recommended.**

---

## 10. Recommended Target Architecture

The target is **not** a rewrite. It is a **progressive de-coupling** that keeps the working monolith but makes it *safer to change*:

```
Phase 0 (now):  Fix RLS doc, remove dead code, clean repo, one release pipeline.
Phase 1:        Test harness for pure logic (currency, dates, dedup, categories).
Phase 2:        Formalize module boundaries via IIFE/namespace or ES modules
                WITHOUT a bundler change that breaks OTA (keep app.js as the
                entry that loads the same files).
Phase 3:        Extract sync/realtime behind a service with a clear API.
Phase 4 (later): Optionally introduce a bundler ONLY after OTA/SW/Capgo
                compatibility is proven (the SW and Capgo expect specific
                artifact names; a bundler must preserve them).
```

**Key principle:** the OTA/SW/Capgo pipeline and the `www/` artifact layout are **constraints**, not implementation details. Any target architecture must preserve: `app.js`, `style.css`, `version.json`, `sw.js`, and the `www/` mirror contract.

---

## 11. Recommended Implementation Order

1. **RLS/schema consistency** (hours, near-zero risk) — remove the data-exposure foot-gun.
2. **Dead code + broken reference cleanup** (hours, low risk) — remove the duplicate budget functions and stale file references.
3. **Repo hygiene** (hours, low risk) — untrack stale `www/`, move `archive/`, consolidate CSS.
4. **Single release pipeline** (1–2 days, medium risk) — consolidate `build_and_deploy.ps1` + `scripts/`; make version a single source of truth; add a dry-run mode.
5. **Pure-logic test harness** (2–3 days, low risk) — extract + test currency, dates, dedup, categories. This is the foundation for everything after.
6. **Formalize module boundaries** (incremental, low-medium risk) — namespace the AI stack and CurrencyService; keep `app.js` as the loader.
7. **Extract sync/realtime** (only after 5–6, medium-high risk) — behind a service interface, with the existing behavior preserved.
8. **Optional bundler adoption** (only after 1–7 proven, high risk) — with OTA/SW/Capgo compatibility verified first.

---

## 12. Expected Benefits

- **RLS fix:** eliminates the risk of a catastrophic public data breach on schema reset.
- **Dead code removal:** less confusion, smaller file, no more editing the wrong copy.
- **Single pipeline:** no more drift between two deploy scripts; reproducible, verifiable releases.
- **Test harness:** the first real safety net; makes future refactors measurable instead of faith-based.
- **Module boundaries:** reduces the blast radius of any single change; makes debugging tractable.
- **Repo hygiene:** removes stale artifacts that mislead and bloat the repo.

---

## 13. Risks and Rollback Strategy

| Change | Risk | Rollback |
|---|---|---|
| RLS doc fix | Very low (doc only) | Revert commit |
| Dead code removal | Low (dead by definition) | Revert commit; the deleted block is in git history |
| Repo hygiene | Low | Revert commit; re-add files |
| Pipeline consolidation | Medium | Keep the old script until the new one is proven; both are in git |
| Test harness | Low | Tests are additive; revert if they break the build |
| Module extraction | Medium | Each extraction is a separate revertible commit; keep behavior identical |
| Sync/realtime extraction | High | Feature-flag it; keep the old path as fallback; test on staging first |

**Universal rollback principle:** every step is an **independent, revertible commit** that does **not** change behavior. No step should combine a refactor with a feature change. The OTA/SW/Capgo pipeline must be verified after any change to the artifact layout.

---

## 14. What I Would Do First If This Were My Production Project

1. **Immediately** reconcile the RLS/schema contradiction and confirm production RLS is actually enabled and correct. This is the only issue that could cause a catastrophic, unrecoverable data breach, and it costs hours. I would verify with a live query using the anon key that I *cannot* read another user's data.
2. **Then** remove the dead budget code and broken file references — quick wins that reduce confusion and file size with no behavior change.
3. **Then** consolidate the two release pipelines into one, with a dry-run mode and a version single-source-of-truth, because the current regex-based, dual-script setup is a ticking time bomb for the next release.
4. **Then** build the pure-logic test harness. This is the single most important investment for making the monolith safely evolvable — it converts "I hope this doesn't break" into "I can prove this didn't break."
5. **Only after all of the above** would I consider extracting the sync/realtime subsystem, and even then behind a service interface with the existing behavior preserved and feature-flagged.

I would **not** attempt a big-bang modularization or framework rewrite. The app has 1,181 builds of accumulated, working behavior; the risk of a rewrite far exceeds the benefit, and the OTA/Android/PWA pipeline makes a rewrite especially dangerous. The path to "evolve for years without fear" is **incremental de-risking**, not rewriting.

---

*This review is based on direct inspection of the repository at v1181. No source or production files were modified.*
