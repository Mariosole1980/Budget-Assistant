-- ============================================================================
-- CLEANUP: Duplicate recurring installments (e.g. "ΔΟΣΗ ΔΑΝΕΙΟΥ")
-- ============================================================================
-- PURPOSE
--   Remove duplicate occurrences of recurring transactions that were created
--   multiple times within the same month due to a cloud-sync race condition
--   (see the fix in processRecurringTemplates() in app.js).
--
-- SAFETY / DATA-INTEGRITY
--   * Targets ONLY transactions that carry a recurring_template_id (i.e. rows
--     created by the recurring generator). Legitimate identical MANUAL
--     transactions (which have recurring_template_id = NULL) are NEVER touched.
--   * A "true duplicate" is defined as: same recurring_template_id + same date
--     + same amount + status='active'. For each such group we KEEP the single
--     oldest row (lowest created_at, then lowest id) and soft-delete the rest.
--   * We SOFT-DELETE (status='deleted', deleted_at, deleted_by) exactly like the
--     app's trash/restore flow, so nothing is permanently destroyed and the
--     duplicates remain recoverable from the trash if needed.
--
-- HOW TO RUN
--   1) DRY RUN first: run the SELECT block below and review the rows it returns.
--   2) If the report looks correct, run the UPDATE block to apply the cleanup.
--   Execute in: Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 (DRY RUN): Preview the duplicate recurring installments that would be
-- soft-deleted. Review this list carefully before applying any changes.
-- ----------------------------------------------------------------------------
WITH ranked AS (
    SELECT
        id,
        recurring_template_id,
        date,
        amount,
        user_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY recurring_template_id, date, amount
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM public.transactions
    WHERE status = 'active'
      AND recurring_template_id IS NOT NULL
)
SELECT
    r.id,
    r.recurring_template_id,
    r.date,
    r.amount,
    r.user_id,
    r.created_at,
    t.note,
    t.category,
    t.account_from
FROM ranked r
JOIN public.transactions t ON t.id = r.id
WHERE r.rn > 1
ORDER BY r.recurring_template_id, r.date, r.amount, r.created_at;

-- ----------------------------------------------------------------------------
-- STEP 2 (APPLY): Soft-delete the duplicate rows identified above.
-- Run this ONLY after reviewing the dry-run output.
-- ----------------------------------------------------------------------------
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY recurring_template_id, date, amount
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM public.transactions
    WHERE status = 'active'
      AND recurring_template_id IS NOT NULL
)
UPDATE public.transactions t
SET status = 'deleted',
    deleted_at = now(),
    deleted_by = t.user_id
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- ----------------------------------------------------------------------------
-- STEP 3 (VERIFY): Confirm no active duplicates remain for recurring templates.
-- Should return 0 rows.
-- ----------------------------------------------------------------------------
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY recurring_template_id, date, amount
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM public.transactions
    WHERE status = 'active'
      AND recurring_template_id IS NOT NULL
)
SELECT COUNT(*) AS remaining_active_duplicates
FROM ranked
WHERE rn > 1;
