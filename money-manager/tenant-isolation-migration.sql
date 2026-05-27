-- SQL Migration: Enable Tenant Isolation & Row Level Security (RLS)

-- ==========================================
-- 1. MODIFY CATEGORIES TABLE
-- ==========================================
-- Add user_id column if not exists
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old unique constraint (which prevented different users from having categories with the same name)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_type_key;

-- Add new unique constraint including user_id
ALTER TABLE public.categories ADD CONSTRAINT categories_user_id_name_type_key UNIQUE (user_id, name, type);


-- ==========================================
-- 2. MODIFY ACCOUNTS TABLE
-- ==========================================
-- Add user_id column if not exists
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old unique constraint (which prevented duplicate account names globally)
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_name_key;

-- Add new unique constraint including user_id
ALTER TABLE public.accounts ADD CONSTRAINT accounts_user_id_name_key UNIQUE (user_id, name);


-- ==========================================
-- 3. MODIFY TRANSACTIONS TABLE
-- ==========================================
-- Ensure user_id column exists
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==========================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 5. DEFINE RLS POLICIES FOR TRANSACTIONS
-- ==========================================
DROP POLICY IF EXISTS "Allow public select" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert" ON public.transactions;
DROP POLICY IF EXISTS "Allow public update" ON public.transactions;
DROP POLICY IF EXISTS "Allow public delete" ON public.transactions;
DROP POLICY IF EXISTS "Allow user and partner access to transactions" ON public.transactions;

CREATE POLICY "Allow user and partner access to transactions" ON public.transactions
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    );


-- ==========================================
-- 6. DEFINE RLS POLICIES FOR ACCOUNTS
-- ==========================================
DROP POLICY IF EXISTS "Allow public select" ON public.accounts;
DROP POLICY IF EXISTS "Allow public insert" ON public.accounts;
DROP POLICY IF EXISTS "Allow public update" ON public.accounts;
DROP POLICY IF EXISTS "Allow public delete" ON public.accounts;
DROP POLICY IF EXISTS "Allow user and partner access to accounts" ON public.accounts;

CREATE POLICY "Allow user and partner access to accounts" ON public.accounts
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    );


-- ==========================================
-- 7. DEFINE RLS POLICIES FOR CATEGORIES
-- ==========================================
DROP POLICY IF EXISTS "Allow public select" ON public.categories;
DROP POLICY IF EXISTS "Allow public insert" ON public.categories;
DROP POLICY IF EXISTS "Allow public update" ON public.categories;
DROP POLICY IF EXISTS "Allow public delete" ON public.categories;
DROP POLICY IF EXISTS "Allow user and partner access to categories" ON public.categories;

CREATE POLICY "Allow user and partner access to categories" ON public.categories
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    );


-- ==========================================
-- 8. DEFINE RLS POLICIES FOR PROFILES
-- ==========================================
DROP POLICY IF EXISTS "Allow read-only profile access by email or id" ON public.profiles;
CREATE POLICY "Allow read-only profile access by email or id" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
