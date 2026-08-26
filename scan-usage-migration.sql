-- ============================================================================
-- Scan Usage Migration — Budget Assistant
-- ============================================================================
-- Adds SERVER-SIDE AI receipt scan usage tracking so the monthly scan limits
-- (Free: 5, Premium Lifetime: 100) are enforced authoritatively.
--
-- Previously the scan quota lived only in client-side localStorage, which is
-- trivially bypassed (clear localStorage or call /api/scan-receipt directly).
-- With this migration, functions/api/scan-receipt.js meters every scan through
-- the increment_scan_usage RPC and rejects over-limit requests with HTTP 429.
--
-- SAFE & IDEMPOTENT: uses IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE.
-- Re-running is a no-op on an already-migrated database.
-- Does NOT drop tables and does NOT disable RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCAN USAGE tracking (mirror of public.ai_usage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_month TEXT NOT NULL,          -- 'YYYY-MM'
    scan_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, usage_month)
);

-- ----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY for scan_usage
-- ----------------------------------------------------------------------------
ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage rows
DROP POLICY IF EXISTS "Allow select own scan_usage" ON public.scan_usage;
CREATE POLICY "Allow select own scan_usage" ON public.scan_usage
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can insert/update their own usage rows (used by the client to report
-- usage; the authoritative enforcement happens server-side in the functions).
DROP POLICY IF EXISTS "Allow insert own scan_usage" ON public.scan_usage;
CREATE POLICY "Allow insert own scan_usage" ON public.scan_usage
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow update own scan_usage" ON public.scan_usage;
CREATE POLICY "Allow update own scan_usage" ON public.scan_usage
    FOR UPDATE TO authenticated USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. RPC: increment scan usage (server-side, used by functions/api/scan-receipt.js)
--    Returns the new scan_count for the current month.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_scan_usage()
RETURNS INT AS $$
DECLARE
    month_key TEXT := to_char(now(), 'YYYY-MM');
    new_count INT;
BEGIN
    INSERT INTO public.scan_usage (user_id, usage_month, scan_count)
    VALUES (auth.uid(), month_key, 1)
    ON CONFLICT (user_id, usage_month)
    DO UPDATE SET scan_count = public.scan_usage.scan_count + 1,
                  updated_at = now()
    RETURNING scan_count INTO new_count;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. RPC: get current scan usage for the month (server-side)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_scan_usage()
RETURNS INT AS $$
DECLARE
    month_key TEXT := to_char(now(), 'YYYY-MM');
    current_count INT;
BEGIN
    SELECT scan_count INTO current_count
    FROM public.scan_usage
    WHERE user_id = auth.uid() AND usage_month = month_key;

    RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
