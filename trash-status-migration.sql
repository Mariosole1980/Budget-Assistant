-- ============================================================
-- Κάδος Ανακύκλωσης — Μοντέλο Status (Migration)
-- ------------------------------------------------------------
-- Μετάβαση από το παλιό μοντέλο (πίνακας `deleted_transactions`
-- + local tombstones + guards) σε ένα μοντέλο όπου ο κάδος είναι
-- απλό query με πεδίο `status` στη συναλλαγή:
--   status = 'active' | 'deleted'
-- Οριστική διαγραφή = hard DELETE της γραμμής.
--
-- Φάση 0: προσθήκη πεδίων status (rollback: πλήρης)
-- Φάση 1: backfill από deleted_transactions (rollback: πλήρης)
-- Φάση 4: drop deleted_transactions (rollback: όχι — τελευταία)
-- ============================================================

-- ============================================================
-- ΦΑΣΗ 0 — Προσθήκη πεδίων status στον πίνακα transactions
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Index για γρήγορο query του κάδου (status='deleted' ταξινομημένο κατά deleted_at)
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status, deleted_at DESC);

-- Partial index για τις ενεργές συναλλαγές (αποφυγή φίλτρου σε κάθε query)
CREATE INDEX IF NOT EXISTS idx_transactions_active
  ON transactions (user_id, date DESC)
  WHERE status = 'active';

-- ============================================================
-- ΦΑΣΗ 1 — Backfill: μεταφορά υπαρχόντων deleted_transactions
-- στο transactions με status='deleted'
-- ============================================================
INSERT INTO transactions (
  id, date, type, amount, category, subcategory,
  account_from, account_to, note, created_at,
  user_id, is_shared, family_id,
  status, deleted_at
)
SELECT
  id, date, type, amount, category, subcategory,
  account_from, account_to, note, created_at,
  user_id, is_shared, family_id,
  'deleted', deleted_at
FROM deleted_transactions
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROLLBACK Φάσης 0
-- ============================================================
-- ALTER TABLE transactions
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS deleted_by;

-- ============================================================
-- ROLLBACK Φάσης 1
-- ============================================================
-- DELETE FROM transactions WHERE status = 'deleted';

-- ============================================================
-- ΦΑΣΗ 4 — Καθαρισμός (rollback: όχι — μόνο μετά από παρατήρηση)
-- ============================================================
-- DROP TABLE IF EXISTS deleted_transactions;

-- ============================================================
-- Προαιρετικό cleanup (Supabase cron / edge function):
-- Οριστική διαγραφή deleted συναλλαγών παλαιότερων των 90 ημερών
-- ============================================================
-- DELETE FROM transactions
-- WHERE status = 'deleted' AND deleted_at < now() - interval '90 days';
