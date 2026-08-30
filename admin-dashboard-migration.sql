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
    v_users_count BIGINT := 0;
    v_profiles_count BIGINT := 0;
    v_premium_count BIGINT := 0;
    v_tx_count BIGINT := 0;
    v_ai_chat_calls BIGINT := 0;
    v_ai_scan_calls BIGINT := 0;
    v_db_size BIGINT := 0;
    v_users_list JSONB := '[]'::jsonb;
    v_month_key TEXT := to_char(now(), 'YYYY-MM');
BEGIN
    -- ---------------------------------------------------------------------
    -- 1. ADMIN GATE — only the owner may read this data.
    -- ---------------------------------------------------------------------
    SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();
    IF current_email IS DISTINCT FROM 'marios.ko@hotmail.com' THEN
        RETURN jsonb_build_object('error', 'forbidden');
    END IF;

    -- ---------------------------------------------------------------------
    -- 2. SAFE METRICS EXTRACTION (fail-safe blocks)
    -- ---------------------------------------------------------------------
    BEGIN
        SELECT pg_database_size(current_database()) INTO v_db_size;
    EXCEPTION WHEN OTHERS THEN
        v_db_size := 0;
    END;

    BEGIN
        SELECT count(*) INTO v_users_count FROM auth.users;
    EXCEPTION WHEN OTHERS THEN
        v_users_count := 0;
    END;

    BEGIN
        IF to_regclass('public.profiles') IS NOT NULL THEN
            SELECT count(*) INTO v_profiles_count FROM public.profiles;
            SELECT count(*) INTO v_premium_count FROM public.profiles WHERE premium_active = true;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_profiles_count := 0;
        v_premium_count := 0;
    END;

    BEGIN
        IF to_regclass('public.transactions') IS NOT NULL THEN
            SELECT count(*) INTO v_tx_count FROM public.transactions;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_tx_count := 0;
    END;

    BEGIN
        IF to_regclass('public.ai_usage') IS NOT NULL THEN
            SELECT COALESCE(sum(call_count), 0) INTO v_ai_chat_calls
            FROM public.ai_usage WHERE usage_month = v_month_key;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ai_chat_calls := 0;
    END;

    BEGIN
        IF to_regclass('public.scan_usage') IS NOT NULL THEN
            SELECT COALESCE(sum(scan_count), 0) INTO v_ai_scan_calls
            FROM public.scan_usage WHERE usage_month = v_month_key;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ai_scan_calls := 0;
    END;

    BEGIN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'email', u.email,
                'display_name', COALESCE(p.full_name, ''),
                'premium_active', COALESCE(p.premium_active, false),
                'created_at', u.created_at
            ) ORDER BY u.created_at DESC
        ), '[]'::jsonb)
        INTO v_users_list
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id;
    EXCEPTION WHEN OTHERS THEN
        v_users_list := '[]'::jsonb;
    END;

    result := jsonb_build_object(
        'db_size_bytes', v_db_size,
        'db_limit_bytes', 500 * 1024 * 1024,
        'mau_limit', 50000,
        'users_count', v_users_count,
        'profiles_count', v_profiles_count,
        'premium_count', v_premium_count,
        'transactions_count', v_tx_count,
        'ai_chat_calls_month', v_ai_chat_calls,
        'ai_chat_platform_limit', 10000,
        'ai_scan_calls_month', v_ai_scan_calls,
        'ai_scan_platform_limit', 10000,
        'ai_chat_user_limit', 50,
        'ai_scan_user_limit', 100,
        'users', v_users_list
    );

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Allow authenticated users to invoke the RPC (the admin gate runs inside).
GRANT EXECUTE ON FUNCTION public.admin_get_usage() TO authenticated;
