# Pre-Release Security Audit — Stripe Premium Payment Flow

**Date:** 2026-08-09
**Scope:** Stripe Premium Lifetime payment flow (web/PWA) — read-only audit, no code changed.
**Files reviewed:**
- `functions/api/purchase.js`
- `functions/api/webhook.js`
- `functions/api/_security.js`
- `functions/api/ai.js`
- `functions/api/delete-account.js`
- `app.js` (premium gating, purchase flow, sync paths)
- `premium-subscription-migration.sql`
- `family-budget-migration.sql` (profiles RLS + `join_family_group` RPC)
- `plans/rls-policy-inventory.md`
- `.gitignore`, `.pagesignore`, `index.html`

---

## Executive Summary

| Severity | Count |
|---|---|
| 🔴 BLOCKER | **1** |
| 🟠 WARNING | **5** |
| 🟢 PASS | **12** |

**There is 1 BLOCKER that MUST be fixed before any production deploy:** the `profiles` table RLS policy allows any authenticated user to update their own row, which lets a user set `premium_active = true` directly via the Supabase client — bypassing payment entirely. This invalidates the entire entitlement model.

---

## BLOCKER

### B1 — Users can self-grant Premium by directly updating their own `profiles` row

**Files:** [`family-budget-migration.sql`](family-budget-migration.sql:58), [`premium-subscription-migration.sql`](premium-subscription-migration.sql:15)

The `profiles` table has this UPDATE policy (from `family-budget-migration.sql`):

```sql
CREATE POLICY "Allow user or family admin update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR <family admin>)
    WITH CHECK (id = auth.uid() OR <family admin>);
```

Because `id = auth.uid()` is allowed, **any authenticated user can PATCH their own `profiles` row** and set `premium_active = true` (and `premium_purchased_at`) directly through the Supabase client (e.g. `supabase.from('profiles').update({ premium_active: true }).eq('id', user.id)`). This is a **complete bypass of payment**.

**Impact:** The `premium_active` column is NOT server-controlled. Every gated feature (family, cloud, multi-currency, budgets, AI) becomes unlockable for free. This is the single most critical finding.

**Proposed fix (choose one):**
1. **Recommended — column-level protection via trigger (server-controlled):** Add a `BEFORE UPDATE` trigger on `profiles` that raises an exception if `premium_active` or `premium_purchased_at` is being changed by a non-service-role session. Since the webhook uses the service role key (which bypasses RLS and triggers can check `auth.role()`), this cleanly separates "user can edit their profile" from "only the server can grant premium."
   ```sql
   CREATE OR REPLACE FUNCTION public.protect_premium_columns()
   RETURNS TRIGGER AS $$
   BEGIN
     IF (NEW.premium_active IS DISTINCT FROM OLD.premium_active
         OR NEW.premium_purchased_at IS DISTINCT FROM OLD.premium_purchased_at)
        AND auth.role() <> 'service_role' THEN
       RAISE EXCEPTION 'premium_active is server-controlled and cannot be modified directly.';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   DROP TRIGGER IF EXISTS trg_protect_premium ON public.profiles;
   CREATE TRIGGER trg_protect_premium
     BEFORE UPDATE ON public.profiles
     FOR EACH ROW EXECUTE FUNCTION public.protect_premium_columns();
   ```
2. **Alternative — narrow the RLS policy:** Change the `profiles` UPDATE policy so it cannot touch `premium_*` columns. RLS cannot restrict columns directly, so this requires either the trigger above or moving the entitlement to a separate table (e.g. `premium_entitlements`) that has **no** user UPDATE policy and is written only by the service role.

> Note: The `join_family_group` RPC reads `premium_active` server-side, and `ai.js` reads it server-side — both are correct. The problem is purely the client-writable RLS policy.

---

## WARNINGS

### W1 — Cloud transaction limit is client-side only (bypassable)

**Files:** [`app.js`](app.js:21273), [`app.js`](app.js:21453)

The 100-transactions/month cloud limit is enforced only in the client sync logic (`syncLocalTransactionsToCloud` and `processSyncQueue`). There is **no server-side enforcement** — the `transactions` RLS policy allows any authenticated user to insert their own rows. A user can bypass the limit by:
- Directly calling `supabase.from('transactions').insert(...)` from the console, or
- Using the ungated sync paths (see W2/W3).

**Impact:** Business-rule bypass (free users can sync >100/month). Not a security boundary, but it defeats the monetization of the cloud feature.

**Proposed fix:** Add a server-side guard — either a `BEFORE INSERT` trigger on `transactions` that counts the user's rows this month and blocks non-premium users over the limit, or an RPC (`insert_transaction`) that enforces the limit. The trigger approach is consistent with the existing RPC pattern.

### W2 — Recurring transaction regeneration bypasses the cloud limit

**File:** [`app.js`](app.js:27426)

`regenerateRecurringTemplateTransactions` upserts regenerated recurring transactions directly to the cloud **without** the premium gate. A free user with many recurring templates could regenerate a large batch, bypassing the 100/month limit.

**Proposed fix:** Route these through the same gated sync path (`enqueueSyncMutation` / `processSyncQueue`) or apply the same limit check before the direct upsert.

### W3 — Trash restore bypasses the cloud limit

**File:** [`app.js`](app.js:29866)

`restoreTrashGroup` re-inserts restored transactions directly to the cloud without the gate. Lower impact (these are previously-existing rows being restored, not brand-new activity), but still an ungated write path.

**Proposed fix:** Apply the same limit check, or route through the gated sync path.

### W4 — AI usage counter can be reset by the user (fair-use bypass)

**File:** [`premium-subscription-migration.sql`](premium-subscription-migration.sql:43)

The `ai_usage` table has INSERT/UPDATE RLS policies allowing users to modify their own rows. A user can directly `UPDATE ai_usage SET call_count = 0` to reset their monthly counter, bypassing the 10/50 fair-use limit. The server-side `increment_ai_usage`/`get_ai_usage` RPCs are `SECURITY DEFINER` and read the real count, but the user can zero it out first.

**Impact:** Fair-use limit bypass → unbounded Gemini API spend (costs the app money). Not a data-integrity issue.

**Proposed fix:** Remove the user UPDATE/INSERT policies on `ai_usage` (keep only SELECT for the client's `getAiUsageCount`). The `increment_ai_usage` RPC (SECURITY DEFINER) already handles insert/update server-side, so the client doesn't need direct write access.

### W5 — No reconciliation if the webhook is permanently lost

**Files:** [`functions/api/webhook.js`](functions/api/webhook.js:16), [`app.js`](app.js:11891)

Stripe retries failed webhooks for ~3 days, and the webhook is idempotent (see P4), so the common "delayed webhook" case self-heals. **However**, if the webhook is misconfigured or down for >3 days, the user pays but never receives the entitlement, and there is **no reconciliation path**:
- `restorePremiumPurchase()` on web only re-fetches the profile — it does **not** query Stripe for the user's successful payments.
- The `?premium=success` handler refreshes the profile once, but if the webhook hasn't processed yet, the user sees `premium_active=false` with no retry/polling.

**Proposed fix (defense-in-depth):**
1. Add a server-side "verify purchase" endpoint (`/api/premium-status`) that queries Stripe for the user's successful Checkout Sessions (by `client_reference_id` = user id) and grants the entitlement if a paid session exists but the profile isn't marked premium. Call this from `restorePremiumPurchase()` and from the `?premium=success` handler (with a short retry loop).
2. This also gives the Android/Google Play restore flow a server-side counterpart.

---

## PASS

### P1 — Cannot activate Premium without a real payment (assuming B1 is fixed)
The only server-side writer of `premium_active` is the webhook (service role). With B1 fixed, there is no client path to set it. The webhook only acts on `checkout.session.completed` events with a valid Stripe signature.

### P2 — Cannot change `user_id` / entitlement via client-side code
`purchase.js` sets `client_reference_id`/`metadata.user_id` from the **authenticated JWT** (`/auth/v1/user`), so a user can only create a session for their own account. The webhook grants to that same ID. No client input can alter the target account.

### P3 — `premium_active` is (intended to be) server-controlled
The design intent is correct (server = source of truth, localStorage = cache only, `isPremium()` reads `state.userProfile`). This is only defeated by the RLS policy in B1.

### P4 — Webhook is idempotent
On `checkout.session.completed`, the webhook PATCHes `premium_active=true` + `premium_purchased_at`. Re-processing the same event (Stripe retry) sets the same values again — no adverse effect. ✅

### P5 — Stripe signature verification is correct
[`webhook.js`](functions/api/webhook.js:105) implements Stripe's `t` + `v1` HMAC-SHA256 scheme using the Web Crypto API, with a constant-time comparison (`safeEqual`). ✅

### P6 — Replay protection present
[`webhook.js`](functions/api/webhook.js:126) rejects events whose `t` timestamp is older than 300 seconds, preventing replay of captured webhook bodies. ✅

### P7 — `purchase.js` requires a valid authenticated user
[`purchase.js`](functions/api/purchase.js:48) rejects requests without a `Bearer` token and verifies the token against Supabase `/auth/v1/user` before creating a session. Unauthenticated callers get 401. ✅

### P8 — Cannot buy and grant Premium to a different account
As in P2, the entitlement target is bound to the authenticated user's ID at session creation. ✅

### P9 — Stripe amount/currency/product config is correct
[`purchase.js`](functions/api/purchase.js:102) hardcodes `currency=eur`, `unit_amount=999` (€9.99), product "Premium Lifetime", `mode=payment` (one-time). The amount is server-side and cannot be manipulated by the client. ✅

### P10 — Delayed webhook self-heals via Stripe retries
Stripe retries failed deliveries with exponential backoff (~3 days). The webhook returns 500 on failure (triggering retry) and 200 on success. Combined with idempotency (P4), the "payment succeeds → webhook delayed → retried → granted" scenario works. (Permanent loss is covered by W5.)

### P11 — User closing the page before returning is handled
The entitlement is granted by the webhook independent of the browser session. When the user next opens the app, `loadUserProfiles()` fetches the server profile and reflects `premium_active`. The `?premium=success` handler also refreshes on return. ✅

### P12 — App refreshes entitlement from server, not localStorage
`isPremium()` reads `state.userProfile.premium_active`, which is populated by `loadUserProfiles()` from the server. localStorage (`cached_user_profile`) is only a cache for offline/first paint. ✅

### P13 — Client-side `premium_active` cannot unlock features (once B1 is fixed)
Gating reads `isPremium()` from the server-fetched profile. Editing localStorage does not change `state.userProfile` on a fresh load. (Currently moot because of B1 — the user can change the server value directly.)

### P14 — RLS on `ai_usage` is tenant-isolated
All `ai_usage` policies restrict to `user_id = auth.uid()`. ✅ (Write-access concern is W4.)

### P15 — No secrets in client code or repository
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` are only referenced via `env.X` (Cloudflare bindings). No `sk_live`/`sk_test`/`whsec_`/`service_role` values appear in any `.js`/`.html` file. The only hardcoded key is the Supabase **anon/publishable** key (public by design). `.gitignore`/`.pagesignore` exclude build artifacts and local secret files. ✅

### P16 — Webhook cannot be used as a privilege-escalation endpoint
The webhook verifies the Stripe signature before acting, and only sets `premium_active` for the `client_reference_id`/`metadata.user_id` inside a **verified** Stripe event. An attacker cannot forge a webhook body (no secret key) and cannot cause the webhook to grant premium to an arbitrary account (the session's target is bound to the authenticated buyer). ✅

### P17 — Family limit is enforced server-side
[`join_family_group`](family-budget-migration.sql:300) RPC checks `member_count >= 2 AND NOT premium_active` and raises an exception — this cannot be bypassed from the client. ✅ (The invite step is client-gated only, but the actual join is server-enforced.)

### P18 — AI Coach limit is enforced server-side
[`ai.js`](functions/api/ai.js:116) enforces the 10/50 fair-use limit via `get_ai_usage`/`increment_ai_usage` RPCs (SECURITY DEFINER) and returns 429 `AI_LIMIT_REACHED`. This is authoritative and cannot be bypassed by the client UI. (The counter-reset gap is W4.)

---

## Critical Business Scenario: Payment → Webhook Delayed/Failed → Retried → Granted

**Verdict: PASS (with W5 caveat for permanent failure)**

1. User pays on Stripe → `checkout.session.completed` event created.
2. Stripe delivers to `/api/webhook`; if it fails (500) or times out, Stripe retries with exponential backoff for ~3 days.
3. On each retry, the webhook re-verifies the signature, re-processes the event, and PATCHes `premium_active=true`. Idempotent (P4) → no double-grant issue.
4. Entitlement is eventually granted. The user's next profile fetch (or the `?premium=success` refresh) reflects it.

**Gap:** If the webhook is permanently broken (misconfigured secret, endpoint down >3 days), the user is never granted entitlement and there is no reconciliation. Fix in W5.

---

## Recommended Fix Priority

| Priority | Item | Effort |
|---|---|---|
| 🔴 CRITICAL | B1: Protect `premium_active`/`premium_purchased_at` from client writes (trigger or separate table) | Low |
| 🟠 HIGH | W4: Remove user write policies on `ai_usage` (prevent counter reset) | Low |
| 🟠 MEDIUM | W1/W2/W3: Server-side cloud transaction limit (trigger or RPC) + gate remaining sync paths | Medium |
| 🟠 MEDIUM | W5: Add `/api/premium-status` reconciliation endpoint + client retry | Medium |

**Do not deploy to production until B1 is resolved.**
