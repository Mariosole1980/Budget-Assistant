-- ============================================================
-- SQL Migration: Canonical `profiles` table definition
-- ============================================================
--
-- PURPOSE
--   The `profiles` table is the only core table that was never versioned in a
--   canonical CREATE TABLE statement. It was created ad-hoc in the Supabase
--   dashboard and only modified incrementally via ALTER TABLE statements in:
--     * family-budget-migration.sql        (family_id, role)
--     * multi-currency-migration.sql       (base_currency, display_currency)
--     * premium-subscription-migration.sql (premium_active, premium_purchased_at)
--
--   This migration provides a single, authoritative, idempotent definition so
--   the schema can be reproduced from source (fresh environments, disaster
--   recovery, code review). It is SAFE to run on an existing database:
--     * CREATE TABLE IF NOT EXISTS is a no-op if the table already exists.
--     * ALTER TABLE ... ADD COLUMN IF NOT EXISTS fills any missing columns.
--     * RLS policies are CREATE OR REPLACE / DROP-then-CREATE, matching the
--       existing policy names so there are no duplicates.
--
--   This migration is ADDITIVE. It does NOT drop columns, does NOT disable RLS,
--   and does NOT remove any existing policy.
-- ============================================================

-- 1. Canonical table definition (no-op if already present)
CREATE TABLE IF NOT EXISTS public.profiles (
    id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email                TEXT,
    display_name         TEXT,
    family_id            UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    role                 TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    partner_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    premium_active       BOOLEAN DEFAULT false,
    premium_purchased_at TIMESTAMPTZ,
    base_currency        TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    display_currency     TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- 2. Backfill any columns that may be missing on pre-existing tables
--    (kept in sync with the canonical definition above).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_active BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_purchased_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 3. Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies (names match the existing ones in family-budget-migration.sql,
--    so re-running this migration is safe and does not create duplicates).

-- 4a. Read: any authenticated user may read profiles by email or id.
DROP POLICY IF EXISTS "Allow read-only profile access by email or id" ON public.profiles;
CREATE POLICY "Allow read-only profile access by email or id" ON public.profiles
    FOR SELECT TO authenticated USING (true);

-- 4b. Update: a user may update their own profile, or a family admin may update
--     members of the same family.
DROP POLICY IF EXISTS "Allow user or family admin update" ON public.profiles;
CREATE POLICY "Allow user or family admin update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.family_id = profiles.family_id
              AND p.role = 'admin'
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.family_id = profiles.family_id
              AND p.role = 'admin'
        )
    );

-- 4c. Insert: a user may create their own profile row on first login.
DROP POLICY IF EXISTS "Allow users to insert own profile" ON public.profiles;
CREATE POLICY "Allow users to insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- 5. Helpful index for family-scoped lookups (idempotent).
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles (family_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
