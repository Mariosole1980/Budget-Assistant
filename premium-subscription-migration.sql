-- ============================================================================
-- Premium Subscription Migration — Budget Assistant
-- ============================================================================
-- Adds Premium Lifetime entitlement to the profiles table and an AI usage
-- tracking table for fair-use limits on the online (Gemini) AI Coach.
--
-- SAFE & IDEMPOTENT: uses IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE.
-- Re-running is a no-op on an already-migrated database.
-- Does NOT drop tables and does NOT disable RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENTITLEMENT on profiles
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS premium_active BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS premium_purchased_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 2. AI USAGE tracking (fair-use limits on online AI calls)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_month TEXT NOT NULL,          -- 'YYYY-MM'
    call_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, usage_month)
);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY for ai_usage
-- ----------------------------------------------------------------------------
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage rows
DROP POLICY IF EXISTS "Allow select own ai_usage" ON public.ai_usage;
CREATE POLICY "Allow select own ai_usage" ON public.ai_usage
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can insert/update their own usage rows (used by the client to report
-- usage; the authoritative enforcement happens server-side in the functions).
DROP POLICY IF EXISTS "Allow insert own ai_usage" ON public.ai_usage;
CREATE POLICY "Allow insert own ai_usage" ON public.ai_usage
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow update own ai_usage" ON public.ai_usage;
CREATE POLICY "Allow update own ai_usage" ON public.ai_usage
    FOR UPDATE TO authenticated USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. RPC: increment AI usage (server-side, used by functions/api/coach.js)
--    Returns the new call_count for the current month.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ai_usage()
RETURNS INT AS $$
DECLARE
    month_key TEXT := to_char(now(), 'YYYY-MM');
    new_count INT;
BEGIN
    INSERT INTO public.ai_usage (user_id, usage_month, call_count)
    VALUES (auth.uid(), month_key, 1)
    ON CONFLICT (user_id, usage_month)
    DO UPDATE SET call_count = public.ai_usage.call_count + 1,
                  updated_at = now()
    RETURNING call_count INTO new_count;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. RPC: get current AI usage for the month (server-side)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_usage()
RETURNS INT AS $$
DECLARE
    month_key TEXT := to_char(now(), 'YYYY-MM');
    current_count INT;
BEGIN
    SELECT call_count INTO current_count
    FROM public.ai_usage
    WHERE user_id = auth.uid() AND usage_month = month_key;

    RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
