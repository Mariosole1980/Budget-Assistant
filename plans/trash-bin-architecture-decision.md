# Τελική Αρχιτεκτονική Απόφαση — Κάδος Ανακύκλωσης

Αυτό το έγγραφο απαντά στα 5 ερωτήματα σχεδιασμού και καταλήγει στην τελική αρχιτεκτονική απόφαση.

---

## Q1: Χρειάζεται το `permanently_deleted` ως τρίτο status;

**Όχι — και αυτό είναι σκόπιμο.**

Αν κρατήσουμε το `permanently_deleted` ως μόνιμη γραμμή μέσα στο `transactions`, ξαναδημιουργούμε **συσσώρευση δεδομένων** (το ίδιο πρόβλημα που θέλουμε να λύσουμε) και χρειαζόμαστε ξανά κάποιο purge. Η οριστική διαγραφή πρέπει να είναι **πραγματική διαγραφή** (hard DELETE) της γραμμής.

**Απόφαση:** Μόνο **δύο status** στο `transactions`:

```
status = 'active' | 'deleted'
```

- `active` → ορατό στις λίστες.
- `deleted` → ορατό μόνο στον κάδο.

Η **οριστική διαγραφή** (εκκαθάριση κάδου / μεμονωμένη) = **hard DELETE** της γραμμής από το `transactions`. Δεν υπάρχει τρίτο status, δεν υπάρχει συσσώρευση.

---

## Q2: Τελικό lifecycle + πολιτική purge/archive

```
active ──διαγραφή──▶ deleted ──οριστική──▶ (hard DELETE)
   ▲                    │
   └──────επαναφορά─────┘
```

### Πολιτική δεδομένων

| Κατάσταση | Πού ζει | Διάρκεια |
|-----------|---------|----------|
| `active` | `transactions` | Μόνιμα |
| `deleted` | `transactions` (status='deleted') | Έως οριστική διαγραφή ή επαναφορά |
| Οριστικά διαγραμμένα | Δεν υπάρχουν | — |

### Purge (προαιρετικό, για υγιεινή)

Ο κάδος έχει **όριο 100 items** (βλ. Q5). Αν θέλουμε και χρονικό όριο, μπορεί να προστεθεί ένα **scheduled cleanup** (π.χ. Supabase cron / edge function) που διαγράφει οριστικά `deleted` γραμμές παλαιότερες από N ημέρες. Αυτό είναι **προαιρετικό** και δεν επηρεάζει τη βασική λειτουργία.

> **Σημείωση:** Δεν χρειάζεται ξεχωριστό archive. Αν ο χρήστης θέλει "μόνιμη" διαγραφή, αυτό είναι το hard DELETE. Αν θέλει να κρατήσει ιστορικό, το κρατάει ως `active` (δεν το διαγράφει).

---

## Q3: Realtime handler για `UPDATE status=deleted` αντί για DELETE event

### Το πρόβλημα

Σήμερα, η διαγραφή στο cloud στέλνει **DELETE event** και ο handler [`handleRealtimeTransactionChange()`](app.js:19730) αφαιρεί τη συναλλαγή από τη λίστα. Με το μοντέλο status, η διαγραφή γίνεται **UPDATE** (`status='deleted'`), όχι DELETE.

Αν ο handler δεν αλλάξει, το UPDATE θα **κρατήσει τη συναλλαγή στη λίστα** (γιατί το `idx !== -1` και απλώς αντικαθιστά το αντικείμενο) — με αποτέλεσμα η διαγραμμένη κίνηση να **παραμένει ορατή** στις ενεργές λίστες. Αυτό είναι το αντίστροφο bug.

### Η λύση

Ο handler πρέπει να ελέγχει το `status` στο UPDATE:

```js
} else if (eventType === 'UPDATE') {
  const updatedTrans = ev.new;
  const idx = trans.findIndex(t => t.id === updatedTrans.id);
  if (idx !== -1) {
    if (updatedTrans.status === 'deleted') {
      // Διαγράφηκε → αφαίρεσε από τις ενεργές λίστες
      trans.splice(idx, 1);
      changed = true;
    } else {
      trans[idx] = updatedTrans;
      changed = true;
    }
  }
}
```

### Αποφυγή flickering / επανεμφάνισης

1. **Το υπάρχον debounce (5s)** στο [`handleRealtimeTransactionChange()`](app.js:19774) ήδη μαζεύει τα events και αποτρέπει το flickering — παραμένει.
2. **`_suppressRealtimeEvents`** — όταν η ίδια η συσκευή κάνει τη διαγραφή, τα δικά της events καταστέλλονται, οπότε δεν υπάρχει διπλή επεξεργασία.
3. **Ο κάδος είναι ξεχωριστό query** (`status='deleted'`), όχι μέρος του `state.transactions`. Άρα η διαγραφή δεν "ανακατεύει" τις ενεργές λίστες με τον κάδο.
4. **Καμία επανεμφάνιση:** αφού η αλήθεια είναι στο cloud (`status`), κάθε συσκευή βλέπει το ίδιο. Δεν υπάρχουν local tombstones που να χάνονται.

---

## Q4: Phased migration με rollback

Η μετάβαση γίνεται σε **φάσεις**, με δυνατότητα rollback σε κάθε βήμα.

### Φάση 0 — Προετοιμασία (rollback: πλήρης)
- Προσθήκη πεδίων `status` (default `'active'`), `deleted_at`, `deleted_by` στον πίνακα `transactions`.
- **Κανένα αλλαγμένο query ακόμα.** Η εφαρμογή συνεχίζει να δουλεύει με τον παλιό μηχανισμό.
- **Rollback:** drop τα νέα πεδία. Μηδενικός αντίκτυπος.

### Φάση 1 — Backfill (rollback: πλήρης)
- Μεταφορά των υπαρχόντων γραμμών από `deleted_transactions` σε `transactions` με `status='deleted'` (και `deleted_at`).
- Διατήρηση του πίνακα `deleted_transactions` ως έχει (δεν διαγράφεται ακόμα).
- **Rollback:** διαγραφή των backfilled `deleted` γραμμών από `transactions`. Τα δεδομένα παραμένουν στο `deleted_transactions`.

### Φάση 2 — Dual-write (rollback: πλήρης)
- Η εφαρμογή γράφει **και** στο νέο μοντέλο (`status`) **και** στον παλιό (`deleted_transactions`).
- Ο κάδος διαβάζει από το νέο μοντέλο.
- **Rollback:** επαναφορά στην ανάγνωση από `deleted_transactions`. Τα νέα πεδία μένουν αχρησιμοποίητα.

### Φάση 3 — Cutover (rollback: μερικός)
- Αφαίρεση του dual-write. Μόνο το νέο μοντέλο.
- Αφαίρεση `fetchCloudTrashToLocal()`, `syncLocalTrashToCloud()`, local tombstones, guards.
- **Rollback:** δύσκολο (απαιτεί re-run backfill), γι' αυτό η Φάση 3 γίνεται μόνο μετά από σταθερή Φάση 2.

### Φάση 4 — Καθαρισμός (rollback: όχι)
- Διαγραφή του πίνακα `deleted_transactions` (μετά από περίοδο παρατήρησης).
- **Rollback:** όχι — γι' αυτό γίνεται τελευταία και μόνο όταν είμαστε σίγουροι.

---

## Q5: Το όριο των 100 items με cloud ως source of truth

### Το πρόβλημα

Σήμερα το όριο των 100 εφαρμόζεται **τοπικά** (`slice(-100)`). Με το cloud ως source of truth, κάθε συσκευή θα έκανε `SELECT ... WHERE status='deleted'` και θα έπαιρνε **όλα** τα deleted — χωρίς όριο. Ο κάδος θα μπορούσε να μεγαλώσει απεριόριστα.

### Η λύση

Το όριο πρέπει να επιβάλλεται **στο query** (server-side), όχι στο client:

```sql
SELECT * FROM transactions
WHERE status = 'deleted'
  AND (user_id = :uid OR family_id = :fid)
ORDER BY deleted_at DESC
LIMIT 100;
```

- **Σταθερό όριο 100** σε όλες τις συσκευές — ίδια συμπεριφορά παντού.
- **Πολιτική:** όταν ο κάδος φτάσει τα 100, τα παλαιότερα `deleted` είτε:
  - (α) **hard-delete** αυτόματα (απλή, αλλά χάνει δεδομένα), ή
  - (β) μένουν στο DB αλλά δεν εμφανίζονται (ασφαλέστερο, χρειάζεται cleanup job).

**Σύσταση:** (β) — τα παλαιότερα deleted μένουν στο DB (για ασφάλεια) αλλά δεν εμφανίζονται, και ένα προαιρετικό scheduled cleanup τα διαγράφει μετά από N ημέρες. Έτσι το όριο είναι **συνεπές** και **ασφαλές**.

---

## Τελική Αρχιτεκτονική Απόφαση

**Υιοθετούμε το μοντέλο `status` με 2 καταστάσεις και hard delete για οριστική διαγραφή.**

### Σύνοψη αποφάσεων

| Θέμα | Απόφαση |
|------|---------|
| Πίνακας | Ένας `transactions` με `status` ('active'/'deleted') |
| Οριστική διαγραφή | Hard DELETE της γραμμής |
| `deleted_transactions` | Καταργείται (Φάση 4) |
| Local tombstones | Καταργούνται |
| Guards κάδου | Καταργούνται |
| Realtime | UPDATE με έλεγχο `status` |
| Όριο κάδου | Server-side `LIMIT 100` + προαιρετικό cleanup |
| Migration | 5 φάσεις με rollback |

### Οφέλη
- **Μόνιμη λύση** του προβλήματος επανεμφάνισης σε όλες τις συσκευές.
- **Λιγότερη κατάσταση** (όχι περισσότερη): ένα πεδίο αντί για πίνακα + tombstones + guards.
- **Επαναχρησιμοποίηση** του υπάρχοντος sync queue.
- **Φυσικό family sharing** μέσω `deleted_by` / `family_id`.

### Κόστος
- Migration σε φάσεις (με rollback).
- Αλλαγή realtime handler.
- Server-side όριο κάδου.

---

## Επόμενα βήματα (μετά την έγκριση)

1. Δημιουργία πλήρους πλάνου υλοποίησης (migration SQL + βήματα κώδικα ανά φάση).
2. Υλοποίηση σε Code mode.
