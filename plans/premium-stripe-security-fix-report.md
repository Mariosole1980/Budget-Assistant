# Premium / Stripe Security Fix — Final Report

**Date:** 2026-08-09
**Scope:** Full correction of the Premium/Stripe security audit findings (B1 BLOCKER + W1–W5 WARNINGS).
**Status:** All fixes implemented, tested, and re-audited. **NOT yet deployed to production** (per release policy).

---

## 1. What Was Fixed

### B1 (BLOCKER) — Users could self-grant Premium
- **Root cause:** The `profiles` UPDATE RLS policy allowed `id = auth.uid()`, so any authenticated user could PATCH their own row and set `premium_active = true`.
- **Fix:** Added a `BEFORE UPDATE` trigger `trg_protect_premium` on `public.profiles` that raises an exception if `premium_active` or `premium_purchased_at` changes while `auth.role() <> 'service_role'`. The Stripe webhook uses the service role key, so it continues to work. Legitimate profile updates (name, avatar, etc.) that do not touch premium columns still succeed.
- **File:** [`premium-security-fix-migration.sql`](../premium-security-fix-migration.sql:30)

### W4 (WARNING) — Users could reset their own AI usage counter
- **Root cause:** `ai_usage` had INSERT/UPDATE RLS policies allowing users to write their own row, so a user could set `call_count = 0` and bypass the fair-use limit (unbounded Gemini spend).
- **Fix:** Dropped the INSERT/UPDATE policies on `ai_usage` (kept SELECT so the client can still read its count). All writes are now handled server-side by the SECURITY DEFINER RPCs `increment_ai_usage()` / `get_ai_usage()`.
- **File:** [`premium-security-fix-migration.sql`](../premium-security-fix-migration.sql:57)

### W1 / W2 / W3 (WARNING) — Cloud transaction limit was client-side only
- **Root cause:** The 100-transactions/month cloud limit for Free users was enforced only in `app.js`. A user could bypass it by direct Supabase inserts, or via the ungated recurring-regeneration and trash-restore paths.
- **Fix:** Added a `BEFORE INSERT` trigger `trg_enforce_cloud_tx_limit` on `public.transactions` that counts the user's rows created this month and raises an exception at 100 for non-Premium users. Premium users are unlimited. The trigger is authoritative at the database level regardless of client.
- **Client hardening:** The two ungated paths now queue transactions on trigger rejection (never drop financial data):
  - [`regenerateRecurringTemplateTransactions()`](../app.js:27478) — queue-on-error
  - [`restoreTrashGroup()`](../app.js:29923) — changed fire-and-forget upsert to `.then()/.catch()` that queues on error
- **File:** [`premium-security-fix-migration.sql`](../premium-security-fix-migration.sql:85)

### W5 (WARNING) — No recovery if the Stripe webhook is lost
- **Root cause:** If the webhook never fires (misconfigured, endpoint down >3 days), a paying user would never get Premium.
- **Fix:** Created the reconciliation endpoint [`functions/api/premium-status.js`](../functions/api/premium-status.js:37):
  - Authenticates the caller via JWT (Bearer token → `/auth/v1/user`).
  - Queries Stripe for the authenticated user's paid Checkout Sessions (bound to `client_reference_id = user id`).
  - Grants entitlement via the service role key **only** if a real, paid, one-time (`mode === 'payment'`) session exists.
  - Idempotent: already-premium profiles return immediately; no paid session returns `premium_active: false` (safe default).
- **Client wiring:**
  - [`restorePremiumPurchase()`](../app.js:11901) now calls `reconcilePremiumPurchase()` before re-fetching the profile.
  - New [`reconcilePremiumPurchase()`](../app.js:11922) calls `/api/premium-status` with a 3-attempt retry loop.
  - The `?premium=success` return handler also calls reconciliation before re-fetching the profile.

---

## 2. What Tests Were Done

### Automated tests — `npm test` (all 32 pass)
- **16 new security tests** in [`test/premiumSecurity.test.js`](../test/premiumSecurity.test.js) (A1–A16).
- **16 existing transaction-merge tests** in [`test/transactionMerge.test.js`](../test/transactionMerge.test.js) — all still pass (no regressions).

### Syntax verification
- `node --check app.js` → **PASS**
- `node --check test/premiumSecurity.test.js` → **PASS**
- `node --input-type=module --check < functions/api/premium-status.js` → **PASS** (ESM, consistent with the other Cloudflare functions)

### Deployment / parity verification
- `www/app.js` is byte-identical to root `app.js` (`fc /b` → identical), so the deployable PWA artifact includes all fixes.
- **BLOCKER FOUND & FIXED (2026-08-09):** The deploy uses `wrangler pages deploy www`, and `scripts/version-sync.js` rebuilt `www/` from scratch but did **NOT** mirror the `functions/` directory. This meant the Cloudflare Pages Functions (`/api/purchase`, `/api/webhook`, `/api/premium-status`) would **not** be deployed to production. Fixed by adding `'functions'` to `dirsToMirror` in [`scripts/version-sync.js`](../scripts/version-sync.js:123). Verified: `www/functions/api/*` now contains all 7 function files, all pass ESM syntax check, and `node scripts/version-check.js` → **PASS**.
- `.pagesignore` does **not** exclude `functions/`, so the mirrored functions deploy correctly from `www/`.
- No secrets hardcoded in any function — all secret references (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) are accessed only via `env.X` bindings. The only hardcoded key is the Supabase anon/publishable key (public by design).

### Transaction write-path audit (all 4 direct upsert paths in app.js)
| Path | Line | Verdict |
|------|------|---------|
| `loadData` recovery upsert | 4436 | Inside a **commented-out/disabled block** (lines 4427–4442) — not active, no gating needed |
| `backfillRecurringTemplateIds` | 5682 | Only upserts `{id, recurring_template_id}` for existing rows → **UPDATE, not INSERT** → trigger doesn't fire → unaffected |
| `regenerateRecurringTemplateTransactions` | 27478 | Now **queues on trigger rejection** (data preserved) |
| `restoreTrashGroup` | 29923 | Now **queues on trigger rejection** (data preserved) |

The main sync paths (`syncLocalTransactionsToCloud` at 21224, `processSyncQueue` at 21417) have client-side gating plus the server trigger as authoritative enforcement.

---

## 3. Attack Scenarios Tested

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| A1 | Free user self-grants premium via direct UPDATE | **Blocked** | ✅ PASS |
| A2 | User modifies `premium_purchased_at` directly | **Blocked** | ✅ PASS |
| A3 | Legitimate profile update (name only) | **Works** | ✅ PASS |
| A4 | Service role (Stripe webhook) grants premium | **Works** | ✅ PASS |
| A5 | Free user resets `ai_usage.call_count = 0` | **Blocked** | ✅ PASS |
| A6 | Server-side (RPC/service role) writes `ai_usage` | **Works** | ✅ PASS |
| A7 | Free user at 100/month cloud limit inserts more | **Blocked** | ✅ PASS |
| A8 | Free user under limit inserts | **Works** | ✅ PASS |
| A9 | Recurring regeneration & trash-restore inserts over limit | **Blocked** | ✅ PASS |
| A10 | Premium user unlimited cloud transactions | **Works** | ✅ PASS |
| A11 | Reconciliation without a paid Stripe session | **No grant** | ✅ PASS |
| A12 | Paid session for a different user | **No grant** | ✅ PASS |
| A13 | Unpaid Stripe session | **No grant** | ✅ PASS |
| A14 | Valid paid session for this user | **Grant** | ✅ PASS |
| A15 | Reconciliation when already premium | **Idempotent** | ✅ PASS |
| A16 | Subscription session (`mode=subscription`) | **No lifetime grant** | ✅ PASS |

---

## 4. What Remains

### Operational prerequisite status (updated 2026-08-09)
| # | Prerequisite | Status |
|---|--------------|--------|
| 1 | Apply base migration [`premium-subscription-migration.sql`](../premium-subscription-migration.sql) | ✅ **APPLIED** (via Supabase Management API, HTTP 201) |
| 2 | Apply security-fix migration [`premium-security-fix-migration.sql`](../premium-security-fix-migration.sql) | ✅ **APPLIED** (via Supabase Management API, HTTP 201) |
| 3 | Verify migration applied (triggers + policies) | ✅ **VERIFIED** — `ai_usage` table, `premium_active`/`premium_purchased_at` columns, both triggers, 1 SELECT-only policy on `ai_usage` |
| 4 | Configure Cloudflare Pages env bindings | ✅ **PARTIAL** — `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` set. ⏳ `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` pending (Stripe account creation) |
| 5 | Fix `functions/` mirroring to `www/` | ✅ **FIXED** in [`scripts/version-sync.js`](../scripts/version-sync.js:123) — verified `www/functions/api/*` present & ESM-valid |
| 6 | Register Stripe webhook endpoint (`/api/webhook`) with `checkout.session.completed` | ⏳ **PENDING** (needs Stripe account) |
| 7 | Test end-to-end in Stripe test mode | ⏳ **PENDING** (needs Stripe account) |

### Required before production (per release policy — do NOT skip)
1. **Create a Stripe account** and obtain test keys (`sk_test_...` for `STRIPE_SECRET_KEY`, `whsec_...` for `STRIPE_WEBHOOK_SECRET`).
2. **Set the two remaining Cloudflare secrets**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (via `wrangler pages secret put`).
3. **Register the Stripe webhook endpoint** (`https://budget-assistant-pwa.pages.dev/api/webhook`) with the `checkout.session.completed` event and the correct signing secret.
4. **Test end-to-end in Stripe test mode** (a real checkout → webhook → entitlement grant, plus the reconciliation path).

### Not yet implemented (out of scope for this security fix)
- **Android / Google Play Billing** — `restorePremiumPurchase()` on native returns "not available yet" (Phase 3 of the original plan). The web/PWA path is complete.
- **Play Billing / OTA release** — explicitly deferred per release policy.

---

## 5. Is the Premium Payment System Production-Ready?

**The security fixes are complete and tested, and the code is ready to deploy — but the system is NOT yet live in production.**

The security architecture is now sound:
- **Entitlement can only be granted by a trusted server-side mechanism** after a confirmed payment (Stripe webhook with signature verification, or the authenticated reconciliation endpoint that queries Stripe for a real paid session). There is **no client-side path** to self-grant Premium.
- **AI usage** is server-controlled (SECURITY DEFINER RPCs); users cannot reset their counter.
- **Cloud transaction limit** is enforced authoritatively at the database level.
- **No secrets** are exposed in the client.

**However**, production readiness requires the operational steps in Section 4 (apply migration, configure env vars, register webhook, test in Stripe test mode). Per the release policy, **no production deploy, no Stripe live launch, no Play Billing launch, no version bump, and no OTA release** should happen until the user reviews this report and approves.
