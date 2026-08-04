# Family Multi-Currency — Τελικό Review

**Σκοπός:** Να επιβεβαιώσουμε ότι το multi-currency design υποστηρίζει οικογένεια όπου
κάθε μέλος μπορεί να έχει **διαφορετικό** `base_currency`, `display_currency` και
accounts σε διαφορετικά νομίσματα — χωρίς τον περιορισμό "ένα νόμισμα ανά οικογένεια".

**Κατάσταση:** DESIGN REVIEW #3 — εστιασμένο αποκλειστικά στο family multi-currency.

**Βασική αρχή (επιβεβαιωμένη):**
- Κάθε μέλος έχει το δικό του `base_currency` (σταθερό αγκυροβόλιο αποθήκευσης).
- Κάθε μέλος έχει το δικό του `display_currency` (μεταβλητό, για προσωπική εμφάνιση).
- Η οικογένεια έχει **ένα** `display_currency` (reporting currency) για τα **κοινά**
  στατιστικά — αλλά αυτό **δεν** επιβάλλει ενιαίο νόμισμα αποθήκευσης.
- Κάθε account έχει το δικό του `currency` (ανεξάρτητα από μέλος ή οικογένεια).
- Δεν υπάρχει κανένα σημείο που να απαιτεί "ένα νόμισμα ανά οικογένεια".

---

## 1. Επιβεβαίωση: Το design ΔΕΝ έχει περιορισμό "ένα νόμισμα ανά οικογένεια"

### 1.1 Γιατί είναι εγγενώς υποστηριζόμενο

Το μοντέλο αποθηκεύει σε **κάθε συναλλαγή** τα 4 πεδία source of truth:
`amount`, `currency`, `rate_to_base`, `base_currency`. Το `base_currency` είναι
**ανά συναλλαγή**, όχι ανά οικογένεια. Άρα:

- Ο σύζυγος (EUR) δημιουργεί συναλλαγές με `base_currency='EUR'`.
- Η σύζυγος (USD) δημιουργεί συναλλαγές με `base_currency='USD'`.
- Και οι δύο μπορούν να ανήκουν στην ίδια `family_groups` χωρίς καμία σύγκρουση.

Το `family_id` είναι **ανεξάρτητο** από το νόμισμα. Είναι απλώς ένας δείκτης
συμμετοχής σε κοινό χώρο δεδομένων (RLS), όχι ένας ορισμός νομίσματος.

### 1.2 Πού θα μπορούσε να εισαχθεί κατά λάθος ο περιορισμός (και πώς τον αποφεύγουμε)

| Λάθος σχεδιασμός | Γιατί είναι λάθος | Σωστό |
|---|---|---|
| `family_groups.base_currency` ως μοναδικό νόμισμα | Επιβάλλει ενιαίο νόμισμα σε όλα τα μέλη | Κάθε μέλος έχει το δικό του `profiles.base_currency` |
| `transactions.base_currency` να κληρονομείται από το family | Σπάει τα ιστορικά δεδομένα μελών | `base_currency` ανά συναλλαγή (source of truth) |
| `UNIQUE (family_id, currency)` σε budgets | Επιτρέπει μόνο ένα budget ανά κατηγορία/νόμισμα | Δείτε §3 |

**Κανόνας:** Το νόμισμα **ποτέ** δεν ορίζεται σε επίπεδο οικογένειας για αποθήκευση.
Ορίζεται μόνο σε επίπεδο: συναλλαγής (`currency`, `base_currency`), account
(`accounts.currency`), και χρήστη (`profiles.base_currency`, `profiles.display_currency`).

---

## 2. Σενάριο: Σύζυγος EUR και σύζυγος USD

### 2.1 Κατάσταση

- **Σύζυγος Α:** `base_currency='EUR'`, `display_currency='EUR'`, λογαριασμός "Τράπεζα" EUR.
- **Σύζυγος Β:** `base_currency='USD'`, `display_currency='USD'`, λογαριασμός "PayPal" USD.
- **Και οι δύο:** `family_id = <ίδια οικογένεια>`.

### 2.2 Πώς λειτουργεί

- Η συναλλαγή της Α αποθηκεύεται με `base_currency='EUR'`, `amount_base` σε EUR.
- Η συναλλαγή της Β αποθηκεύεται με `base_currency='USD'`, `amount_base` σε USD.
- **Προσωπικά στατιστικά:** Η Α βλέπει τα δικά της σε EUR (άθροισμα `amount_base` σε
  EUR). Η Β βλέπει τα δικά της σε USD.
- **Κοινά στατιστικά:** Μετατρέπουμε κάθε συναλλαγή στο `family.display_currency`
  (π.χ. EUR) on-the-fly με την ιστορική ισοτιμία της ημερομηνίας της.

### 2.3 Κρίσιμο σημείο: Δεν αθροίζουμε `amount_base` μεταξύ διαφορετικών base_currency

**Απαγόρευση:** Δεν μπορούμε να κάνουμε `SUM(amount_base)` σε όλες τις συναλλαγές της
οικογένειας, γιατί το `amount_base` είναι σε διαφορετικά νομίσματα (EUR και USD).

**Σωστός τρόπος:** Για κοινά στατιστικά, μετατρέπουμε **κάθε** συναλλαγή ξεχωριστά
στο `family.display_currency` με την ιστορική ισοτιμία της, και **μετά** αθροίζουμε:

```
Family expense (σε EUR) =
  Σ [ convert(tx.amount_base, tx.base_currency, family.display_currency, tx.date) ]
```

Αυτό είναι σημαντικό γιατί διαφορετικά θα αθροίζαμε "μήλα με πορτοκάλια".

### 2.4 Σύνοψη

| Μέλος | base_currency | display_currency | Προσωπικά στατιστικά | Κοινά στατιστικά |
|---|---|---|---|---|
| Σύζυγος Α | EUR | EUR | EUR | EUR (family display) |
| Σύζυγος Β | USD | USD | USD | EUR (family display) |

---

## 3. Κοινά Budgets (Shared Family Budgets)

### 3.1 Το πρόβλημα στο τρέχον schema

Ο πίνακας `budgets` έχει:

```sql
UNIQUE (user_id, category, period)
```

Αυτό έχει **δύο προβλήματα** για οικογενειακή χρήση:

1. **Δεν επιτρέπει κοινό budget:** Ένα οικογενειακό budget έχει `family_id` ορισμένο
   αλλά `user_id` = ο δημιουργός. Αν ο άλλος σύζυγος θέλει να δει/επεξεργαστεί το ίδιο
   budget, το `UNIQUE (user_id, ...)` δεν το εμποδίζει άμεσα (γιατί το budget ανήκει
   στον δημιουργό), αλλά δεν υπάρχει **σαφής έννοια** "αυτό το budget είναι της
   οικογένειας, όχι ενός μέλους".
2. **Δεν επιτρέπει πολλαπλά budgets ίδιας κατηγορίας σε διαφορετικά νομίσματα:**
   Αν η οικογένεια θέλει "Φαγητό" σε EUR (κοινό) και "Φαγητό" σε USD (προσωπικό),
   το `UNIQUE (user_id, category, period)` το αποτρέπει.

### 3.2 Απόφαση: Διάκριση scope (προσωπικό vs οικογενειακό) + νόμισμα στο UNIQUE

Αλλάζουμε το μοντέλο ώστε ένα budget να έχει **scope** και το `UNIQUE` να λαμβάνει
υπόψη το νόμισμα:

```sql
CREATE TABLE public.budgets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- δημιουργός
    family_id    UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    scope        TEXT NOT NULL DEFAULT 'personal'
                 CHECK (scope IN ('personal', 'family')),
    category     TEXT NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'EUR' REFERENCES public.currencies(code),
    limit_amount NUMERIC(12,2) NOT NULL,
    period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','yearly')),
    created_at   TIMESTAMPTZ DEFAULT now(),
    -- Προσωπικό budget: μοναδικό ανά (user, category, period, currency)
    -- Οικογενειακό budget: μοναδικό ανά (family, category, period, currency)
    UNIQUE (user_id, scope, category, period, currency)
);
```

**Σημείωση:** Για οικογενειακό budget (`scope='family'`), όλα τα μέλη μοιράζονται το
ίδιο `user_id` (του δημιουργού) αλλά το `family_id` είναι ορισμένο. Το `UNIQUE`
χρησιμοποιεί το `user_id` του δημιουργού, οπότε δεν υπάρχει διπλοτύπία. Εναλλακτικά,
μπορούμε να χρησιμοποιήσουμε ένα partial unique index:

```sql
-- Προσωπικά: μοναδικά ανά χρήστη
CREATE UNIQUE INDEX budgets_personal_uniq
    ON public.budgets (user_id, category, period, currency)
    WHERE scope = 'personal';

-- Οικογενειακά: μοναδικά ανά οικογένεια
CREATE UNIQUE INDEX budgets_family_uniq
    ON public.budgets (family_id, category, period, currency)
    WHERE scope = 'family';
```

### 3.3 Πώς υπολογίζεται η χρήση ενός κοινού budget

- Το budget έχει `currency` (π.χ. EUR) και `limit_amount` σε EUR.
- Συλλέγουμε **όλες** τις οικογενειακές συναλλαγές της κατηγορίας.
- Μετατρέπουμε κάθε συναλλαγή στο `currency` του budget (EUR) με ιστορική ισοτιμία.
- Αθροίζουμε και συγκρίνουμε με το `limit_amount`.

```
Budget "Φαγητό" (EUR, όριο 500):
  Σ [ convert(tx.amount_base, tx.base_currency, 'EUR', tx.date) ]  για κατηγορία=Φαγητό
```

### 3.4 Σύνοψη

| Σενάριο | Παλιό schema | Νέο schema |
|---|---|---|
| Κοινό budget οικογένειας | Δεν ορίζεται σαφώς | `scope='family'` + `family_id` |
| Προσωπικό budget μέλους | `user_id` + `family_id=NULL` | `scope='personal'` |
| Ίδια κατηγορία σε 2 νομίσματα | Αποκλείεται | Επιτρέπεται (currency στο UNIQUE) |

---

## 4. Family Reports

### 4.1 Reporting currency της οικογένειας

**Απόφαση:** Η οικογένεια έχει **ένα** `display_currency` (reporting currency) που
ορίζεται στο `family_groups`:

```sql
ALTER TABLE public.family_groups
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code);
```

Αυτό είναι το νόμισμα στο οποίο εμφανίζονται τα **κοινά** reports (σύνολα εξόδων,
εσόδων, ανά κατηγορία, ανά μήνα). Είναι **καθαρά εμφάνισης** — δεν επηρεάζει την
αποθήκευση.

### 4.2 Πώς υπολογίζονται τα family reports

1. Επιλέγουμε όλες τις συναλλαγές της οικογένειας (`family_id = X`).
2. Για κάθε συναλλαγή, μετατρέπουμε στο `family.display_currency` με ιστορική ισοτιμία
   της ημερομηνίας της.
3. Αθροίζουμε ανά κατηγορία/μήνα.

**Σημαντικό:** Κάθε μέλος μπορεί να δει το **ίδιο** family report στο **δικό του**
`display_currency` (π.χ. η Β σε USD, ο Α σε EUR) — απλώς αλλάζουμε το target currency
της μετατροπής. Το `family.display_currency` είναι απλώς η **προεπιλογή**.

### 4.3 Σύνοψη

| Ποιος βλέπει | Νόμισμα reports |
|---|---|
| Οποιοδήποτε μέλος (προεπιλογή) | `family.display_currency` |
| Μέλος που αλλάζει προτίμηση | Το δικό του `profiles.display_currency` |

---

## 5. Transfer μεταξύ Μελών Διαφορετικού Νομίσματος

### 5.1 Το πρόβλημα

Ο σύζυγος Α (EUR) στέλνει 100 EUR στον σύζυγο Β (USD). Πώς το μοντελοποιούμε ώστε να
μην "χαθεί" ή "διπλασιαστεί" χρήμα στο net worth;

### 5.2 Ανάλυση

Ένα transfer έχει **δύο πλευρές**:
- **Από πλευρά Α:** -100 EUR (έξοδο από τον λογαριασμό EUR της Α).
- **Προς πλευρά Β:** +X USD (είσοδος στον λογαριασμό USD της Β), όπου X = 100 × ισοτιμία.

Αν δεν καταγράψουμε και τα δύο ποσά **και** την ισοτιμία, το net worth θα είναι λάθος
(θα φαίνεται ότι "χάθηκε" ή "δημιουργήθηκε" χρήμα).

### 5.3 Απόφαση: Transfer με δύο σκέλη + ισοτιμία μεταφοράς

Μοντελοποιούμε το transfer ως **δύο συναλλαγές** (ένα έξοδο από τον αποστολέα, ένα
έσοδο στον παραλήπτη) συνδεδεμένες με ένα κοινό `transfer_id`, και αποθηκεύουμε την
ισοτιμία μεταφοράς:

```sql
-- Στο transactions, προσθέτουμε:
transfer_id UUID,          -- συνδέει τα δύο σκέλη του transfer
transfer_rate NUMERIC(18,8), -- ισοτιμία που χρησιμοποιήθηκε (1 EUR = X USD)
```

**Παράδειγμα:**
- Σκέλος 1 (Α): `amount=100`, `currency=EUR`, `type=transfer_out`, `transfer_id=T1`.
- Σκέλος 2 (Β): `amount=110`, `currency=USD`, `type=transfer_in`, `transfer_id=T1`,
  `transfer_rate=1.10`.

**Κανόνες ακεραιότητας:**
- Ένα transfer έχει πάντα **ακριβώς 2** σκέλη (ένα out, ένα in).
- `transfer_rate` είναι ίδιο και στα δύο σκέλη.
- Το `amount` του in σκέλους = `amount` του out σκέλους × `transfer_rate` (με
  στρογγυλοποίηση στο `decimals` του νομίσματος του παραλήπτη).

### 5.4 Πώς αποφεύγεται το λάθος στο net worth

- **Net worth (οικογένεια):** Αθροίζουμε τα υπόλοιπα των accounts. Το transfer
  **δεν** αλλάζει το συνολικό net worth (το χρήμα απλώς μετακινήθηκε), γιατί το
  transfer_out αφαιρεί από το ένα account και το transfer_in προσθέτει στο άλλο.
- **Αν τα δύο σκέλη έχουν διαφορετικό νόμισμα:** Το net worth υπολογίζεται σε ένα
  νόμισμα (family.display_currency), οπότε το transfer_out (EUR) και transfer_in (USD)
  μετατρέπονται και οι δύο στο ίδιο νόμισμα. Η διαφορά λόγω ισοτιμίας είναι
  **πραγματικό κέρδος/ζημία συναλλάγματος** και πρέπει να εμφανίζεται ξεχωριστά
  (βλ. §5.5).

### 5.5 Κέρδος/ζημία συναλλάγματος (FX gain/loss)

Όταν μεταφέρουμε 100 EUR → 110 USD, και μετά το USD πέσει, το net worth αλλάζει.
Αυτό είναι **πραγματικό** φαινόμενο. Προτείνουμε:

- Να μην το κρύβουμε.
- Να το εμφανίζουμε ως ξεχωριστή γραμμή "Κέρδος/Ζημία Συναλλάγματος" στα reports,
  ώστε ο χρήστης να καταλαβαίνει γιατί το net worth άλλαξε χωρίς νέα συναλλαγή.

### 5.6 Σύνοψη

| Στοιχείο | Τιμή |
|---|---|
| Σκέλος out | `amount=100`, `currency=EUR`, `type=transfer_out` |
| Σκέλος in | `amount=110`, `currency=USD`, `type=transfer_in` |
| Σύνδεση | `transfer_id=T1` (κοινό) |
| Ισοτιμία | `transfer_rate=1.10` (κοινό) |
| Net worth | Αμετάβλητο από το transfer (μόνο μετακίνηση) |
| FX gain/loss | Ξεχωριστή αναφορά |

---

## 6. Net Worth Οικογένειας

### 6.1 Ορισμός

Το **net worth της οικογένειας** είναι το άθροισμα των υπολοίπων **όλων** των
accounts όλων των μελών, εκφρασμένο σε ένα νόμισμα (το `family.display_currency`).

### 6.2 Υπολογισμός

```
Family net worth (σε family.display_currency) =
  Σ [ convert(account.balance, account.currency, family.display_currency, today) ]
```

- Κάθε `account.balance` είναι στο `account.currency` του.
- Μετατρέπουμε με **τρέχουσα** ισοτιμία (γιατί είναι "τι αξίζει τώρα", όχι ιστορικό).
- Αθροίζουμε όλα τα accounts όλων των μελών.

### 6.3 Γιατί δεν υπάρχει πρόβλημα με διαφορετικά base_currency

Το net worth **δεν** χρησιμοποιεί το `amount_base` των συναλλαγών. Χρησιμοποιεί το
`account.balance` (το τρέχον υπόλοιπο κάθε account) και το μετατρέπει με τρέχουσα
ισοτιμία. Άρα το γεγονός ότι ο Α έχει `base_currency=EUR` και ο Β `base_currency=USD`
**δεν επηρεάζει** τον υπολογισμό — κάθε account μετατρέπεται ανεξάρτητα.

### 6.4 Σύνοψη

| Στοιχείο | Πηγή | Νόμισμα |
|---|---|---|
| Υπόλοιπο account Α | `accounts.balance` | `accounts.currency` (EUR) |
| Υπόλοιπο account Β | `accounts.balance` | `accounts.currency` (USD) |
| Μετατροπή | Τρέχουσα ισοτιμία | `family.display_currency` |
| Άθροισμα | Όλα τα accounts | `family.display_currency` |

---

## 7. Απαραίτητες Προσθήκες στο Schema (για family multi-currency)

Συνοψίζοντας τις αλλαγές που χρειάζονται **επιπλέον** από το βασικό multi-currency
design, ειδικά για την οικογένεια:

```sql
-- 1. Reporting currency της οικογένειας (προαιρετικό, default EUR)
ALTER TABLE public.family_groups
    ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'EUR'
        REFERENCES public.currencies(code);

-- 2. Budgets: scope + νόμισμα στο UNIQUE (αντικαθιστά το παλιό UNIQUE)
ALTER TABLE public.budgets
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'personal'
        CHECK (scope IN ('personal', 'family'));

-- 3. Transfers: σύνδεση σκελών + ισοτιμία μεταφοράς
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS transfer_id UUID,
    ADD COLUMN IF NOT EXISTS transfer_rate NUMERIC(18,8);
```

**Σημείωση:** Το `family_groups.display_currency` είναι **προαιρετικό** — αν δεν
οριστεί, χρησιμοποιείται το `display_currency` του μέλους που βλέπει το report. Δεν
επιβάλλει ποτέ ενιαίο νόμισμα αποθήκευσης.

---

## 8. RLS — Δεν χρειάζεται αλλαγή για multi-currency

Το υπάρχον RLS (από [`family-budget-migration.sql`](family-budget-migration.sql:134))
βασίζεται στο `family_id` και το `user_id`, **όχι** στο νόμισμα. Άρα:

- Τα μέλη βλέπουν τις συναλλαγές/accounts της οικογένειας ανεξάρτητα από νόμισμα.
- Το `base_currency`/`display_currency`/`currency` είναι απλά πεδία δεδομένων — δεν
  επηρεάζουν την πρόσβαση.
- **Δεν χρειάζεται καμία αλλαγή RLS** για να υποστηριχθεί family multi-currency.

---

## 9. Edge Cases Ειδικά για Family Multi-Currency

1. **Δύο μέλη με ίδιο account (κοινός λογαριασμός):** Ένα account με `family_id`
   ορισμένο ανήκει στην οικογένεια. Το `currency` του είναι ένα (π.χ. EUR). Όλα τα
   μέλη βλέπουν το ίδιο υπόλοιπο. Δεν υπάρχει σύγκρουση με τα προσωπικά accounts.

2. **Μέλος αλλάζει base_currency:** Σπάνιο (βλ. §6 του βασικού review). Δεν επηρεάζει
   τα άλλα μέλη — κάθε συναλλαγή έχει το δικό της `base_currency`.

3. **Family report με μικτά νομίσματα:** Η μετατροπή κάθε συναλλαγής ξεχωριστά με
   ιστορική ισοτιμία είναι πιο αργή από το `SUM(amount_base)`. Για μεγάλα datasets,
   μπορούμε να κάνουμε caching των αθροισμάτων ανά (family, category, month) στο
   `family.display_currency`.

4. **Transfer με διαφορετική ισοτιμία από την τρέχουσα:** Ο χρήστης μπορεί να
   εισάγει χειροκίνητα την ισοτιμία μεταφοράς (π.χ. από την τράπεζα). Το
   `transfer_rate` το αποθηκεύει.

5. **Ένα μέλος φεύγει από την οικογένεια:** Τα προσωπικά του accounts/συναλλαγές
   παραμένουν (έχουν το δικό τους `base_currency`). Τα οικογενειακά budgets
   (`scope='family'`) παραμένουν στην οικογένεια.

6. **Νέο μέλος με διαφορετικό νόμισμα:** Απλώς ορίζει το δικό του
   `base_currency`/`display_currency`. Δεν χρειάζεται καμία αλλαγή στα υπάρχοντα
   δεδομένα της οικογένειας.

---

## 10. Συμπέρασμα

Το multi-currency design **υποστηρίζει πλήρως** οικογένεια με μέλη σε διαφορετικά
νομίσματα, γιατί:

1. **Το νόμισμα είναι ανά συναλλαγή/account/χρήστη, όχι ανά οικογένεια.** Το
   `base_currency` αποθηκεύεται σε κάθε συναλλαγή, άρα ο σύζυγος EUR και η σύζυγος USD
   συνυπάρχουν χωρίς σύγκρουση.
2. **Δεν υπάρχει κανένας περιορισμός "ένα νόμισμα ανά οικογένεια".** Το `family_id`
   είναι δείκτης συμμετοχής, όχι ορισμός νομίσματος.
3. **Τα κοινά στατιστικά** υπολογίζονται μετατρέποντας κάθε συναλλαγή στο
   `family.display_currency` (ή στο display_currency του μέλους) με ιστορική ισοτιμία.
4. **Τα κοινά budgets** χρειάζονται μικρή αλλαγή (`scope` + νόμισμα στο UNIQUE) για να
   υποστηρίξουν σαφώς οικογενειακά budgets.
5. **Τα transfers μεταξύ μελών** μοντελοποιούνται με δύο σκέλη + `transfer_id` +
   `transfer_rate`, ώστε να μην χαθεί/διπλασιαστεί χρήμα.
6. **Το net worth της οικογένειας** υπολογίζεται από τα `account.balance` με τρέχουσα
   ισοτιμία — ανεξάρτητα από τα base_currency των μελών.
7. **Το RLS δεν χρειάζεται αλλαγή** — η πρόσβαση βασίζεται σε `family_id`/`user_id`,
   όχι σε νόμισμα.

Οι μόνες **επιπλέον** προσθήκες που χρειάζονται πέρα από το βασικό design είναι:
`family_groups.display_currency`, `budgets.scope`, και `transactions.transfer_id` +
`transfers.transfer_rate`. Καμία από αυτές δεν εισάγει περιορισμό ενιαίου νομίσματος.
