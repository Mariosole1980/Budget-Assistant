-- ============================================================================
-- INSERT updated_at Trigger Migration — Budget Assistant
-- ============================================================================
-- PURPOSE: Close the "clock skew" gap in incremental sync.
--
-- PROBLEM:
--   The existing incremental-sync-migration.sql only adds a BEFORE UPDATE
--   trigger (set_updated_at) that forces NEW.updated_at = now() on UPDATEs.
--   On INSERT, there is NO trigger and NO column default, so the client's
--   updated_at (stamped from the device clock) is stored as-is. If a device
--   clock is ahead of the server, the new row gets a FUTURE updated_at, and the
--   partner's incremental sync cursor (updated_at > cursor) SKIPS it until the
--   next full reconcile — the "invisible transaction" bug.
--
-- FIX:
--   1. Add a DEFAULT now() to the updated_at columns (safety net for clients
--      that do not send updated_at on INSERT).
--   2. Add BEFORE INSERT triggers that force NEW.updated_at = now(), so even a
--      client that DOES send a skewed updated_at is overridden by the server.
--      This makes the server the single source of truth for updated_at on BOTH
--      INSERT and UPDATE.
--
-- SAFETY: This file is IDEMPOTENT and ADDITIVE.
--   * It NEVER drops tables or columns.
--   * It NEVER disables RLS.
--   * It NEVER changes existing rows (no backfill needed — existing rows were
--     already backfilled by incremental-sync-migration.sql).
--   * Re-running is a no-op on an already-migrated database.
--
-- Execute in Supabase SQL Editor. Safe to run at any time.
-- ============================================================================

-- ============================================================================
-- 1. COLUMN DEFAULTS (idempotent safety net)
--    Ensures any INSERT that omits updated_at gets the server time, not NULL.
-- ============================================================================
ALTER TABLE public.transactions
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.accounts
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.categories
    ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.recurring_templates
    ALTER COLUMN updated_at SET DEFAULT now();

-- ============================================================================
-- 2. BEFORE INSERT TRIGGERS (authoritative server time)
--    Force NEW.updated_at = now() on INSERT, overriding any client-supplied
--    (possibly clock-skewed) value. Reuses the existing set_updated_at() fn.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_transactions_updated_at_insert ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at_insert
    BEFORE INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at_insert ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at_insert
    BEFORE INSERT ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at_insert ON public.categories;
CREATE TRIGGER trg_categories_updated_at_insert
    BEFORE INSERT ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_recurring_templates_updated_at_insert ON public.recurring_templates;
CREATE TRIGGER trg_recurring_templates_updated_at_insert
    BEFORE INSERT ON public.recurring_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. VERIFICATION (optional — run to confirm the triggers exist)
-- ============================================================================
-- SELECT tgname, tgtype, tgrelid::regclass
-- FROM pg_trigger
-- WHERE tgname LIKE 'trg_%_updated_at_insert'
-- ORDER BY tgrelid::regclass::text;
