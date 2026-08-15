-- ============================================================
-- SQL Migration: Multi-Currency Support (Phases 0, 1, 2)
-- ============================================================
-- Rollback-safe, additive migration. Does NOT touch existing data.
-- All new fields have defaults that preserve existing behavior (EUR, 1:1).
--
-- Phase 0: Create tables (currencies, exchange_rates, budgets) + seed
-- Phase 1: Add fields with defaults to transactions/accounts/profiles/recurring
-- Phase 2: Backfill amount_base (EUR, 1:1) — idempotent
--
-- Execute this script in your Supabase SQL Editor (Dashboard -> SQL Editor).
-- ============================================================

-- ============================================================
-- PHASE 0 — New tables
-- ============================================================

-- 1. CURRENCIES (catalog of currencies)
CREATE TABLE IF NOT EXISTS public.currencies (
    code        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    decimals    SMALLINT NOT NULL DEFAULT 2,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed common currencies (extended catalog with flag + countries for UX)
INSERT INTO public.currencies (code, name, symbol, decimals) VALUES
    ('EUR', 'Euro', '€', 2),
    ('USD', 'US Dollar', '$', 2),
    ('GBP', 'British Pound', '£', 2),
    ('JPY', 'Japanese Yen', '¥', 0),
    ('CHF', 'Swiss Franc', 'CHF', 2),
    ('CAD', 'Canadian Dollar', 'C$', 2),
    ('AUD', 'Australian Dollar', 'A$', 2),
    ('SEK', 'Swedish Krona', 'kr', 2),
    ('NOK', 'Norwegian Krone', 'kr', 2),
    ('DKK', 'Danish Krone', 'kr', 2),
    ('PLN', 'Polish Zloty', 'zł', 2),
    ('CZK', 'Czech Koruna', 'Kč', 2),
    ('HUF', 'Hungarian Forint', 'Ft', 0),
    ('RON', 'Romanian Leu', 'lei', 2),
    ('BGN', 'Bulgarian Lev', 'лв', 2),
    ('TRY', 'Turkish Lira', '₺', 2),
    ('RUB', 'Russian Ruble', '₽', 2),
    ('CNY', 'Chinese Yuan', '¥', 2),
    ('INR', 'Indian Rupee', '₹', 2),
    ('BRL', 'Brazilian Real', 'R$', 2),
    ('MXN', 'Mexican Peso', 'Mex$', 2),
    ('ZAR', 'South African Rand', 'R', 2),
    ('ILS', 'Israeli New Shekel', '₪', 2),
    ('AED', 'UAE Dirham', 'د.إ', 2),
    ('SGD', 'Singapore Dollar', 'S$', 2),
    ('HKD', 'Hong Kong Dollar', 'HK$', 2),
    ('KRW', 'South Korean Won', '₩', 0),
    ('THB', 'Thai Baht', '฿', 2),
    ('MYR', 'Malaysian Ringgit', 'RM', 2),
    ('NZD', 'New Zealand Dollar', 'NZ$', 2)
ON CONFLICT (code) DO NOTHING;

-- 2. EXCHANGE_RATES (historical rates, append-only)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id             BIGSERIAL PRIMARY KEY,
    base_currency  TEXT NOT NULL REFERENCES public.currencies(code),
    quote_currency TEXT NOT NULL REFERENCES public.currencies(code),
    rate           NUMERIC(18,8) NOT NULL,   -- 1 base = rate quote
    rate_date      DATE NOT NULL,            -- date of validity (used in calculation)
    source         TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api','cached','manual')),
    fetched_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (base_currency, quote_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
    ON public.exchange_rates (base_currency, quote_currency, rate_date DESC);

-- 3. BUDGETS (new table, with scope for personal vs family)
CREATE TABLE IF NOT EXISTS public.budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id    UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    scope        TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'family')),
    category     TEXT NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    limit_amount NUMERIC(12,2) NOT NULL,
    period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','yearly')),
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Personal budgets: unique per user
CREATE UNIQUE INDEX IF NOT EXISTS budgets_personal_uniq
    ON public.budgets (user_id, category, period, currency)
    WHERE scope = 'personal';

-- Family budgets: unique per family
CREATE UNIQUE INDEX IF NOT EXISTS budgets_family_uniq
    ON public.budgets (family_id, category, period, currency)
    WHERE scope = 'family';

-- ============================================================
-- PHASE 1 — Add fields with defaults (rollback-safe)
-- ============================================================

-- TRANSACTIONS
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS amount_base NUMERIC(18,4),
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS rate_source TEXT NOT NULL DEFAULT 'api' CHECK (rate_source IN ('api','cached','manual')),
    ADD COLUMN IF NOT EXISTS rate_to_base_actual NUMERIC(18,8),
    ADD COLUMN IF NOT EXISTS rate_fetched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS transfer_id UUID,
    ADD COLUMN IF NOT EXISTS transfer_rate NUMERIC(18,8);

-- ACCOUNTS
ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- PROFILES
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code);

-- RECURRING_TEMPLATES
ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code);

-- FAMILY_GROUPS (reporting currency for shared reports)
ALTER TABLE public.family_groups
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code);

-- ============================================================
-- PHASE 2 — Backfill amount_base (idempotent)
-- ============================================================
-- All existing transactions are EUR with 1:1 rate, so amount_base = amount.
UPDATE public.transactions
SET amount_base = amount,
    rate_to_base = 1,
    base_currency = 'EUR',
    currency = 'EUR'
WHERE amount_base IS NULL;

-- ============================================================
-- RLS for new tables (mirror existing tenant-isolation approach)
-- ============================================================

-- CURRENCIES: read-only catalog for all authenticated users
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select currencies" ON public.currencies;
CREATE POLICY "Allow select currencies" ON public.currencies
    FOR SELECT TO authenticated USING (true);

-- EXCHANGE_RATES: read for all authenticated, write via service (append-only)
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select exchange rates" ON public.exchange_rates;
CREATE POLICY "Allow select exchange rates" ON public.exchange_rates
    FOR SELECT TO authenticated USING (true);

-- Insert is constrained (NOT open-ended) to prevent a malicious authenticated
-- user from polluting the shared rate catalog. See exchange-rates-security-fix.sql.
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

-- BUDGETS: tenant-isolated (personal or family)
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select budgets" ON public.budgets;
CREATE POLICY "Allow select budgets" ON public.budgets
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert budgets" ON public.budgets;
CREATE POLICY "Allow insert budgets" ON public.budgets
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow update budgets" ON public.budgets;
CREATE POLICY "Allow update budgets" ON public.budgets
    FOR UPDATE TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete budgets" ON public.budgets;
CREATE POLICY "Allow delete budgets" ON public.budgets
    FOR DELETE TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- ============================================================
-- ROLLBACK (commented out — run manually if needed)
-- ============================================================
-- DROP TABLE IF EXISTS public.budgets;
-- DROP TABLE IF EXISTS public.exchange_rates;
-- DROP TABLE IF EXISTS public.currencies;
--
-- ALTER TABLE public.transactions
--     DROP COLUMN IF EXISTS currency,
--     DROP COLUMN IF EXISTS rate_to_base,
--     DROP COLUMN IF EXISTS amount_base,
--     DROP COLUMN IF EXISTS base_currency,
--     DROP COLUMN IF EXISTS rate_source,
--     DROP COLUMN IF EXISTS rate_to_base_actual,
--     DROP COLUMN IF EXISTS rate_fetched_at,
--     DROP COLUMN IF EXISTS transfer_id,
--     DROP COLUMN IF EXISTS transfer_rate;
--
-- ALTER TABLE public.accounts
--     DROP COLUMN IF EXISTS currency,
--     DROP COLUMN IF EXISTS is_active;
--
-- ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS base_currency,
--     DROP COLUMN IF EXISTS display_currency;
--
-- ALTER TABLE public.recurring_templates
--     DROP COLUMN IF EXISTS currency;
--
-- ALTER TABLE public.family_groups
--     DROP COLUMN IF EXISTS display_currency;
