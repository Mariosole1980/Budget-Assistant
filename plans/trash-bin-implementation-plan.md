# Πλάνο Υλοποίησης — Κάδος Ανακύκλωσης (Μοντέλο Status)

Βάσει της αρχιτεκτονικής απόφασης στο [`plans/trash-bin-architecture-decision.md`](plans/trash-bin-architecture-decision.md). Αυτό το έγγραφο είναι το **εκτελέσιμο πλάνο** με migration SQL και βήματα κώδικα ανά φάση.

---

## Στόχος

Μετάβαση από το τρέχον μοντέλο (πίνακας `deleted_transactions` + local tombstones + guards) σε ένα μοντέλο όπου ο κάδος είναι **απλό query** με πεδίο `status` στη συναλλαγή:

- `status = 'active' | 'deleted'`
- Οριστική διαγραφή = **hard DELETE** της γραμμής
- Κατάργηση: `deleted_transactions`, local tombstones, `fetchCloudTrashToLocal()`, `syncLocalTrashToCloud()`, guards κάδου

---

## Φάση 0 — Προετοιμασία (rollback: πλήρης)

### Migration SQL
```sql
-- Προσθήκη πεδίων status στον πίνακα transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Index για γρήγορο query του κάδου
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status, deleted_at DESC);

-- Partial index για τις ενεργές συναλλαγές (αποφυγή φίλτρου σε κάθε query)
CREATE INDEX IF NOT EXISTS idx_transactions_active
  ON transactions (user_id, date DESC)
  WHERE status = 'active';
```

### Βήματα κώδικα
- **Κανένα.** Η εφαρμογή συνεχίζει με τον παλιό μηχανισμό. Τα νέα πεδία μένουν αχρησιμοποίητα (default `'active'`).

### Rollback
```sql
ALTER TABLE transactions DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
```
Μηδενικός αντίκτυπος.

---

## Φάση 1 — Backfill (rollback: πλήρης)

### Migration SQL
```sql
-- Μεταφορά υπαρχόντων deleted_transactions στο transactions με status='deleted'
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
```

### Βήματα κώδικα
- **Κανένα.** Ο πίνακας `deleted_transactions` παραμένει ως έχει (δεν διαγράφεται).

### Rollback
```sql
DELETE FROM transactions WHERE status = 'deleted';
```
Τα δεδομένα παραμένουν στο `deleted_transactions`.

---

## Φάση 2 — Dual-write (rollback: πλήρης)

Η εφαρμογή γράφει **και** στο νέο μοντέλο **και** στον παλιό. Ο κάδος διαβάζει από το νέο μοντέλο.

### Βήματα κώδικα

**2.1 Διαγραφή συναλλαγής** — [`deleteTransaction()`](app.js:5301)
- Αντί για `saveDeletedTransactionsToSupabase()` + `delete()`:
  ```js
  // Αντί για διαγραφή, σήμανε status='deleted'
  await state.supabaseClient.from('transactions')
    .update({ status: 'deleted', deleted_at: new Date().toISOString(), deleted_by: state.currentUser.id })
    .in('id', idsToDelete);
  ```
- **Dual-write:** κράτα και το `saveDeletedTransactionsToSupabase()` προσωρινά.
- Τοπικά: αφαίρεσε από `state.transactions`, πρόσθεσε στον κάδο (όπως σήμερα).

**2.2 Επαναφορά** — [`restoreTransaction()`](app.js:25364)
- Αντί για `delete` από `deleted_transactions` + `upsert` στο `transactions`:
  ```js
  await state.supabaseClient.from('transactions')
    .update({ status: 'active', deleted_at: null, deleted_by: null })
    .eq('id', id);
  ```

**2.3 Οριστική διαγραφή (εκκαθάριση)** — [`emptyTrashBin()`](app.js:25408)
- Αντί για scoped delete στο `deleted_transactions`:
  ```js
  await state.supabaseClient.from('transactions')
    .delete()
    .eq('status', 'deleted')
    .or(`user_id.eq.${userId},family_id.eq.${familyId}`);
  ```
- **Αφαίρεσε** τα local tombstones (`_markPermanentlyDeleted`).

**2.4 Οριστική διαγραφή (μεμονωμένη)** — [`deleteSingleTrashItem()`](app.js:26711)
- Αντί για delete στο `deleted_transactions`:
  ```js
  await state.supabaseClient.from('transactions').delete().eq('id', id);
  ```
- **Αφαίρεσε** τα local tombstones.

**2.5 Κάδος (ανάγνωση)** — [`renderTrashBinList()`](app.js:25252)
- Ο κάδος διαβάζει από `state.trashTransactions` (όπως σήμερα), αλλά το `state.trashTransactions` γεμίζει από query:
  ```js
  const { data } = await state.supabaseClient.from('transactions')
    .select('*')
    .eq('status', 'deleted')
    .or(`user_id.eq.${userId},family_id.eq.${familyId}`)
    .order('deleted_at', { ascending: false })
    .limit(100);
  ```

**2.6 Realtime handler** — [`handleRealtimeTransactionChange()`](app.js:19730)
- Στο `UPDATE`, έλεγξε το `status`:
  ```js
  } else if (eventType === 'UPDATE') {
    const updatedTrans = ev.new;
    const idx = trans.findIndex(t => t.id === updatedTrans.id);
    if (idx !== -1) {
      if (updatedTrans.status === 'deleted') {
        trans.splice(idx, 1); // αφαίρεσε από ενεργές λίστες
        changed = true;
      } else {
        trans[idx] = updatedTrans;
        changed = true;
      }
    }
  }
  ```

**2.7 Φόρτωση ενεργών συναλλαγών** — [`loadData()`](app.js:4195)
- Πρόσθεσε `.eq('status', 'active')` στο query των transactions ώστε να μην έρχονται τα deleted στις ενεργές λίστες.

### Rollback
- Επαναφορά στην ανάγνωση από `deleted_transactions`. Τα νέα πεδία μένουν αχρησιμοποίητα.

---

## Φάση 3 — Cutover (rollback: μερικός)

### Βήματα κώδικα
- **Αφαίρεσε** το dual-write (σταμάτα το `saveDeletedTransactionsToSupabase`).
- **Αφαίρεσε** [`fetchCloudTrashToLocal()`](app.js:5199) και [`syncLocalTrashToCloud()`](app.js:5191).
- **Αφαίρεσε** τα local tombstones: `PERMANENT_DELETE_KEY`, `_markPermanentlyDeleted`, `_isPermanentlyDeleted`, `_permanentDeleteInProgress`.
- **Αφαίρεσε** τους guards του κάδου από [`mergeAndDeduplicateTransactions()`](app.js:703) (Guard 3, 3b).
- **Αφαίρεσε** τις κλήσεις `fetchCloudTrashToLocal()` από [`loadData()`](app.js:4145) και [`forceSyncNow()`](app.js:19946).

### Rollback
- Δύσκολο (απαιτεί re-run backfill). Γι' αυτό γίνεται μόνο μετά από σταθερή Φάση 2.

---

## Φάση 4 — Καθαρισμός (rollback: όχι)

### Migration SQL
```sql
-- Μετά από περίοδο παρατήρησης
DROP TABLE IF EXISTS deleted_transactions;
```

### Βήματα κώδικα
- Καμία αλλαγή κώδικα.

### Rollback
- Όχι — γι' αυτό γίνεται τελευταία και μόνο όταν είμαστε σίγουροι.

---

## Όριο κάδου (100 items)

- Επιβάλλεται **server-side** με `.limit(100)` στο query του κάδου (Φάση 2.5).
- Τα παλαιότερα `deleted` μένουν στο DB (ασφάλεια) αλλά δεν εμφανίζονται.
- **Προαιρετικό cleanup** (Supabase cron / edge function):
  ```sql
  DELETE FROM transactions
  WHERE status = 'deleted' AND deleted_at < now() - interval '90 days';
  ```

---

## Λίστα αρχείων προς τροποποίηση

| Αρχείο | Αλλαγές |
|--------|---------|
| [`app.js`](app.js) | deleteTransaction, restoreTransaction, emptyTrashBin, deleteSingleTrashItem, renderTrashBinList, handleRealtimeTransactionChange, loadData, forceSyncNow, mergeAndDeduplicateTransactions, αφαίρεση tombstones/guards |
| [`www/app.js`](www/app.js) | Ίδιες αλλαγές (αντίγραφο για deploy) |
| Migration SQL | Νέο αρχείο (π.χ. `trash-status-migration.sql`) |

> **Σημείωση:** Το `www/app.js` είναι το deployable αντίγραφο του `app.js`. Οι αλλαγές πρέπει να εφαρμοστούν και στα δύο (ή να γίνει copy μετά).

---

## Σειρά υλοποίησης (για Code mode)

1. Φάση 0: migration SQL + index.
2. Φάση 1: backfill SQL.
3. Φάση 2: dual-write + κάδος query + realtime handler + loadData filter.
4. Φάση 3: cutover (αφαίρεση παλιού μηχανισμού).
5. Φάση 4: drop `deleted_transactions` (μετά από παρατήρηση).
6. Εφαρμογή ίδιων αλλαγών στο `www/app.js`.
7. Δοκιμή: διαγραφή → κάδος → επαναφορά → οριστική διαγραφή → επανεμφάνιση σε 2η συσκευή.
