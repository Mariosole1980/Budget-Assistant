# Multi-Currency — Δεύτερο Αρχιτεκτονικό Review (Edge Cases & Τελικό Σχέδιο)

**Σκοπός:** Βαθύτερο review του σχεδιασμού πολλαπλών νομισμάτων, εξέταση edge cases
που μπορεί να δημιουργήσουν προβλήματα στο μέλλον, και κατάληξη σε τελικό σχέδιο
(schema, source of truth, CurrencyService, accounts/wallets, phases, edge cases).

**Κατάσταση:** DESIGN REVIEW #2 — πριν την υλοποίηση.

**Βασική αρχή (επιβεβαιωμένη):**
- Αποθηκεύουμε το πραγματικό ποσό και το πραγματικό νόμισμα της συναλλαγής.
- Αποθηκεύουμε την ιστορική ισοτιμία που χρησιμοποιήθηκε.
- Υπολογίζουμε το ποσό στο βασικό νόμισμα.
- Δεν αλλάζουμε ιστορικές συναλλαγές όταν αλλάζουν οι ισοτιμίες.

---

## 1. Source of Truth vs Cache

### 1.1 Το πρόβλημα

```
amount = 50
currency = USD
rate_to_base = 1.17
amount_base = 42.73
```

Αν αλλάξει ο τρόπος στρογγυλοποίησης ή υπολογισμού, το `amount_base` είναι μόνιμη
αλήθεια ή cache που μπορεί να ξαναδημιουργηθεί;

### 1.2 Απόφαση: Το `amount_base` είναι **cache**, όχι source of truth

**Source of truth (αμετάβλητα, μη ανακατασκευάσιμα):**
- `amount` — το πραγματικό ποσό που πληρώθηκε (εισάγεται από τον χρήστη).
- `currency` — το πραγματικό νόμισμα της συναλλαγής.
- `rate_to_base` — η ισοτιμία που **πραγματικά χρησιμοποιήθηκε** για τη μετατροπή.
- `base_currency` — το βασικό νόμισμα αναφοράς κατά τη δημιουργία.

**Cache (ανακατασκευάσιμο, παράγωγο):**
- `amount_base` — πάντα `= amount / rate_to_base` (με τον τρέχοντα αλγόριθμο
  στρογγυλοποίησης). Μπορεί να ξαναδημιουργηθεί από τα 4 πεδία source of truth.

### 1.3 Γιατί αυτό είναι σωστό

- **Αναπαραγωγιμότητα:** Οποιαδήποτε στιγμή, `amount_base` μπορεί να υπολογιστεί ξανά
  από `(amount, currency, rate_to_base)`. Αν αλλάξει ο αλγόριθμος στρογγυλοποίησης,
  τρέχουμε ένα backfill που ξαναϋπολογίζει όλα τα `amount_base` — χωρίς να χαθεί
  καμία πληροφορία, γιατί η πηγή αλήθειας παραμένει άθικτη.
- **Συνέπεια:** Δεν μπορεί να υπάρξει απόκλιση μεταξύ αρχικού ποσού, ισοτιμίας και
  converted ποσού, γιατί το `amount_base` **προκύπτει πάντα** από τα άλλα τρία.
- **Ακρίβεια:** Το `rate_to_base` αποθηκεύεται με **8 δεκαδικά** (`NUMERIC(18,8)`),
  ώστε ο υπολογισμός `amount / rate_to_base` να είναι ακριβής. Η στρογγυλοποίηση
  γίνεται ΜΟΝΟ στο τελικό `amount_base` (2-4 δεκαδικά), όχι στο ενδιάμεσο βήμα.

### 1.4 Πώς διασφαλίζεται η συνέπεια

1. **Ένας μόνο δρόμος εγγραφής:** Το `amount_base` υπολογίζεται αποκλειστικά μέσα από
   το `CurrencyService.computeAmountBase()`. Κανένα άλλο σημείο του κώδικα δεν το
   θέτει απευθείας.
2. **DB constraint (προαιρετικό, ισχυρό):** Μπορούμε να προσθέσουμε ένα
   `CHECK (amount_base = ROUND(amount / rate_to_base, 4))` για να αποτρέψουμε
   ασυνέπειες σε επίπεδο βάσης. (Σημείωση: το ROUND σε NUMERIC είναι ντετερμινιστικό,
   οπότε το constraint είναι έγκυρο.)
3. **Reconciliation job:** Ένα ελαφρύ script μπορεί περιοδικά να ελέγχει αν
   `amount_base` ταιριάζει με `amount / rate_to_base` και να διορθώνει αποκλίσεις.

### 1.5 Σύνοψη

| Πεδίο | Τύπος | Source of truth | Cache |
|---|---|---|---|
| `amount` | NUMERIC(18,4) | ✅ | |
| `currency` | TEXT | ✅ | |
| `rate_to_base` | NUMERIC(18,8) | ✅ | |
| `base_currency` | TEXT | ✅ | |
| `amount_base` | NUMERIC(18,4) | | ✅ (παράγωγο) |

---

## 2. User Currency vs Account Currency (Wallets)

### 2.1 Το πρόβλημα

Ένα μόνο `base_currency` στο profile δεν αρκεί. Ένας χρήστης μπορεί να έχει:
- προσωπικό νόμισμα εμφάνισης EUR,
- τραπεζικό λογαριασμό EUR,
- PayPal USD,
- μετρητά GBP.

### 2.2 Απόφαση: Δύο ξεχωριστές έννοιες

Πρέπει να διαχωρίσουμε **τρία** διαφορετικά πράγματα που σήμερα συγχέονται:

1. **`account.currency`** — το νόμισμα στο οποίο είναι **εκφρασμένο** το υπόλοιπο ενός
   λογαριασμού/πορτοφολιού. Κάθε account έχει το δικό του.
2. **`user.display_currency`** — το νόμισμα στο οποίο ο χρήστης **προτιμά να βλέπει**
   τα συνολικά στατιστικά και τα αθροίσματα. Αυτό είναι το "base currency" του
   προηγούμενου σχεδιασμού.
3. **`user.base_currency`** — το νόμισμα στο οποίο **αποθηκεύεται** το `amount_base`
   των συναλλαγών (το "αγκυροβόλιο" του ιστορικού).

### 2.3 Γιατί χρειάζονται και τα τρία

- **`account.currency`:** Απαραίτητο για να ξέρουμε σε τι νόμισμα είναι το υπόλοιπο
  κάθε λογαριασμού (PayPal USD ≠ τραπεζικός EUR). Χωρίς αυτό, δεν μπορούμε να
  υπολογίσουμε σωστά το net worth.
- **`user.display_currency`:** Ο χρήστης μπορεί να θέλει να βλέπει τα πάντα σε EUR
  ακόμα κι αν έχει λογαριασμούς σε USD/GBP. Είναι καθαρά θέμα εμφάνισης.
- **`user.base_currency`:** Χρειάζεται για να ορίσουμε σε τι νόμισμα αποθηκεύεται το
  `amount_base`. **Σύσταση:** Το `base_currency` είναι **σταθερό** (συνήθως το πρώτο
  νόμισμα που χρησιμοποίησε ο χρήστης) και **δεν αλλάζει** με το `display_currency`.
  Αυτό αποφεύγει την ανάγκη μαζικού επανυπολογισμού (βλ. §6).

### 2.4 Πώς λειτουργούν τα συνολικά στατιστικά με πολλούς λογαριασμούς

- Κάθε συναλλαγή έχει `amount_base` στο `base_currency` (σταθερό αγκυροβόλιο).
- Τα **συνολικά** στατιστικά (net worth, σύνολα εξόδων/εσόδων) υπολογίζονται πάντα
  στο `base_currency` αθροίζοντας `amount_base`.
- Για **εμφάνιση** στο `display_currency` (αν διαφέρει), μετατρέπουμε το τελικό
  άθροισμα με τη **σημερινή** ισοτιμία — γιατί εδώ πρόκειται για "τι αξίζει τώρα",
  όχι για ιστορικό. (Αυτό είναι διαφορετικό από τις μεμονωμένες συναλλαγές, που
  χρησιμοποιούν ιστορική ισοτιμία.)
- Το **υπόλοιπο κάθε λογαριασμού** εμφανίζεται στο `account.currency` του, και το
  ισοδύναμο στο `display_currency` δίπλα (με τρέχουσα ισοτιμία).

### 2.5 Σύνοψη

| Έννοια | Πού αποθηκεύεται | Ρόλος |
|---|---|---|
| `account.currency` | πίνακας `accounts` | Νόμισμα υπολοίπου λογαριασμού |
| `user.base_currency` | πίνακας `profiles` | Σταθερό αγκυροβόλιο αποθήκευσης `amount_base` |
| `user.display_currency` | πίνακας `profiles` | Νόμισμα εμφάνισης στατιστικών |

---

## 3. Κατάσταση Αξιοπιστίας της Μετατροπής

### 3.1 Το πρόβλημα

Πρέπει να γνωρίζουμε **πώς** προέκυψε η ισοτιμία: online (API), offline (cached), ή
χειροκίνητα. Αυτό επηρεάζει την εμπιστοσύνη του χρήστη στο ποσό.

### 3.2 Απόφαση: Πεδίο `rate_source` (και παράγωγο `conversion_status`)

Προσθέτουμε στο `transactions` ένα πεδίο που καταγράφει την προέλευση της ισοτιμίας:

```sql
rate_source TEXT NOT NULL DEFAULT 'api'
    CHECK (rate_source IN ('api', 'cached', 'manual'))
```

Και στο client, ένα παράγωγο `conversion_status` για εμφάνιση:

| `rate_source` | `conversion_status` | Εμφάνιση στον χρήστη |
|---|---|---|
| `'api'` | `'confirmed'` | "Μετατροπή με επίσημη ισοτιμία" (πράσινο) |
| `'cached'` | `'estimate'` | "Εκτίμηση — τελευταία γνωστή ισοτιμία" (πορτοκαλί) |
| `'manual'` | `'manual'` | "Χειροκίνητη ισοτιμία" (μπλε) |

### 3.3 Πώς παρουσιάζεται στον χρήστη

- Στη **λίστα συναλλαγών**, δίπλα στο δευτερεύον ποσό (το ισοδύναμο στο βασικό
  νόμισμα), εμφανίζεται ένα μικρό εικονίδιο/χρώμα που δηλώνει την κατάσταση:
  - ✅ πράσινο = επιβεβαιωμένη (API)
  - ⚠️ πορτοκαλί = εκτίμηση (cached)
  - ✍️ μπλε = χειροκίνητη
- Στη **λεπτομέρεια συναλλαγής**, εμφανίζεται αναλυτικά: "Χρησιμοποιήθηκε ισοτιμία
  1.17 (1 EUR = 1.17 USD) από [πηγή], στις [ημερομηνία]".

### 3.4 Γιατί είναι σημαντικό

- **Διαφάνεια:** Ο χρήστης ξέρει αν το ποσό είναι ακριβές ή εκτίμηση.
- **Εμπιστοσύνη:** Αν μια offline συναλλαγή έχει εκτιμώμενη ισοτιμία, ο χρήστης μπορεί
  να την ελέγξει και να τη διορθώσει αργότερα (βλ. §5).
- **Μελλοντική χρήση:** Μπορεί να χρησιμοποιηθεί για αναφορές ("πόσες συναλλαγές έχουν
  εκτιμώμενη ισοτιμία;").

---

## 4. Ακρίβεια Χρόνου Ισοτιμίας

### 4.1 Το πρόβλημα

Μια αγορά γίνεται 04/08/2026 10:00. Η εφαρμογή παίρνει ισοτιμία 04/08/2026 από ECB.
Αρκεί η ημερομηνία ή χρειάζεται timestamp;

### 4.2 Ανάλυση

- Οι **επίσημες ισοτιμίες** (ECB, Visa/Mastercard) δημοσιεύονται **μία φορά την ημέρα**
  (συνήθως ~16:00 CET για ECB). Δεν υπάρχει "ισοτιμία 10:00" από την ECB — υπάρχει μόνο
  "ισοτιμία της ημέρας".
- Επομένως, για **ιστορική μετατροπή**, η **ημερομηνία** είναι το σωστό επίπεδο
  ακρίβειας. Το timestamp δεν προσθέτει πληροφορία γιατί η ισοτιμία δεν αλλάζει μέσα
  στην ημέρα.
- Το timestamp έχει νόημα ΜΟΝΟ για **καταγραφή** (πότε λήφθηκε/χρησιμοποιήθηκε η
  ισοτιμία), όχι για τον υπολογισμό.

### 4.3 Απόφαση

- **Υπολογισμός:** Χρησιμοποιείται η **ημερομηνία** (`rate_date`) της συναλλαγής.
- **Καταγραφή:** Προσθέτουμε `rate_fetched_at TIMESTAMPTZ` για να ξέρουμε **πότε**
  λήφθηκε η ισοτιμία (χρήσιμο για audit και για να δούμε πόσο "παλιά" είναι μια
  cached ισοτιμία).

```sql
-- Στον πίνακα exchange_rates
rate_date     DATE NOT NULL,        -- ημερομηνία ισχύος (χρησιμοποιείται στον υπολογισμό)
fetched_at    TIMESTAMPTZ DEFAULT now(),  -- πότε λήφθηκε (audit)

-- Στο transactions
rate_fetched_at TIMESTAMPTZ,        -- πότε χρησιμοποιήθηκε η ισοτιμία για αυτή τη συναλλαγή
```

### 4.4 Σύνοψη

| Επίπεδο | Χρήση |
|---|---|
| `rate_date` (DATE) | **Υπολογισμός** μετατροπής (ιστορική ισοτιμία της ημέρας) |
| `fetched_at` / `rate_fetched_at` (TIMESTAMPTZ) | **Audit** — πότε λήφθηκε/χρησιμοποιήθηκε |

Για προσωπική οικονομική εφαρμογή, το DATE αρκεί για τον υπολογισμό. Το TIMESTAMPTZ
είναι μόνο για διαφάνεια/audit.

---

## 5. Πραγματική Ισοτιμία Κάρτας vs Ισοτιμία Αναφοράς

### 5.1 Το πρόβλημα

Η εφαρμογή υπολογίζει 50 USD = 42.70 EUR, αλλά η τράπεζα χρεώνει 43.20 EUR (λόγω
Visa/Mastercard rate + προμήθειας). Πώς το χειριζόμαστε;

### 5.2 Ανάλυση

Υπάρχουν **δύο διαφορετικές αξίες**:
1. **Ισοτιμία αναφοράς** (ECB/API) — αυτή που χρησιμοποιεί η εφαρμογή για συνέπεια.
2. **Πραγματική χρέωση** (τι χρέωσε η τράπεζα) — αυτό που πραγματικά πλήρωσε ο χρήστης.

### 5.3 Απόφαση: Δυνατότητα διόρθωσης με διατήρηση της αρχικής ισοτιμίας

Προσθέτουμε δυνατότητα **manual adjustment** που **δεν σβήνει** την αρχική ισοτιμία,
αλλά την **υπερκαλύπτει** με την πραγματική:

```sql
-- Στο transactions
rate_to_base        NUMERIC(18,8),   -- ισοτιμία αναφοράς (αρχική, source of truth)
rate_to_base_actual NUMERIC(18,8),   -- πραγματική ισοτιμία (αν ο χρήστης τη διόρθωσε)
amount_base         NUMERIC(18,4),   -- = amount / COALESCE(rate_to_base_actual, rate_to_base)
rate_source         TEXT,            -- 'api' | 'cached' | 'manual'
```

**Λογική:**
- Κατά τη δημιουργία: `rate_to_base_actual = NULL`, `amount_base = amount / rate_to_base`.
- Αν ο χρήστης διορθώσει (π.χ. βάλει 43.20 EUR): ορίζει `rate_to_base_actual` ώστε
  `amount / rate_to_base_actual = 43.20`, και το `amount_base` ξαναϋπολογίζεται.
- Η **αρχική** `rate_to_base` διατηρείται πάντα (για ιστορικό/audit).

### 5.4 UX

- Στη λεπτομέρεια συναλλαγής, ο χρήστης βλέπει: "Ισοτιμία αναφοράς: 1.17 · Πραγματική
  χρέωση: 43.20 EUR". Μπορεί να πατήσει "Διόρθωση" και να εισάγει το πραγματικό ποσό
  που χρέωσε η τράπεζα.
- Μετά τη διόρθωση, η κατάσταση γίνεται `'manual'` και εμφανίζεται ως "Διορθωμένη
  χειροκίνητα".

### 5.5 Γιατί αυτό είναι σωστό

- **Ακρίβεια:** Το ιστορικό αντικατοπτρίζει τι πραγματικά πληρώθηκε.
- **Διαφάνεια:** Η αρχική ισοτιμία δεν χάνεται — ο χρήστης βλέπει και τις δύο.
- **Συνέπεια:** Το `amount_base` προκύπτει πάντα από `amount / COALESCE(rate_to_base_actual, rate_to_base)`, οπότε παραμένει αναπαραγώγιμο.

---

## 6. Αλλαγή Βασικού Νομίσματος στο Μέλλον

### 6.1 Το πρόβλημα

Σήμερα user currency EUR. Μετά από χρόνια, user currency USD. Τι γίνεται με παλιές
συναλλαγές, budgets, reports, recurring templates;

### 6.2 Η βασική διάκριση: `base_currency` (σταθερό) vs `display_currency` (μεταβλητό)

Η λύση που προτείνω στο §2 λύνει το πρόβλημα **ριζικά**:

- **`base_currency`** (αγκυροβόλιο αποθήκευσης) είναι **σταθερό** — συνήθως το πρώτο
  νόμισμα του χρήστη. **Δεν αλλάζει ποτέ** (ή αλλάζει μόνο με ρητή, σπάνια διαδικασία).
- **`display_currency`** είναι αυτό που ο χρήστης αλλάζει όταν μετακομίζει. Είναι
  καθαρά θέμα εμφάνισης.

### 6.3 Τι συμβαίνει όταν ο χρήστης αλλάζει `display_currency` σε USD

- **Παλιές συναλλαγές:** **Δεν αλλάζουν καθόλου.** Το `amount_base` τους παραμένει σε
  EUR (το σταθερό `base_currency`). Για εμφάνιση σε USD, μετατρέπονται on-the-fly με
  την ιστορική ισοτιμία της ημερομηνίας τους.
- **Budgets:** Τα όρια ορίζονται σε ένα νόμισμα. Όταν αλλάζει το `display_currency`,
  τα budgets **παραμένουν στο νόμισμα που ορίστηκαν** (ή ο χρήστης τα ξαναορίζει).
  Η σύγκριση γίνεται μετατρέποντας τα έξοδα στο νόμισμα του budget.
- **Reports:** Τα ιστορικά reports εμφανίζονται στο `display_currency` (μετατροπή
  on-the-fly). Τα αθροίσματα γίνονται στο `base_currency` και μετά μετατρέπονται.
- **Recurring templates:** Κάθε template έχει το δικό του `currency`. Όταν δημιουργεί
  συναλλαγή, χρησιμοποιεί την ισοτιμία της ημερομηνίας δημιουργίας. Δεν επηρεάζεται
  από την αλλαγή `display_currency`.

### 6.4 Αν ο χρήστης θέλει να αλλάξει και το `base_currency`

Αυτό είναι **σπάνιο** και πρέπει να είναι **ρητή, προσεκτική διαδικασία**:

1. **Προειδοποίηση:** Εξηγείται ότι θα επανυπολογιστούν όλα τα `amount_base`.
2. **Επανυπολογισμός:** Για κάθε συναλλαγή, `amount_base_new = amount / rate_to_base_new`
   όπου `rate_to_base_new` είναι η ισοτιμία `currency → νέο base` της ημερομηνίας της
   συναλλαγής. (Το `amount` και το `currency` παραμένουν άθικτα.)
3. **Αναστρεψιμότητα:** Επειδή η πηγή αλήθειας (`amount`, `currency`, `rate_to_base`)
   παραμένει, μπορούμε πάντα να επανυπολογίσουμε προς τα πίσω. Κρατάμε ένα
   `base_currency_history` για audit.

### 6.5 Σύνοψη

| Αλλαγή | Παλιές συναλλαγές | Budgets | Reports | Recurring |
|---|---|---|---|---|
| Αλλαγή `display_currency` | Δεν αλλάζουν (on-the-fly μετατροπή) | Παραμένουν στο νόμισμά τους | Εμφανίζονται στο νέο display | Δεν επηρεάζονται |
| Αλλαγή `base_currency` (σπάνια) | Επανυπολογισμός `amount_base` | Επανυπολογισμός | Επανυπολογισμός | Επανυπολογισμός |

---

## 7. Offline Λειτουργία — UX

### 7.1 Το πρόβλημα

Ο χρήστης ταξιδεύει, δεν έχει Internet, και δημιουργεί συναλλαγή σε ξένο νόμισμα.
Ποια είναι η καλύτερη UX;

### 7.2 Απόφαση: "Χρησιμοποιήθηκε τελευταία διαθέσιμη ισοτιμία" + προαιρετική διόρθωση

Η σωστή προσέγγιση είναι **να μην μπλοκάρουμε τον χρήστη**. Προτείνω:

1. **Προεπιλογή:** Χρησιμοποιείται η **τελευταία γνωστή ισοτιμία** από το cache,
   με `rate_source='cached'` και `conversion_status='estimate'`.
2. **Ενημέρωση:** Ο χρήστης βλέπει καθαρά ότι η μετατροπή είναι **εκτίμηση**:
   "⚠️ Εκτίμηση — χρησιμοποιήθηκε η τελευταία γνωστή ισοτιμία (1.17, από 02/08/2026)".
3. **Επιλογή:** Ο χρήστης μπορεί να:
   - αποδεχθεί την εκτίμηση (η συναλλαγή αποθηκεύεται ως `estimate`), ή
   - **εισάγει χειροκίνητα** την ισοτιμία (π.χ. από την τράπεζά του), οπότε γίνεται
     `manual`.
4. **Μεταγενέστερη διόρθωση:** Όταν επανέλθει η σύνδεση, ο χρήστης μπορεί να
   διορθώσει τις `estimate` συναλλαγές με την πραγματική ισοτιμία (βλ. §5).

### 7.3 Γιατί αυτή είναι η σωστή επιλογή

- **Δεν μπλοκάρει τη ροή:** Ο χρήστης μπορεί να καταγράψει τη συναλλαγή τη στιγμή που
  τη θυμάται, ακόμα και offline.
- **Διαφάνεια:** Η εκτίμηση είναι σαφώς σημασμένη, οπότε ο χρήστης δεν παραπλανάται.
- **Ευελιξία:** Ο χρήστης έχει τον έλεγχο (χειροκίνητη εισαγωγή ή μεταγενέστερη
  διόρθωση).

### 7.4 Σύνοψη ροής

```
Offline συναλλαγή σε ξένο νόμισμα
        │
        ▼
Υπάρχει cached ισοτιμία;
   ├── ΝΑΙ → χρησιμοποίησέ την (estimate) + ενημέρωσε τον χρήστη
   └── ΟΧΙ → ζήτα χειροκίνητη εισαγωγή (δεν μπορεί να υπολογιστεί χωρίς ισοτιμία)
        │
        ▼
Αποθήκευσε με rate_source='cached' ή 'manual'
        │
        ▼
(Όταν επανέλθει σύνδεση) πρόσφερε διόρθωση με πραγματική ισοτιμία
```

---

## 8. Migration Υπαρχόντων Δεδομένων

### 8.1 Στόχοι

- Δεν σπάει παλιά δεδομένα.
- Δεν αλλάζει ποσά.
- Προσθέτει σταδιακά multi-currency δυνατότητα.
- Επιτρέπει rollback.

### 8.2 Στρατηγική: Προσθετικό migration με defaults (μη καταστροφικό)

Όλα τα νέα πεδία προστίθενται με **defaults** που διατηρούν την υπάρχουσα συμπεριφορά
(όλα σε EUR, ισοτιμία 1:1). Έτσι τα παλιά δεδομένα παραμένουν έγκυρα και τα ποσά
αμετάβλητα.

### 8.3 Βήματα migration

**Phase 0 — Προετοιμασία (rollback-safe):**
```sql
-- Δημιουργία πινάκων (δεν αγγίζει υπάρχοντα δεδομένα)
CREATE TABLE IF NOT EXISTS public.currencies (...);
CREATE TABLE IF NOT EXISTS public.exchange_rates (...);
CREATE TABLE IF NOT EXISTS public.budgets (...);

-- Πληθυσμός currencies (EUR, USD, GBP, JPY, ...)
INSERT INTO public.currencies (code, name, symbol, decimals) VALUES
  ('EUR', 'Euro', '€', 2), ('USD', 'US Dollar', '$', 2),
  ('GBP', 'British Pound', '£', 2), ('JPY', 'Japanese Yen', '¥', 0);
```

**Phase 1 — Προσθήκη πεδίων με defaults (rollback-safe):**
```sql
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS amount_base NUMERIC(18,4),
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS rate_source TEXT NOT NULL DEFAULT 'api',
    ADD COLUMN IF NOT EXISTS rate_to_base_actual NUMERIC(18,8),
    ADD COLUMN IF NOT EXISTS rate_fetched_at TIMESTAMPTZ;

ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';
```

**Phase 2 — Backfill (rollback-safe, idempotent):**
```sql
-- Όλες οι υπάρχουσες συναλλαγές είναι EUR με ισοτιμία 1:1
UPDATE public.transactions
SET amount_base = amount,        -- 50 EUR → 50 EUR
    rate_to_base = 1,
    base_currency = 'EUR',
    currency = 'EUR'
WHERE amount_base IS NULL;
```

**Phase 3 — Σταδιακή ενεργοποίηση (feature flag):**
- Προσθήκη `CurrencyService` και αντικατάσταση των `parseFloat(t.amount)` με
  `CurrencyService.toBase(t)` στα σημεία υπολογισμού.
- Ενεργοποίηση της επιλογής νομίσματος στη φόρμα συναλλαγής πίσω από feature flag.
- Δεν αλλάζει τίποτα ορατό μέχρι να ενεργοποιηθεί το flag.

### 8.4 Rollback

- **Phase 0-2:** Πλήρως αναστρέψιμα — τα νέα πεδία με defaults δεν επηρεάζουν την
  υπάρχουσα λογική. Αν κάτι πάει στραβά, απλώς δεν χρησιμοποιούμε τα νέα πεδία.
- **Phase 3:** Το feature flag επιτρέπει άμεση απενεργοποίηση. Αν υπάρξει πρόβλημα,
  γυρίζουμε το flag σε off και η εφαρμογή συμπεριφέρεται όπως πριν.
- **Πλήρης rollback:** Αν χρειαστεί, `DROP COLUMN` τα νέα πεδία (τα παλιά `amount`,
  `type`, κ.λπ. παραμένουν άθικτα).

### 8.5 Επαλήθευση

- Μετά το backfill, τα υπάρχοντα στατιστικά/υπόλοιπα πρέπει να είναι **πανομοιότυπα**
  (αφού όλες οι παλιές συναλλαγές έχουν `currency='EUR'`, `rate_to_base=1`,
  `amount_base=amount`).
- Ένα test script συγκρίνει τα αθροίσματα πριν/μετά.

---

## 9. Τελικό Database Schema

```sql
-- ==========================================
-- 1. CURRENCIES (κατάλογος νομισμάτων)
-- ==========================================
CREATE TABLE public.currencies (
    code        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    decimals    SMALLINT NOT NULL DEFAULT 2,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. EXCHANGE_RATES (ιστορικό ισοτιμιών)
-- ==========================================
CREATE TABLE public.exchange_rates (
    id            BIGSERIAL PRIMARY KEY,
    base_currency TEXT NOT NULL REFERENCES public.currencies(code),
    quote_currency TEXT NOT NULL REFERENCES public.currencies(code),
    rate          NUMERIC(18,8) NOT NULL,   -- 1 base = rate quote
    rate_date     DATE NOT NULL,            -- ημερομηνία ισχύος (χρησιμοποιείται στον υπολογισμό)
    source        TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api','cached','manual')),
    fetched_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (base_currency, quote_currency, rate_date)
);

CREATE INDEX idx_exchange_rates_lookup
    ON public.exchange_rates (base_currency, quote_currency, rate_date DESC);

-- ==========================================
-- 3. TRANSACTIONS (τροποποίηση)
-- ==========================================
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS rate_to_base NUMERIC(18,8) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS amount_base NUMERIC(18,4),
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS rate_source TEXT NOT NULL DEFAULT 'api'
        CHECK (rate_source IN ('api','cached','manual')),
    ADD COLUMN IF NOT EXISTS rate_to_base_actual NUMERIC(18,8),
    ADD COLUMN IF NOT EXISTS rate_fetched_at TIMESTAMPTZ;

-- ==========================================
-- 4. ACCOUNTS (τροποποίηση)
-- ==========================================
ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code);

-- ==========================================
-- 5. PROFILES (τροποποίηση)
-- ==========================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code),
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code);

-- ==========================================
-- 6. RECURRING_TEMPLATES (τροποποίηση)
-- ==========================================
ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code);

-- ==========================================
-- 7. BUDGETS (νέος πίνακας)
-- ==========================================
CREATE TABLE public.budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id    UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    category     TEXT NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    limit_amount NUMERIC(12,2) NOT NULL,
    period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','yearly')),
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, category, period)
);
```

---

## 10. CurrencyService — Πλήρης Σχεδιασμός

```js
const CurrencyService = {
  // ===== Μετατροπή =====

  // Μετατρέπει ποσό από ένα νόμισμα σε άλλο με ιστορική ισοτιμία της ημερομηνίας.
  convert(amount, fromCurrency, toCurrency, date) {
    if (fromCurrency === toCurrency) return amount;
    const rate = this.getRate(fromCurrency, toCurrency, date);
    return round(amount * rate, 4);
  },

  // Υπολογίζει το amount_base μιας νέας συναλλαγής.
  // Πάντα: amount_base = amount / COALESCE(rate_to_base_actual, rate_to_base)
  computeAmountBase(amount, currency, baseCurrency, date, rateToBaseActual = null) {
    const rate = rateToBaseActual ?? this.getRate(currency, baseCurrency, date);
    return round(amount / rate, 4);
  },

  // ===== Source of truth =====

  // Επιστρέφει το ποσό μιας συναλλαγής στο base_currency (χρησιμοποιεί amount_base cache).
  toBase(tx) {
    return tx.amount_base ?? this.computeAmountBase(tx.amount, tx.currency, tx.base_currency, tx.date);
  },

  // Επιστρέφει το ποσό μιας συναλλαγής σε οποιοδήποτε νόμισμα (για εμφάνιση).
  displayAmount(tx, targetCurrency) {
    if (targetCurrency === tx.currency) return tx.amount;      // πραγματικό ποσό
    if (targetCurrency === tx.base_currency) return this.toBase(tx); // ισοδύναμο στο base
    // αλλιώς: base → target με ιστορική ισοτιμία
    return this.convert(this.toBase(tx), tx.base_currency, targetCurrency, tx.date);
  },

  // ===== Ισοτιμίες =====

  // Φέρνει την ισοτιμία της ημέρας από το API (Frankfurter) και την αποθηκεύει.
  async fetchTodayRates(baseCurrency) {
    // 1. Έλεγξε cache: υπάρχει για σήμερα; → return
    // 2. Κάλεσε https://api.frankfurter.app/latest?from={base}
    // 3. Αποθήκευσε στον exchange_rates + στο τοπικό cache
  },

  // Επιστρέφει την ισοτιμία base→quote για μια ημερομηνία, με ιεραρχία:
  //  1) exchange_rates (ακριβής ημερομηνία) → 2) χειροκίνητη → 3) πλησιέστερη προηγούμενη
  getRate(base, quote, date) {
    // 1. Ακριβής ημερομηνία στον exchange_rates
    // 2. Αν όχι, χειροκίνητη (source='manual')
    // 3. Αν όχι, πλησιέστερη προηγούμενη (source='cached')
  },

  // Ο χρήστης ορίζει χειροκίνητα ισοτιμία (source='manual', δεν αντικαθίσταται).
  setManualRate(base, quote, date, rate) { ... },

  // ===== Διόρθωση πραγματικής χρέωσης =====

  // Ο χρήστης διορθώνει το πραγματικό ποσό που χρέωσε η τράπεζα.
  correctActualAmount(tx, actualAmountInBase) {
    tx.rate_to_base_actual = round(tx.amount / actualAmountInBase, 8);
    tx.amount_base = this.computeAmountBase(tx.amount, tx.currency, tx.base_currency, tx.date, tx.rate_to_base_actual);
    tx.rate_source = 'manual';
  },
};
```

**Κανόνες:**
- Το `amount_base` υπολογίζεται **μόνο** μέσα από το `CurrencyService` — ποτέ απευθείας.
- Το `toBase(tx)` χρησιμοποιεί το cache `amount_base` για ταχύτητα, αλλά μπορεί να το
  ξαναϋπολογίσει αν λείπει.
- Όλα τα σημεία του κώδικα που σήμερα κάνουν `parseFloat(t.amount)` για στατιστικά
  αντικαθίστανται με `CurrencyService.toBase(t)`.

---

## 11. Accounts, Wallets και User Preferences

### 11.1 Μοντέλο

- **Account** = λογαριασμός/πορτοφόλι με δικό του `currency` (π.χ. PayPal USD).
- **User preferences** = `base_currency` (σταθερό αγκυροβόλιο) + `display_currency`
  (μεταβλητό, για εμφάνιση).
- **Family** = μπορεί να έχει δικό του `display_currency` (όλοι βλέπουν το ίδιο
  νόμισμα στα κοινά στατιστικά), αλλά κάθε μέλος διατηρεί το δικό του `base_currency`.

### 11.2 Υπολογισμός Net Worth (πολλαπλοί λογαριασμοί)

```
Net worth (σε display_currency) =
  Σ (account.balance σε account.currency → μετατροπή σε display_currency με τρέχουσα ισοτιμία)
```

- Κάθε `account.balance` είναι στο `account.currency` του.
- Για το net worth, μετατρέπουμε κάθε υπόλοιπο στο `display_currency` με **τρέχουσα**
  ισοτιμία (γιατί είναι "τι αξίζει τώρα").
- Εναλλακτικά, μπορούμε να δείξουμε κάθε λογαριασμό στο νόμισμά του και το σύνολο στο
  `display_currency`.

### 11.3 Μελλοντικά wallets

Το μοντέλο `account.currency` υποστηρίζει ήδη wallets. Ένα wallet είναι απλώς ένα
account με συγκεκριμένο `type` (π.χ. `'wallet'`) και δικό του `currency`. Δεν χρειάζεται
αλλαγή στη δομή.

---

## 12. Πλάνο Υλοποίησης σε Ασφαλή Phases

| Phase | Περιεχόμενο | Κίνδυνος | Rollback |
|---|---|---|---|
| **0** | Δημιουργία πινάκων `currencies`, `exchange_rates`, `budgets` + seed | Χαμηλός | Πλήρης |
| **1** | Προσθήκη πεδίων με defaults σε transactions/accounts/profiles/recurring | Χαμηλός | Πλήρης (DROP COLUMN) |
| **2** | Backfill `amount_base` (EUR, 1:1) | Χαμηλός | Πλήρης (idempotent) |
| **3** | Δημιουργία `CurrencyService` + αντικατάσταση `parseFloat(t.amount)` | Μέτριος | Feature flag |
| **4** | Επιλογή νομίσματος στη φόρμα συναλλαγής (feature flag) | Μέτριος | Feature flag |
| **5** | Λήψη ισοτιμιών (Frankfurter) + εμφάνιση διπλού ποσού | Μέτριος | Feature flag |
| **6** | Διόρθωση πραγματικής χρέωσης + κατάσταση αξιοπιστίας | Χαμηλός | Feature flag |
| **7** | Αλλαγή `display_currency` + net worth πολλαπλών λογαριασμών | Μέτριος | Feature flag |

Κάθε phase είναι ανεξάρτητα αναστρέψιμο και δεν επηρεάζει τα υπάρχοντα δεδομένα.

---

## 13. Edge Cases που δεν είχαμε σκεφτεί

1. **Στρογγυλοποίηση σε πολλαπλά βήματα:** Αν αθροίσουμε πολλά `amount_base` που το
   καθένα στρογγυλοποιήθηκε, το άθροισμα μπορεί να έχει μικρή απόκλιση. Λύση: κρατάμε
   το `rate_to_base` με 8 δεκαδικά και στρογγυλοποιούμε ΜΟΝΟ στο τελικό `amount_base`.

2. **Ισοτιμία Σαββατοκύριακου/αργίας:** Το Frankfurter δεν δίνει ισοτιμία για μη
   εργάσιμες. Λύση: χρησιμοποιούμε την τελευταία εργάσιμη (fallback), με
   `rate_source='cached'`.

3. **Συναλλαγή με ημερομηνία στο μέλλον:** Αν ο χρήστης εισάγει μελλοντική ημερομηνία,
   δεν υπάρχει ισοτιμία. Λύση: χρησιμοποιούμε την τελευταία γνωστή και σημαδεύουμε ως
   `estimate`, με δυνατότητα διόρθωσης όταν περάσει η ημερομηνία.

4. **Transfer μεταξύ λογαριασμών διαφορετικών νομισμάτων:** Π.χ. μεταφορά από EUR σε
   USD λογαριασμό. Το ποσό στο `account_from` είναι σε EUR, στο `account_to` σε USD.
   Πρέπει να αποθηκεύσουμε και τα δύο ποσά (ή την ισοτιμία μεταφοράς) για να μην
   "χαθεί" χρήμα στον υπολογισμό του net worth.

5. **Διαγραφή/αλλαγή ισοτιμίας:** Οι ισοτιμίες είναι append-only. Αν μια λάθος
   ισοτιμία αποθηκεύτηκε, δεν τη διαγράφουμε — προσθέτουμε διόρθωση για την ίδια
   ημερομηνία με `source='manual'` (υψηλότερη προτεραιότητα).

6. **Πολύ παλιές συναλλαγές χωρίς ισοτιμία:** Αν μια συναλλαγή είναι πριν από το
   εύρος του API, χρησιμοποιούμε την παλαιότερη διαθέσιμη ισοτιμία και σημαδεύουμε ως
   `estimate`.

7. **Αλλαγή `display_currency` σε πραγματικό χρόνο:** Όταν ο χρήστης αλλάζει
   `display_currency`, όλα τα αθροίσματα πρέπει να ξαναϋπολογιστούν on-the-fly. Αυτό
   μπορεί να είναι ακριβό για μεγάλα datasets — γι' αυτό κρατάμε τα αθροίσματα στο
   `base_currency` και μετατρέπουμε μόνο το τελικό σύνολο.

8. **Συνεργασία (family):** Δύο μέλη μπορεί να έχουν διαφορετικά `base_currency`.
   Τα κοινά στατιστικά πρέπει να συμφωνούν σε ένα νόμισμα (το `display_currency` του
   family). Κάθε συναλλαγή έχει το δικό της `base_currency`, οπότε η μετατροπή γίνεται
   on-the-fly.

9. **Ακρίβεια δεκαδικών ανά νόμισμα:** Το JPY έχει 0 δεκαδικά, το EUR 2. Η
   στρογγυλοποίηση πρέπει να σέβεται το `decimals` του νομίσματος (από τον πίνακα
   `currencies`).

10. **Αρνητικά ποσά / επιστροφές (refunds):** Μια επιστροφή σε ξένο νόμισμα πρέπει να
    χρησιμοποιεί την ισοτιμία της ημερομηνίας της επιστροφής, όχι της αρχικής αγοράς.

---

## 14. Συμπέρασμα

Το δεύτερο review επιβεβαιώνει τη βασική αρχή και την ενισχύει με σαφήνεια:

1. **Source of truth:** `amount`, `currency`, `rate_to_base`, `base_currency`.
   **Cache:** `amount_base` (ανακατασκευάσιμο, πάντα `amount / rate`).
2. **Τρεις έννοιες νομίσματος:** `account.currency`, `user.base_currency` (σταθερό),
   `user.display_currency` (μεταβλητό). Αυτό λύνει ριζικά το πρόβλημα αλλαγής βασικού
   νομίσματος χωρίς καταστροφή ιστορικών δεδομένων.
3. **Αξιοπιστία:** `rate_source` ('api'/'cached'/'manual') + παράγωγο
   `conversion_status` ('confirmed'/'estimate'/'manual') για διαφάνεια.
4. **Χρόνος:** `rate_date` (DATE) για υπολογισμό, `fetched_at` (TIMESTAMPTZ) για audit.
5. **Πραγματική χρέωση:** `rate_to_base_actual` επιτρέπει διόρθωση χωρίς να χαθεί η
   αρχική ισοτιμία.
6. **Offline:** Δεν μπλοκάρουμε τον χρήστη — χρησιμοποιούμε τελευταία γνωστή ισοτιμία
   (estimate) με δυνατότητα χειροκίνητης εισαγωγής και μεταγενέστερης διόρθωσης.
7. **Migration:** Προσθετικό, rollback-safe, με feature flags και επαλήθευση ότι τα
   ποσά δεν αλλάζουν.

Αυτή η αρχιτεκτονική υποστηρίζει μελλοντικά **οποιοδήποτε νόμισμα, πολλαπλούς
λογαριασμούς/πορτοφόλια, οικογενειακή συνεργασία, επενδύσεις και πιο σύνθετα
οικονομικά σενάρια** χωρίς νέο redesign.