-- ============================================================================
-- Incremental Sync Migration — Budget Assistant
-- ============================================================================
-- PURPOSE: Enable lossless incremental sync by adding:
--   1. updated_at columns + auto-update triggers to the 4 tables that lack it
--      (transactions, accounts, categories, recurring_templates).
--   2. A durable sync_tombstones table for lossless deletion sync.
--   3. Composite indexes (updated_at, id) for keyset pagination.
--
-- SAFETY: This file is IDEMPOTENT and ADDITIVE.
--   * It NEVER drops tables or columns.
--   * It NEVER disables RLS.
--   * It NEVER changes existing columns' semantics (only ADDs columns).
--   * Re-running is a no-op on an already-migrated database.
--   * Existing clients that do not set updated_at still work: the trigger
--     fills it on UPDATE, and INSERTs default via the backfill/trigger logic.
--
-- Execute in Supabase SQL Editor. Safe to run at any time.
-- ============================================================================

-- ============================================================================
-- 1. ADD updated_at COLUMNS (idempotent)
-- ============================================================================
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- 2. BACKFILL existing rows so old data has a valid cursor baseline.
--    Existing rows get updated_at = created_at (their last-known change time).
-- ============================================================================
UPDATE public.transactions
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.accounts
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.categories
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;
UPDATE public.recurring_templates
    SET updated_at = COALESCE(updated_at, created_at)
    WHERE updated_at IS NULL;

-- ============================================================================
-- 3. NOT NULL after backfill (idempotent)
-- ============================================================================
ALTER TABLE public.transactions
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.accounts
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.categories
    ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.recurring_templates
    ALTER COLUMN updated_at SET NOT NULL;

-- ============================================================================
-- 4. AUTO-UPDATE TRIGGER (shared function + per-table triggers)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_templates_updated_at ON public.recurring_templates;
CREATE TRIGGER trg_recurring_templates_updated_at
    BEFORE UPDATE ON public.recurring_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. COMPOSITE INDEXES for keyset pagination (updated_at, id)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at_id
    ON public.transactions (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at_id
    ON public.accounts (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_categories_updated_at_id
    ON public.categories (updated_at, id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_updated_at_id
    ON public.recurring_templates (updated_at, id);

-- ============================================================================
-- 6. SYNC TOMBSTONES TABLE (durable deletion sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sync_tombstones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  TEXT NOT NULL,          -- 'transactions' | 'accounts' | 'categories' | 'recurring_templates' | 'notes' | 'category_budgets' | 'ai_conversations'
    row_id      UUID NOT NULL,          -- the deleted row's id
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id     UUID,
    family_id   UUID,
    UNIQUE (table_name, row_id)
);

-- Composite index for keyset pagination on tombstones
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_scope
    ON public.sync_tombstones (deleted_at, id, user_id, family_id);

-- ============================================================================
-- 7. RLS for sync_tombstones (tenant isolation)
-- ============================================================================
ALTER TABLE public.sync_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow select own tombstones" ON public.sync_tombstones
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow insert own tombstones" ON public.sync_tombstones
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow delete own tombstones" ON public.sync_tombstones;
CREATE POLICY "Allow delete own tombstones" ON public.sync_tombstones
    FOR DELETE TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- ============================================================================
-- DONE
-- ============================================================================
