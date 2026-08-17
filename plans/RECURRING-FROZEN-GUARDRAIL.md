# 🚫 GUARDRAIL — ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΕΣ ΣΥΝΑΛΛΑΓΕΣ (RECURRING) — FROZEN / DO-NOT-TOUCH

> **Αυτό το έγγραφο είναι ΔΕΣΜΕΥΤΙΚΟ για κάθε AI agent (Gemini, DeepSeek, Claude, Copilot κ.λπ.) και κάθε developer που επεξεργάζεται αυτό το repo.**
>
> **ΚΑΝΟΝΑΣ #1:** ΜΗΝ τροποποιείς, "βελτιώνεις", "καθαρίζεις", "απλοποιείς", "διορθώνεις" ή "αναδιαρθρώνεις" ΟΠΟΙΟΔΗΠΟΤΕ μέρος του συστήματος επαναλαμβανόμενων συναλλαγών, **ΕΚΤΟΣ ΑΝ** ο χρήστης το ζητήσει **ΡΗΤΑ και ΣΥΓΚΕΚΡΙΜΕΝΑ** σε αυτό το συγκεκριμένο αίτημα.
>
> **ΚΑΝΟΝΑΣ #2:** Αν ο χρήστης ζητήσει μια αλλαγή που ΔΕΝ αφορά επαναλαμβανόμενες, ΜΗΝ πειράξεις κανένα από τα αρχεία/συναρτήσεις που παρατίθενται παρακάτω, ακόμα κι αν "φαίνεται" σχετικό ή "εύκολο να φτιαχτεί στην πορεία".

---

## 1. Γιατί υπάρχει αυτό το guardrail (Root Cause)

Το σύστημα επαναλαμβανόμενων **μπερδευόταν κάθε φορά** που ένα AI agent το άγγιζε "παρεμπιπτόντως" ή "προληπτικά". Οι λόγοι είναι δομικοί:

1. **Πολλαπλοί αλληλοεπικαλυπτόμενοι μηχανισμοί dedup.** Υπάρχουν τουλάχιστον 4 ξεχωριστά code paths που αγγίζουν τα recurring δεδομένα:
   - [`processRecurringTemplates()`](../app.js:4366) — ο generator
   - [`cleanCrossLanguageRecurringDuplicates()`](../app.js:4258) — dedup στο frontend
   - [`cleanDuplicateTemplates()`](../app.js:4199) — dedup templates
   - [`cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js) — dedup στο backend
   
   Μια αλλαγή σε ένα path συχνά συγκρούεται με τα άλλα. **Δεν είναι απλός κώδικας.**

2. **Κατάσταση κατανεμημένη σε πολλά stores.** Τα recurring δεδομένα ζουν ΤΑΥΤΟΧΡΟΝΑ σε:
   - `state.recurringTemplates` (μνήμη)
   - `localStorage['recurring_templates']`
   - `localStorage['deleted_recurring_dates']`
   - το πεδίο `description` του template (κωδικοποιεί τις διαγραμμένες ημερομηνίες ως `||deleted_dates:...`)
   - τον πίνακα `recurring_templates` στο cloud (Supabase)
   
   Οποιαδήποτε αλλαγή πρέπει να κρατά **όλα** αυτά συγχρονισμένα. Αν χαθεί ένα, τα recurring "ξαναγεννιούνται" ή χάνονται.

3. **Mapping camelCase↔snake_case.** Οι [`mapTemplateToDb()`](../app.js:508) / [`mapTemplateFromDb()`](../app.js:535) πρέπει να μένουν σε απόλυτη συμφωνία με το σχήμα της βάσης. Αν προστεθεί/αφαιρεθεί ένα πεδίο στο ένα χωρίς το άλλο, σπάει το sync.

4. **Ο generator τρέχει σε κάθε UI update** ([`_updateUIImpl()`](../app.js:5039)). Άρα οποιαδήποτε αλλαγή στον generator ή στα helpers του έχει άμεσο, ευρύ αντίκτυπο.

5. **Λεπτή λογική ημερομηνιών/UUID.** Ντετερμινιστικά UUID, deleted-date markers, ορίζοντας 12 μηνών, endType/endDate — όλα είναι ευαίσθητα. Μια "απλοποίηση" που φαίνεται λογική συχνά σπάει τη συμπεριφορά.

6. **Οικονομικά δεδομένα.** Λάθη εδώ = απώλεια ή διπλασιασμός χρηματικών εγγραφών. Το κόστος ενός λάθους είναι πολύ υψηλό.

> **💥 ΠΡΑΓΜΑΤΙΚΟ ΠΑΡΑΔΕΙΓΜΑ (Build v1402):** Κατά την εφαρμογή του HIGH-3 fix, το Gemini εισήγαγε **συντακτικό σφάλμα** (ένα επιπλέον `}`) μέσα στην [`cleanCrossLanguageRecurringDuplicates()`](../app.js:4258). Αυτό θα έκανε **crash ολόκληρη την εφαρμογή** (SyntaxError στο φόρτωμα του `app.js`). Εντοπίστηκε και διορθώθηκε κατά τη δημιουργία αυτού του guardrail. **Αυτός είναι ακριβώς ο λόγος που το σύστημα είναι FROZEN** — ακόμα και μια "σωστή" αλλαγή μπορεί να σπάσει κάτι άλλο.

---

## 2. Λίστα αρχείων / συναρτήσεων που είναι FROZEN

### Frontend — [`app.js`](../app.js)
Αυτές οι συναρτήσεις/μεταβλητές είναι **FROZEN** (μην τις αλλάξεις χωρίς ρητή εντολή):

| Σύμβολο | Γραμμή | Ρόλος |
|---|---|---|
| `state.recurringTemplates` | ~405 | Κατάσταση templates |
| `state.deletedRecurringDates` | ~406 | Διαγραμμένες ημερομηνίες |
| `mapTemplateToDb()` | 508 | Mapping προς DB |
| `mapTemplateFromDb()` | 535 | Mapping από DB |
| `getDeletedDatesFromTemplate()` | 4125 | Ανάγνωση deleted dates |
| `addDeletedDateToTemplate()` | 4135 | Εγγραφή deleted dates |
| `generateDeterministicUUID()` | 4182 | Ντετερμινιστικό UUID |
| `cleanDuplicateTemplates()` | 4199 | Dedup templates |
| `cleanCrossLanguageRecurringDuplicates()` | 4258 | Dedup συναλλαγών |
| `processRecurringTemplates()` | 4404 | **Ο generator** |
| `getRecurringDatesForMonth()` | 4430 | Υπολογισμός ημερομηνιών |
| `deleteTransactionOffline()` | 4897 | Διαγραφή (recurring-aware) |
| `openRecurringDeleteModal()` | 31874 | Διαγραφή με scope |
| `_txBelongsToRecurringSeries()` | 31969 | Έλεγχος σειράς |
| `_computeRecurringSeriesDates()` | 32002 | Υπολογισμός σειράς |
| `executeRecurringDelete()` | 32084 | **Εκτέλεση διαγραφής** |
| `restoreTrashGroup()` | 32332 | Επαναφορά από trash |
| `openRecurringTemplatesModal()` / `openRecurringDetailsModal()` / `openRecurringEditModal()` | 29395+ | UI recurring |
| `saveRecurringTemplateName()` | ~29597 | Αποθήκευση ονόματος |
| `regenerateRecurringTransactions()` | ~29925 | Αναγέννηση |
| `_markRecentlySaved()` | 345 | Grace window |
| `saveTransactionOffline()` | 4741 | Αποθήκευση (recurring-aware) |
| `enqueueSyncMutation()` | 22666 | Sync queue (recurring actions) |

### Backend — [`functions/api/cleanup-recurring-duplicates.js`](../functions/api/cleanup-recurring-duplicates.js)
Ολόκληρο το αρχείο είναι **FROZEN**.

### Schema — [`supabase-recurring-migration.sql`](../supabase-recurring-migration.sql)
Ο πίνακας `recurring_templates` και οι RLS policies του είναι **FROZEN**.

### Σχετικά migration/SQL
- [`supabase-recurring-migration.sql`](../supabase-recurring-migration.sql)
- Οποιοδήποτε SQL που αγγίζει τον πίνακα `recurring_templates` ή τη στήλη `recurring_template_id` του `transactions`.

---

## 3. Τι να κάνεις ΑΝ ο χρήστης ζητήσει ρητά αλλαγή στα recurring

Αν (και ΜΟΝΟ αν) ο χρήστης ζητήσει **ρητά** αλλαγή στα recurring:

1. **ΔΙΑΒΑΣΕ πρώτα** το [`plans/recurring-architecture-deep-review.md`](recurring-architecture-deep-review.md) — περιέχει το πλήρες αρχιτεκτονικό πλαίσιο και τις ήδη-επιβεβαιωμένες διορθώσεις.
2. **Κάνε ΜΙΑ αλλαγή τη φορά** και εξήγησέ την. Μην "βελτιώσεις" άλλα πράγματα στην πορεία.
3. **Διατήρησε όλα τα stores συγχρονισμένα** (state + localStorage + description + cloud).
4. **Διατήρησε το mapping** `mapTemplateToDb`/`mapTemplateFromDb` σε συμφωνία με το DB schema.
5. **Μην αφαιρέσεις** τα safety nets: NaN guards, iteration caps, deterministic UUIDs, deleted-date markers, grace window.
6. **Τρέξε τα tests** (`node --test "test/**/*.test.js"`) πριν ολοκληρώσεις.
7. **Μην αλλάξεις** τη συμπεριφορά των 4 υπαρχόντων templates του χρήστη (ΕΝΦΙΑ, ΔΟΣΗ ΔΑΝΕΙΟΥ, Αλλαγή Ελαστικών, ΕΤΗΣΙΑ ΑΣΦΑΛΕΙΑ) εκτός αν ζητηθεί.

---

## 4. Τι να κάνεις ΑΝ ΔΕΝ είσαι σίγουρος

- **Αν η αλλαγή που ζητήθηκε ΔΕΝ αφορά recurring** → ΜΗΝ αγγίξεις τίποτα από τη λίστα της ενότητας 2.
- **Αν η αλλαγή αφορά recurring αλλά δεν είσαι σίγουρος** → ΡΩΤΗΣΕ τον χρήστη πριν προχωρήσεις. Μην υποθέσεις.
- **Αν βρεις "bug" στα recurring ενώ κάνεις άλλη δουλειά** → ΜΗΝ το φτιάξεις μόνος σου. Σημείωσέ το και αναφέρσου στον χρήστη, αλλά μην τροποποιήσεις τον κώδικα χωρίς έγκριση.

---

## 5. Σύνοψη (για γρήγορη ανάγνωση από AI)

> **Το σύστημα επαναλαμβανόμενων συναλλαγών είναι FROZEN και επιβεβαιωμένα σταθερό (Build v1402, 62/62 tests).**
> Μην το αγγίζεις εκτός αν ο χρήστης το ζητήσει ρητά. Αν το ζητήσει, διάβασε πρώτα το [`recurring-architecture-deep-review.md`](recurring-architecture-deep-review.md), κάνε μία αλλαγή τη φορά, κράτα όλα τα stores συγχρονισμένα, και τρέξε τα tests.
