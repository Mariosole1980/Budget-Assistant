-- ============================================================================
-- Premium Security Fix Migration — Budget Assistant
-- ============================================================================
-- Fixes the findings from the pre-release security audit
-- (plans/premium-stripe-pre-release-audit.md):
--
--   B1 (BLOCKER): Users could self-grant Premium by directly updating their own
--                 `profiles` row (premium_active / premium_purchased_at).
--   W4 (WARNING): Users could reset their own `ai_usage` counter, bypassing the
--                 fair-use limit and causing unbounded Gemini spend.
--
-- SAFE & IDEMPOTENT: uses IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE.
-- Re-running is a no-op on an already-migrated database.
-- Does NOT drop tables and does NOT disable RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHASE 1 — B1: Protect premium entitlement columns on profiles
-- ----------------------------------------------------------------------------
-- The `profiles` UPDATE RLS policy allows `id = auth.uid()`, so an authenticated
-- user can PATCH their own row. This trigger makes `premium_active` and
-- `premium_purchased_at` server-controlled: only a `service_role` session (the
-- Stripe webhook) may change them. Any other session that tries to modify these
-- columns gets an exception, so the whole UPDATE is rolled back (including any
-- legitimate profile fields in the same statement).
--
-- NOTE: The service role key bypasses RLS, and `auth.role()` returns
-- 'service_role' for service-role sessions, so the webhook continues to work.

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

-- ----------------------------------------------------------------------------
-- PHASE 2 — W4: Remove user write access to ai_usage
-- ----------------------------------------------------------------------------
-- The client only needs to READ its own usage count (for the UI). All writes
-- (increment) are handled server-side by the SECURITY DEFINER RPC
-- `increment_ai_usage()`, which bypasses RLS. Removing the INSERT/UPDATE
-- policies prevents a user from resetting `call_count = 0` directly.
--
-- We keep the SELECT policy so the client's `getAiUsageCount()` still works.

DROP POLICY IF EXISTS "Allow insert own ai_usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Allow update own ai_usage" ON public.ai_usage;

-- (SELECT policy "Allow select own ai_usage" is intentionally kept.)

-- ----------------------------------------------------------------------------
-- PHASE 3 — W1/W2/W3: Server-side cloud transaction limit
-- ----------------------------------------------------------------------------
-- The 100-transactions/month cloud limit for Free users was previously enforced
-- only in the client (app.js). A user could bypass it by directly inserting rows
-- via the Supabase client, or via the ungated recurring-regeneration and
-- trash-restore paths. This trigger makes the limit authoritative at the
-- database level: a non-Premium user cannot INSERT more than
-- PREMIUM_CLOUD_TX_LIMIT rows (created this month) regardless of the client.
--
-- Design notes:
--   * BEFORE INSERT fires only on actual row creation, so UPDATEs (edits,
--     soft-deletes, backfillRecurringTemplateIds) are NOT counted — they are
--     not "new" cloud activity.
--   * Premium users are unlimited (checked via profiles.premium_active).
--   * The count is per-user (user_id = auth.uid()), matching the client logic.
--   * Family transactions are inserted with user_id = auth.uid() (the member
--     who created them), so each free member has their own 100/month allowance.
--   * The limit constant is kept in sync with PREMIUM_LIMITS.cloudTxPerMonth
--     in app.js (currently 100). Change both together.
--   * The exception aborts the whole INSERT statement (including multi-row
--     batches), which is the desired authoritative behavior.

CREATE OR REPLACE FUNCTION public.enforce_cloud_tx_limit()
RETURNS TRIGGER AS $$
DECLARE
    is_premium BOOLEAN;
    month_start TIMESTAMPTZ;
    used_count INT;
    limit_val INT := 100;  -- keep in sync with PREMIUM_LIMITS.cloudTxPerMonth in app.js
BEGIN
    -- Only enforce for authenticated (non-service-role) inserts. The service
    -- role (admin/backfill) is trusted and unlimited.
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Premium users are unlimited.
    SELECT COALESCE(premium_active, false) INTO is_premium
    FROM public.profiles
    WHERE id = auth.uid();

    IF is_premium THEN
        RETURN NEW;
    END IF;

    -- Count this user's rows created in the current calendar month.
    month_start := date_trunc('month', now());
    SELECT COUNT(*) INTO used_count
    FROM public.transactions
    WHERE user_id = auth.uid()
      AND created_at >= month_start;

    IF used_count >= limit_val THEN
        RAISE EXCEPTION 'Monthly cloud transaction limit reached (% per month). Upgrade to Premium for unlimited cloud sync.', limit_val;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_cloud_tx_limit ON public.transactions;
CREATE TRIGGER trg_enforce_cloud_tx_limit
    BEFORE INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_cloud_tx_limit();

-- ----------------------------------------------------------------------------
-- VERIFICATION (run in the Supabase SQL editor):
--   1. As a normal authenticated user:
--        UPDATE public.profiles SET premium_active = true WHERE id = auth.uid();
--      -> MUST raise: 'premium_active is server-controlled...'
--   2. As a normal authenticated user:
--        UPDATE public.ai_usage SET call_count = 0 WHERE user_id = auth.uid();
--      -> MUST fail with RLS violation (no policy for UPDATE).
--   3. With the service role key:
--        UPDATE public.profiles SET premium_active = true, premium_purchased_at = now()
--        WHERE id = '<user>';
--      -> MUST succeed (webhook path).
--   4. As a non-Premium user, after inserting 100 transactions this month:
--        INSERT INTO public.transactions (user_id, date, type, amount, category)
--        VALUES (auth.uid(), now(), 'expense', 1, 'Other');
--      -> MUST raise: 'Monthly cloud transaction limit reached...'
--   5. As a Premium user (premium_active = true), the same insert MUST succeed.
-- ============================================================================
