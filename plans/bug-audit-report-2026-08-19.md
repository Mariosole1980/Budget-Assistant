# 🔍 Bug Audit Report — Budget Assistant
**Ημερομηνία:** 19 Αυγούστου 2026  
**Έκταση:** Πλήρης εξονυχιστικός έλεγχος κώδικα, tests, SQL migrations, security

---

## 📊 Σύνοψη

| Κατηγορία | Σοβαρότητα | Αριθμός |
|---|---|---|
| 🔴 CRITICAL | Μπορεί να προκαλέσει σοβαρό πρόβλημα σε production | 3 |
| 🟠 HIGH | Σημαντικό πρόβλημα που χρήζει άμεσης προσοχής | 3 |
| 🟡 MEDIUM | Θέμα ποιότητας / συντηρησιμότητας | 4 |
| 🟢 LOW | Βελτιώσεις / code style | 4 |
| **Σύνολο** | | **14** |

---

## 🔴 CRITICAL Issues

### C1. Mismatch μεταξύ app.js / SQL trigger / tests για το Cloud Tx Limit

**Τοποθεσία:**
- `app.js` → `PREMIUM_LIMITS.cloudTxPerMonth = 75`
- `test/premiumSecurity.test.js` → `CLOUD_TX_LIMIT = 100`
- `premium-security-fix-migration.sql` → `limit_val INT := 75`

**Πρόβλημα:** Το test `premiumSecurity.test.js` χρησιμοποιεί `CLOUD_TX_LIMIT = 100` ενώ ο πραγματικός κώδικας και το SQL trigger χρησιμοποιούν `75`. Τα tests περνάνε γιατί ελέγχουν τη λογική με τη λάθος τιμή. Αυτό σημαίνει ότι:
1. Ο έλεγχος "limit reached" στο test δεν αντανακλά την πραγματικότητα.
2. Αν κάποιος αλλάξει το app.js σε 100, τα tests δεν θα το πιάσουν.

**Fix:** Ενημέρωση του `test/premiumSecurity.test.js` να χρησιμοποιεί `CLOUD_TX_LIMIT = 75` (ή το test θα πρέπει να διαβάζει την τιμή από το app.js).

---

### C2. Insecure Profiles SELECT Policy στο Canonical Schema

**Τοποθεσία:**
- `profiles-canonical-schema.sql` γραμμή 62: `CREATE POLICY "Allow read-only profile access by email or id" ON public.profiles FOR SELECT TO authenticated USING (true);`
- `family-budget-migration.sql` γραμμή 56: ίδιο policy

**Πρόβλημα:** Το canonical schema (που είναι single source of truth) εξακολουθεί να περιέχει το **insecure** policy που επιτρέπει σε **ΟΠΟΙΟΝΔΗΠΟΤΕ authenticated user** να βλέπει **ΟΛΑ τα profiles** (emails, display_names, premium status, family_id). Το `family-security-fixes-migration.sql` το διορθώνει, αλλά:
1. Αν το canonical schema τρέξει ξανά σε production, **θα επαναφέρει το insecure policy**.
2. Το σχόλιο στο αρχείο λέει "Allow read-only profile access by email or id" — ενθαρρύνοντας τη διατήρηση του προβλήματος.

**Fix:** Ενημέρωση του `profiles-canonical-schema.sql` ώστε το SELECT policy να είναι το σωστό (own profile + family members) και το `family-budget-migration.sql` να μην περιέχει το insecure policy.

---

### C3. `premium-security-fix-migration.sql` Σχόλιο Λάθος

**Τοποθεσία:** `premium-security-fix-migration.sql` γραμμή 91

**Πρόβλημα:** Το σχόλιο λέει:
```
limit_val INT := 75;  -- keep in sync with PREMIUM_LIMITS.cloudTxPerMonth in app.js
```
Αλλά το ίδιο αρχείο στο verification section (γραμμή 144) λέει:
```
--   4. As a non-Premium user, after inserting 100 transactions this month:
```
Χρησιμοποιεί 100 στο verification αντί για 75. Αυτό μπορεί να μπερδέψει όποιον τρέχει το verification και να πιστέψει ότι το trigger έχει bug όταν σταματά στα 75.

**Fix:** Ενημέρωση του verification section να λέει 75.

---

## 🟠 HIGH Issues

### H1. Άδεια catch blocks (25+ θέσεις)

**Τοποθεσία:** app.js γραμμές: 359, 366, 716, 723, 1823, 1946, 2546, 4176, 4419, 5620, 9365, 14298, 14733, 15606, 16727, 21131, 21996, 22519, 22545, 22560, 22575, 24281, 26598, 26679, 28058, 29956, 30633, 30755

**Πρόβλημα:** Σφάλματα που σβήνονται σιωπηλά:
- `try { state.currentUser = JSON.parse(hasCachedUser); } catch (e) { }` — αν το JSON είναι corrupted, ο χρήστης μένει logged out χωρίς κανένα μήνυμα.
- `try { navigator.vibrate(15); } catch (err) { }` — OK για vibrate αλλά γενικά πρέπει να γίνεται log.
- `} catch (e) { }` σε sync operations — χάνεται το debugging context.

**Fix:** Προσθήκη ελαχίστου logging ή console.warn σε κρίσιμα σημεία (ειδικά JSON.parse).

---

### H2. innerHTML χωρίς escapeHtml (429 θέσεις)

**Τοποθεσία:** app.js και www/app.js

**Πρόβλημα:** 429 περιπτώσεις `innerHTML =` με δυναμικά δεδομένα που **δεν** περνάνε από `escapeHtml()`. Πολλές χρησιμοποιούν user-generated data (note text, category names, transaction descriptions) που θα μπορούσαν να περιέχουν HTML/script injection. Ενώ είναι PWA (όχι πλήρες web), το XSS μέσω crafted data είναι δυνατό.

**Fix:** Σταδιακή αντικατάσταση με `textContent` για plain text ή χρήση `escapeHtml()` helper για HTML templates.

---

### H3. version.json Mismatch

**Τοποθεσία:** `version.json` vs `www/version.json`

**Πρόβλημα:**
```
version.json:  { "version": 1430 }          // number
www/version.json: { "version": "1.0.1430", "url": "...", "checksum": "..." }  // string + metadata
```
Το root version.json χρησιμοποιεί number ενώ το www χρησιμοποιεί string. Το `scripts/version-sync.js` μπορεί να μην τα συγχρονίζει σωστά.

**Fix:** Ενοποίηση format — χρησιμοποιήστε string μορφή `"1.0.1430"` και στα δύο.

---

## 🟡 MEDIUM Issues

### M1. Μεγάλες γραμμές (200+ θέσεις)

**Τοποθεσία:** app.js — αρκετές γραμμές 200-700 χαρακτήρες (π.χ. γραμμές 29862, 29865, 29868 με 621-643 chars)

**Πρόβλημα:** Δυστήρητη και δύσκολη η εύρεση bugs.

**Fix:** Σταδιακό refactoring σε πολλές γραμμές.

---

### M2. Loose equality `== null` (20+ θέσεις)

**Τοποθεσία:** app.js, js/CurrencyService.js, js/MemoryEngine.js, www/app.js

**Πρόβλημα:** Τα `== null` είναι intentional (ελέγχουν και null και undefined), αλλά το eslint θα τα μαρκάρει. Δεν είναι κρίσιμο αλλά είναι code style issue.

**Fix:** Χρήση `=== null || === undefined` για σαφήνεια.

---

### M3. console.log σε production

**Τοποθεσία:** app.js γραμμές 2356, 4403, 17662, 17969, 20810, 20930, 28335

**Πρόβλημα:** Debug logs που έχουν μείνει στο production code.

**Fix:** Αφαίρεση ή wrap σε `DEBUG` flag.

---

### M4. Ambiguous `hardcoded-secret` στο OAuth

**Τοποθεσία:** app.js γραμμή 15183

**Πρόβλημα:** `data.url.includes('access_token=')` — false positive, δεν είναι secret. Αλλά αν ο χρήστης κάνει logout, το access_token παραμένει στο URL history.

**Fix:** Χρήση `history.replaceState()` μετά την εξαγωγή του token.

---

## 🟢 LOW Issues

### L1. Κενά catch blocks στο CurrencyService
**Τοποθεσία:** js/CurrencyService.js γραμμές 314, 317

---

### L2. Missing else στο www/app.js μη-συγχρονισμένα
**Τοποθεσία:** Όλα τα κύρια αρχεία συγχρονισμένα: index.html, style.css, app.js, web-ui.js, manifest.json, sw.js — IDENTICAL με www/

---

### L3. Scratch backup file
**Τοποθεσία:** `scratch_app_v1387.js` — περιέχει 100 cloudTxPerMonth, όχι 75 (outdated backup).

---

### L4. `functions/api/feedback.js` δεν έχει καλυφθεί από το audit script
**Τοποθεσία:** functions/api/feedback.js υπάρχει αλλά δεν ήταν στη λίστα ελέγχου.

---

## ✅ Τι Πέρασε τον Έλεγχο

| Στοιχείο | Κατάσταση |
|---|---|
| Όλα τα 81 unit tests | ✅ PASS |
| Syntax check κύριων αρχείων | ✅ OK |
| app.js vs www/app.js | ✅ IDENTICAL |
| index.html vs www/index.html | ✅ IDENTICAL |
| style.css vs www/style.css | ✅ IDENTICAL |
| web-ui.js vs www/web-ui.js | ✅ IDENTICAL |
| manifest.json vs www/manifest.json | ✅ IDENTICAL |
| sw.js vs www/sw.js | ✅ IDENTICAL |
| Stripe webhook signature verification | ✅ OK (HMAC-SHA256, constant-time) |
| Premium-status reconciliation | ✅ OK (μόνο με paid session) |
| protect_premium_columns trigger | ✅ OK (blocker fixed) |
| ai_usage write protection | ✅ OK (blocker fixed) |
| exchange_rates INSERT policy | ✅ OK (περιορισμένο) |
| family-security-fixes-migration | ✅ OK (admin-by-URL closed) |
| RLS στους tenant πίνακες | ✅ OK (accounts, categories, transactions) |

---

## 🎯 Προτεινόμενες Ενέργειες

### Άμεσα (Priority 1)
1. **[C1]** Ενημέρωση `test/premiumSecurity.test.js` → `CLOUD_TX_LIMIT = 75`
2. **[C2]** Διόρθωση `profiles-canonical-schema.sql` → secure SELECT policy
3. **[C3]** Διόρθωση σχολίου verification στο `premium-security-fix-migration.sql`

### Σύντομα (Priority 2)
4. **[H1]** Προσθήκη logging στα κρίσιμα empty catch blocks (JSON.parse)
5. **[H3]** Ενοποίηση version.json format

### Μεσοπρόθεσμα (Priority 3)
6. **[H2]** Σταδιακή αντικατάσταση innerHTML → textContent/escapeHtml
7. **[M1]** Breaking μεγάλων γραμμών
8. **[M2]** Standardize loose equality