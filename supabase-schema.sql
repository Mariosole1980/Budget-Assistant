-- ============================================================================
-- Supabase Canonical Schema — Budget Assistant
-- ============================================================================
-- IMPORTANT: This file is the SAFE, IDEMPOTENT, RLS-ENABLED canonical schema.
--
-- It reflects the REAL production architecture (tenant isolation via RLS).
-- It is safe to run at any time:
--   * It NEVER drops tables (no DROP TABLE).
--   * It NEVER disables Row Level Security (no DISABLE ROW LEVEL SECURITY).
--   * It NEVER creates "Allow public" (USING(true)/WITH CHECK(true)) policies
--     on tenant data.
--
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE),
-- so re-running this file is a no-op on an already-migrated database.
--
-- This file is the single source of truth for the base tables and their RLS.
-- Feature migrations (family, multi-currency, notes, recurring, trash, budgets)
-- are additive and live in their own *.sql files; they are listed in
-- plans/rls-policy-inventory.md.
-- ============================================================================

-- ============================================================================
-- 1. ACCOUNTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'card', 'investment')),
    balance NUMERIC NOT NULL DEFAULT 0.0,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Uniqueness: family-scoped or user-scoped (partial unique indexes)
DROP INDEX IF EXISTS public.accounts_family_name_idx;
DROP INDEX IF EXISTS public.accounts_user_name_idx;
CREATE UNIQUE INDEX accounts_family_name_idx ON public.accounts (family_id, name) WHERE family_id IS NOT NULL;
CREATE UNIQUE INDEX accounts_user_name_idx ON public.accounts (user_id, name) WHERE family_id IS NULL;

-- ============================================================================
-- 2. CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    hidden BOOLEAN DEFAULT false,
    subcategories JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Uniqueness: family-scoped or user-scoped (partial unique indexes)
DROP INDEX IF EXISTS public.categories_family_name_type_idx;
DROP INDEX IF EXISTS public.categories_user_name_type_idx;
CREATE UNIQUE INDEX categories_family_name_type_idx ON public.categories (family_id, name, type) WHERE family_id IS NOT NULL;
CREATE UNIQUE INDEX categories_user_name_type_idx ON public.categories (user_id, name, type) WHERE family_id IS NULL;

-- ============================================================================
-- 3. TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    account_from TEXT NOT NULL,
    account_to TEXT,
    note TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    is_shared BOOLEAN DEFAULT false,
    currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1,
    amount_base NUMERIC(18,4),
    base_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    rate_source TEXT NOT NULL DEFAULT 'api' CHECK (rate_source IN ('api','cached','manual')),
    rate_to_base_actual NUMERIC(18,8),
    rate_fetched_at TIMESTAMPTZ,
    transfer_id UUID,
    transfer_rate NUMERIC(18,8),
    status TEXT NOT NULL DEFAULT 'active',
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_status
    ON public.transactions (status, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_active
    ON public.transactions (user_id, date DESC)
    WHERE status = 'active';

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) — ENABLED
-- ============================================================================
-- RLS is ENABLED on all tenant tables. Policies below enforce tenant isolation:
-- a user can access their own rows (user_id = auth.uid()) and, when part of a
-- family, the family's shared rows (family_id = their family).
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- ACCOUNTS policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select accounts" ON public.accounts;
CREATE POLICY "Allow select accounts" ON public.accounts
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert accounts" ON public.accounts;
CREATE POLICY "Allow insert accounts" ON public.accounts
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow update accounts" ON public.accounts;
CREATE POLICY "Allow update accounts" ON public.accounts
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete accounts" ON public.accounts;
CREATE POLICY "Allow delete accounts" ON public.accounts
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- CATEGORIES policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select categories" ON public.categories;
CREATE POLICY "Allow select categories" ON public.categories
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert categories" ON public.categories;
CREATE POLICY "Allow insert categories" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow update categories" ON public.categories;
CREATE POLICY "Allow update categories" ON public.categories
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete categories" ON public.categories;
CREATE POLICY "Allow delete categories" ON public.categories
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- TRANSACTIONS policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow select transactions" ON public.transactions;
CREATE POLICY "Allow select transactions" ON public.transactions
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert transactions" ON public.transactions;
CREATE POLICY "Allow insert transactions" ON public.transactions
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow update transactions" ON public.transactions;
CREATE POLICY "Allow update transactions" ON public.transactions
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete transactions" ON public.transactions;
CREATE POLICY "Allow delete transactions" ON public.transactions
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- ============================================================================
-- 5. DEFAULT SEED DATA (idempotent — ON CONFLICT DO NOTHING)
-- ============================================================================
-- NOTE: Default accounts/categories are seeded per-user at runtime by the app
-- (see app.js loadData()). The rows below are only a minimal bootstrap for a
-- brand-new database and are safe to skip on an existing database.
-- ============================================================================

-- ============================================================================
-- END OF CANONICAL SCHEMA
-- ============================================================================
-- Feature tables and their RLS are defined in their own additive migrations:
--   * profiles / family_groups / pending_invitations  -> family-budget-migration.sql
--   * recurring_templates                              -> supabase-recurring-migration.sql
--   * notes                                             -> notes-migration.sql
--   * ai_conversations                                  -> ai-conversations-migration.sql
--   * currencies / exchange_rates / budgets             -> multi-currency-migration.sql
--   * category_budgets                                  -> category-budgets-migration.sql
--   * trash (status columns on transactions)            -> trash-status-migration.sql
-- See plans/rls-policy-inventory.md for the full policy inventory.
-- ============================================================================
