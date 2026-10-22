-- ============================================================================
-- Open Banking Integration Migration — Budget Assistant
-- ============================================================================
-- Safe, idempotent, RLS-enabled migration for Open Banking (Enable Banking / PSD2)
--
-- Adds:
-- 1. Table `public.bank_connections`: Stores user authorizations with banks
-- 2. Table `public.bank_accounts`: Stores bank accounts discovered from authorizations
-- 3. Column `bank_transaction_id` on `public.transactions`: For deduplication
-- 4. Column `bank_account_uid` on `public.transactions`
-- 5. Row-level security (RLS) policies matching Budget Assistant's canonical schema
-- ============================================================================

-- 1. BANK CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    aspsp_name TEXT NOT NULL,
    aspsp_country TEXT NOT NULL DEFAULT 'GR',
    aspsp_logo TEXT,
    session_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    access_valid_until TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user 
    ON public.bank_connections (user_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_connections_family 
    ON public.bank_connections (family_id, status) 
    WHERE family_id IS NOT NULL;

-- 2. BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    account_uid TEXT NOT NULL,
    iban TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    account_name TEXT,
    balance NUMERIC(14,2) DEFAULT 0.0,
    linked_app_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_uid_user
    ON public.bank_accounts (user_id, account_uid);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_conn
    ON public.bank_accounts (connection_id);

-- 3. TRANSACTIONS DEDUPLICATION COLUMN
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT;

ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS bank_account_uid TEXT;

-- Prevent duplicate bank transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_bank_tx_id
    ON public.transactions (bank_transaction_id)
    WHERE bank_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_bank_acct_uid
    ON public.transactions (bank_account_uid)
    WHERE bank_account_uid IS NOT NULL;

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop and recreate policies
DO $$
BEGIN
    -- bank_connections policies
    DROP POLICY IF EXISTS bank_connections_owner_select ON public.bank_connections;
    DROP POLICY IF EXISTS bank_connections_owner_insert ON public.bank_connections;
    DROP POLICY IF EXISTS bank_connections_owner_update ON public.bank_connections;
    DROP POLICY IF EXISTS bank_connections_owner_delete ON public.bank_connections;

    -- bank_accounts policies
    DROP POLICY IF EXISTS bank_accounts_owner_select ON public.bank_accounts;
    DROP POLICY IF EXISTS bank_accounts_owner_insert ON public.bank_accounts;
    DROP POLICY IF EXISTS bank_accounts_owner_update ON public.bank_accounts;
    DROP POLICY IF EXISTS bank_accounts_owner_delete ON public.bank_accounts;
END $$;

-- Policy definitions: Owner or family member (using public.profiles canonical schema)
CREATE POLICY bank_connections_owner_select ON public.bank_connections
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY bank_connections_owner_insert ON public.bank_connections
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY bank_connections_owner_update ON public.bank_connections
    FOR UPDATE TO authenticated USING (
        auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY bank_connections_owner_delete ON public.bank_connections
    FOR DELETE TO authenticated USING (
        auth.uid() = user_id
    );

-- bank_accounts policies
CREATE POLICY bank_accounts_owner_select ON public.bank_accounts
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY bank_accounts_owner_insert ON public.bank_accounts
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY bank_accounts_owner_update ON public.bank_accounts
    FOR UPDATE TO authenticated USING (
        auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() = user_id
    );

CREATE POLICY bank_accounts_owner_delete ON public.bank_accounts
    FOR DELETE TO authenticated USING (
        auth.uid() = user_id
    );
