-- ============================================================================
-- Admin Dashboard Migration — Budget Assistant
-- ============================================================================
-- Adds a server-side RPC that returns platform usage + user list for the app
-- owner's private "Admin Dashboard" (visible only to marios.ko@hotmail.com).
--
-- SECURITY: the function is SECURITY DEFINER and enforces the admin check
-- INSIDE the database (auth.uid() -> email). Non-admins get {"error":"forbidden"}.
-- It is safe to expose through /api/admin-usage.
--
-- SAFE & IDEMPOTENT: uses CREATE OR REPLACE / GRANT. Re-running is a no-op.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_email TEXT;
    result JSONB;
BEGIN
    -- ---------------------------------------------------------------------
    -- 1. ADMIN GATE — only the owner may read this data.
    -- ---------------------------------------------------------------------
    SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
    IF current_email IS DISTINCT FROM 'marios.ko@hotmail.com' THEN
        RETURN jsonb_build_object('error', 'forbidden');
    END IF;

    -- ---------------------------------------------------------------------
    -- 2. USAGE SNAPSHOT
    -- ---------------------------------------------------------------------
    SELECT jsonb_build_object(
        -- Supabase storage limits (Free plan)
        'db_size_bytes', pg_database_size(current_database()),
        'db_limit_bytes', 500 * 1024 * 1024,      -- 500 MB free plan
        'mau_limit', 50000,                        -- 50K monthly active users

        -- Counters
        'users_count',      (SELECT count(*) FROM auth.users),
        'profiles_count',   (SELECT count(*) FROM public.profiles),
        'premium_count',    (SELECT count(*) FROM public.profiles WHERE premium_active = true),
        'transactions_count', (SELECT count(*) FROM public.transactions),

        -- AI usage this calendar month (all users)
        'ai_chat_calls_month', COALESCE(
            (SELECT sum(call_count) FROM public.ai_usage WHERE usage_month = to_char(now(), 'YYYY-MM')), 0),
        'ai_scan_calls_month', COALESCE(
            (SELECT sum(scan_count) FROM public.scan_usage WHERE usage_month = to_char(now(), 'YYYY-MM')), 0),

        -- Per-user fair-use limits (premium tier)
        'ai_chat_limit', 50,
        'ai_scan_limit', 100,

        -- Full user list (email + premium status)
        'users', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'email', u.email,
                    'display_name', COALESCE(p.full_name, p.display_name, ''),
                    'premium_active', COALESCE(p.premium_active, false),
                    'premium_purchased_at', p.premium_purchased_at,
                    'created_at', u.created_at
                ) ORDER BY u.created_at DESC
            ), '[]'::jsonb)
            FROM auth.users u
            LEFT JOIN public.profiles p ON p.id = u.id
        )
    ) INTO result;

    RETURN result;
END;
$$;

-- Allow authenticated users to invoke the RPC (the admin gate runs inside).
GRANT EXECUTE ON FUNCTION public.admin_get_usage() TO authenticated;
