-- ============================================================================
-- Exchange Rates Security Fix Migration — Budget Assistant
-- ============================================================================
-- Fixes the finding from the architecture review (plans/rls-policy-inventory.md §6.2):
--
--   exchange_rates INSERT policy was `WITH CHECK (true)`, allowing ANY
--   authenticated user to insert arbitrary rows into the shared rate catalog.
--   This is a data-integrity / abuse vector: a malicious user could pollute the
--   rate history that every other user reads, corrupting multi-currency
--   conversions app-wide.
--
-- SAFE & IDEMPOTENT: uses IF EXISTS / CREATE OR REPLACE / ADD CONSTRAINT IF NOT
-- EXISTS. Re-running is a no-op on an already-migrated database. Does NOT drop
-- tables and does NOT disable RLS.
--
-- DESIGN NOTE:
--   The client persists today's rates directly via
--   `supabaseClient.from('exchange_rates').upsert(...)` (www/app.js:12504), so
--   we CANNOT simply drop the INSERT policy (that would break rate persistence).
--   Instead we constrain the WITH CHECK to reject abusive rows while still
--   allowing legitimate rate writes:
--     * source must be one of the known enum values
--     * rate must be a positive, sane number (0 < rate < 1,000,000)
--     * rate_date must be within a plausible window (2000-01-01 .. today+1 day)
--     * base_currency must differ from quote_currency
--   A table-level CHECK constraint is added as defense-in-depth so the same
--   rules hold even if a future policy is misconfigured.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHASE 1 — Table-level CHECK constraint (defense-in-depth)
-- ----------------------------------------------------------------------------
ALTER TABLE public.exchange_rates
    DROP CONSTRAINT IF EXISTS exchange_rates_sane_rate;
ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_sane_rate CHECK (
        rate > 0
        AND rate < 1000000
        AND base_currency <> quote_currency
        AND rate_date >= DATE '2000-01-01'
        AND rate_date <= (CURRENT_DATE + 1)
        AND source IN ('api', 'cached', 'manual')
    );

-- ----------------------------------------------------------------------------
-- PHASE 2 — Restrict the INSERT policy (replace WITH CHECK (true))
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow insert exchange rates" ON public.exchange_rates;
CREATE POLICY "Allow insert exchange rates" ON public.exchange_rates
    FOR INSERT TO authenticated
    WITH CHECK (
        rate > 0
        AND rate < 1000000
        AND base_currency <> quote_currency
        AND rate_date >= DATE '2000-01-01'
        AND rate_date <= (CURRENT_DATE + 1)
        AND source IN ('api', 'cached', 'manual')
    );

-- ----------------------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------------------
-- Expected result after running:
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'exchange_rates';
--   -> "Allow insert exchange rates" should show the constrained with_check,
--      NOT "(true)".
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.exchange_rates'::regclass
--     AND conname = 'exchange_rates_sane_rate';
--   -> should return one row.
-- ============================================================================
