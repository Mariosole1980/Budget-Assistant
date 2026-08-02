# OTA Boot Process — Recovery Timeout Design

**Σκοπός:** Ανάλυση του boot process και επιλογή της σωστής αρχιτεκτονικής για το
recovery timeout, ώστε να αποφευχθούν τόσο false positives (ψευδώς επιτυχημένες
εκκινήσεις) όσο και false negatives (αχρείαστα recovery loops).

**Κατάσταση:** DESIGN REVIEW — πριν την υλοποίηση.

---

## 1. Το πρόβλημα

Ο χρήστης βλέπει **"Startup Timeout: App took too long to load."** κατά το dry-run test.

Το μήνυμα προέρχεται από το **Recovery Mode Bootloader** στο `index.html` (γραμμές 58-68),
ΟΧΙ από το native Capacitor. Είναι ένα **JavaScript timeout 4 δευτερολέπτων**:

```js
window._startupTimeout = setTimeout(function () {
  if (!window._appLoaded) {
    showRecoveryMode('Startup Timeout: App took too long to load.');
  }
}, 4000);
```

Το `window._appLoaded` γίνεται `true` ΜΟΝΟ στο `app.js` (γραμμή 2139), μέσα σε ένα
`DOMContentLoaded` handler, μετά την πλήρη αρχικοποίηση της εφαρμογής.

**Ρίζα αιτίας:** Ο νέος **async boot loader** δεν ταιριάζει με το παλιό **σύγχρονο**
recovery timeout.

---

## 2. Χρονολογική σειρά events (Boot Timeline)

```
t=0ms        index.html αρχίζει να φορτώνει
             - <head> script: window._appLoaded = false
             - <head> script: ξεκινά window._startupTimeout (4s)
             - <head> script: εγγράφει error listener (showRecoveryMode αν !_appLoaded)

t≈Xms       Core scripts φορτώνουν (NLPProcessor, MemoryEngine, κλπ) — ΣΥΓΧΡΟΝΑ

t≈Yms       ota-boot-loader.js φορτώνει → ορίζει window.OTABootLoader
t≈Yms       js/OTAEngine.js φορτώνει → auto-run initOTACheck() (setTimeout 4s)

t≈Yms       window.OTABootLoader.boot() καλείται (inline script)
            → ΑΣΥΓΧΡΟΝΟ: IndexedDB lookup (με timeout 1500ms)
            → inject app.js μέσω document.head.appendChild(script)

t≈Y+1500ms  (αν IndexedDB αργήσει) app.js αρχίζει να φορτώνει

t≈Zms       app.js τρέχει
            → εγγράφει DOMContentLoaded handler (γραμμή 1884)
            → ... πλήρης init ...
            → DOMContentLoaded fires → window._appLoaded = true (γραμμή 2139)
            → clearTimeout(window._startupTimeout) (γραμμή 2140)

t≈Z+ε       app.js τελειώνει → markBootOk() (γραμμή 24395)
            → μηδενίζει failure counter (rollback protection)

t=4000ms    ΑΝ _appLoaded δεν είναι true → showRecoveryMode("Startup Timeout...")
```

**Κρίσιμο:** Το `_appLoaded = true` συμβαίνει ΜΕΣΑ στο `DOMContentLoaded` handler.
Αν το app.js φορτώσει μετά το `DOMContentLoaded` (επειδή ο boot loader το injectάρει
ασύγχρονα), το handler **μπορεί να μην τρέξει ποτέ** ή να τρέξει με καθυστέρηση.

---

## 3. Ποιος είναι υπεύθυνος για τι

| Σήμα | Πού ορίζεται | Πότε | Τι σημαίνει |
|------|-------------|------|-------------|
| `_appLoaded = false` | `index.html` (γραμμή 47) | αρχή σελίδας | "η εφαρμογή ΔΕΝ έχει φορτώσει ακόμα" |
| `_startupTimeout` | `index.html` (γραμμή 58) | αρχή σελίδας | 4s watchdog για black screen |
| `_appLoaded = true` | `app.js` (γραμμή 2139) | μέσα σε DOMContentLoaded | "η εφαρμογή ΟΛΟΚΛΗΡΩΣΕ το init" |
| `clearTimeout(_startupTimeout)` | `app.js` (γραμμή 2140) | ίδιο σημείο | ακυρώνει το watchdog |
| `registerBootAttempt(version)` | `ota-boot-loader.js` (γραμμή 239) | αρχή boot (αν OTA) | αυξάνει failure counter |
| `markBootOk()` | `app.js` (γραμμή 24395) | τέλος app.js | μηδενίζει failure counter |
| `addPoisoned(version)` | `ota-boot-loader.js` (γραμμή 188) | αν counter > 3 | δηλητηριάζει το build |

**Δύο ΑΝΕΞΑΡΤΗΤΑ συστήματα:**

1. **Recovery overlay** (`_appLoaded` + `_startupTimeout`): "black screen" safety net.
   Σχεδιασμένο για το ΠΑΛΙΟ σύγχρονο `<script src="app.js">`.

2. **Rollback** (`registerBootAttempt` + `markBootOk` + poisoned list): προστασία από
   σπασμένα OTA builds. Ανεξάρτητο από το recovery overlay.

---

## 4. Failure Modes — Τι συμβαίνει σε κάθε περίπτωση

### FM-1: Download error (OTAEngine δεν κατεβάζει το build)
- Το OTA δεν ενεργοποιείται ποτέ. Το `KEY_ACTIVE` δεν αλλάζει.
- Ο boot loader φορτώνει το bundled app.js.
- **Αποτέλεσμα:** Κανονική λειτουργία. Κανένα πρόβλημα.

### FM-2: JS syntax error στο OTA app.js
- Το Blob script inject αποτυγχάνει → `loadScriptFromBlob` reject → catch → bundled fallback.
- **Αποτέλεσμα:** Φορτώνει το bundled. Το `markBootOk()` του bundled μηδενίζει τον counter.
  Το σπασμένο OTA δεν ενεργοποιήθηκε ποτέ (δεν έγινε activate). Κανένα πρόβλημα.

### FM-3: Runtime exception στο OTA app.js (crash κατά το init)
- Το app.js ξεκινά αλλά crashάρει πριν το `markBootOk()`.
- Ο failure counter ΔΕΝ μηδενίζεται. Στο επόμενο boot αυξάνεται.
- Μετά από 3 boots → poisoned → rollback στο bundled.
- **Αποτέλεσμα:** Rollback λειτουργεί. ΑΛΛΑ ο χρήστης βλέπει black screen (ή recovery
  overlay αν το `_appLoaded` δεν έγινε true) για 3 εκκινήσεις.

### FM-4: Init hang στο OTA app.js (κολλάει χωρίς crash, π.χ. infinite loop)
- Το app.js δεν φτάνει ποτέ στο `markBootOk()`.
- Ο failure counter ΔΕΝ μηδενίζεται. Rollback μετά από 3 boots.
- **Αποτέλεσμα:** Rollback λειτουργεί. Ο χρήστης βλέπει black screen για 3 εκκινήσεις.

### FM-5: IndexedDB timeout στον boot loader
- `withTimeout(idbGet(KEY_ACTIVE), 1500ms)` → reject → catch → bundled fallback.
- **Αποτέλεσμα:** Φορτώνει το bundled. Κανένα πρόβλημα.

### FM-6: IndexedDB μη διαθέσιμο
- `typeof indexedDB === 'undefined'` → bundled fallback αμέσως.
- **Αποτέλεσμα:** Φορτώνει το bundled. Κανένα πρόβλημα.

### FM-7: Ο boot loader injectάρει το app.js ΜΕΤΑ το DOMContentLoaded (ΤΟ ΤΡΕΧΟΝ ΠΡΟΒΛΗΜΑ)
- Το app.js εγγράφει τον `DOMContentLoaded` handler (γραμμή 1884) ΑΦΟΥ το
  `DOMContentLoaded` έχει ήδη γίνει.
- Ο handler **δεν τρέχει ποτέ** → `_appLoaded` μένει `false` → 4s timeout fires.
- **Αποτέλεσμα:** Ψευδές "Startup Timeout" ακόμα κι αν το app.js δουλεύει κανονικά.

> **ΣΗΜΕΙΩΣΗ:** Στην πράξη, το `DOMContentLoaded` στο WebView μπορεί να μην έχει γίνει
> ακόμα όταν ο boot loader injectάρει το app.js (γιατί το HTML είναι μεγάλο, 276KB).
> Αλλά αν το IndexedDB lookup καθυστερήσει ή το app.js φορτώσει αργά, το 4s όριο
> μπορεί να ξεπεραστεί. Αυτό είναι το ευάλωτο σημείο.

### FM-8: Το dry-run OTA app.js (minimal stub) — ΤΟ ΤΡΕΧΟΝ ΠΡΟΒΛΗΜΑ
- Το `ota-dryrun/app.js` είναι minimal stub. ΔΕΝ βάζει `_appLoaded = true`.
- Όταν φορτώνει το OTA v1008, το `_appLoaded` μένει `false` → 4s timeout fires.
- **Αποτέλεσμα:** ΠΑΝΤΑ εμφανίζεται "Startup Timeout" όταν το OTA v1008 είναι ενεργό.

---

## 5. Οι Επιλογές

### Επιλογή Α — Ο boot loader καθαρίζει το timeout μόλις injectάρει το app.js

Ο boot loader, μόλις επιλέξει και injectάρει το app.js (bundled ή OTA), βάζει
`window._appLoaded = true` και `clearTimeout(window._startupTimeout)`.

**Πλεονεκτήματα:**
- Λύνει το πρόβλημα για ΟΛΑ τα paths (bundled + OTA) με ΜΙΑ αλλαγή.
- Δεν απαιτεί να θυμόμαστε `_appLoaded` σε κάθε μελλοντικό OTA build.
- Δεν αποδυναμώνει το rollback (το `markBootOk()` παραμένει το σήμα υγείας).

**Μειονεκτήματα:**
- Αν το OTA app.js crashάρει ή κολλήσει (FM-3, FM-4), ο χρήστης βλέπει **black screen**
  αντί για recovery overlay. Το rollback γίνεται μετά από 3 boots, αλλά χωρίς feedback.
- Το recovery overlay χάνει τη λειτουργία του ως "black screen" safety net.

### Επιλογή Β — Κάθε app.js βάζει `_appLoaded = true` μετά το init

Κάθε app.js (bundled + OTA) πρέπει να βάζει `_appLoaded = true` μετά την επιτυχή init.

**Πλεονεκτήματα:**
- Το recovery overlay παραμένει ως safety net για σπασμένα builds.
- Πιο αυστηρό: "η εφαρμογή ΟΛΟΚΛΗΡΩΣΕ το init" = επιτυχία.

**Μειονεκτήματα:**
- Πρέπει να το θυμόμαστε σε κάθε μελλοντικό OTA build. Αν ξεχαστεί → ψευδές σφάλμα.
- Δεν λύνει το FM-7 (boot loader inject μετά το DOMContentLoaded) για το bundled path.
  Πρέπει να λυθεί ΚΑΙ το `DOMContentLoaded` timing.

### Επιλογή Γ — Υβριδική (boot loader καθαρίζει + markBootOk για rollback)

Ο boot loader καθαρίζει το timeout μόλις injectάρει το app.js (Επιλογή Α), ΑΛΛΑ το
`markBootOk()` παραμένει ως το πραγματικό σήμα υγείας για το rollback.

**Πλεονεκτήματα:**
- Λύνει το άμεσο πρόβλημα (FM-7, FM-8) για όλα τα paths.
- Δεν αποδυναμώνει το rollback — το `markBootOk()` παραμένει το σήμα υγείας.
- Δεν απαιτεί `_appLoaded` σε κάθε OTA build.

**Μειονεκτήματα:**
- Ίδιο με την Επιλογή Α: αν το OTA crashάρει/κολλήσει, ο χρήστης βλέπει black screen
  αντί για recovery overlay (για 3 boots μέχρι το rollback).

---

## 6. Σύγκριση με βάση τα Failure Modes

| Failure Mode | Επιλογή Α | Επιλογή Β | Επιλογή Γ |
|--------------|-----------|-----------|-----------|
| FM-1 Download error | ✅ Κανονικό | ✅ Κανονικό | ✅ Κανονικό |
| FM-2 JS syntax error | ✅ Bundled fallback | ✅ Bundled fallback | ✅ Bundled fallback |
| FM-3 Runtime crash | ⚠️ Black screen, rollback σε 3 boots | ✅ Recovery overlay + rollback | ⚠️ Black screen, rollback σε 3 boots |
| FM-4 Init hang | ⚠️ Black screen, rollback σε 3 boots | ⚠️ Recovery overlay (αν δεν βάλει _appLoaded) | ⚠️ Black screen, rollback σε 3 boots |
| FM-5 IDB timeout | ✅ Bundled fallback | ✅ Bundled fallback | ✅ Bundled fallback |
| FM-6 IDB unavailable | ✅ Bundled fallback | ✅ Bundled fallback | ✅ Bundled fallback |
| FM-7 Inject μετά DOMContentLoaded | ✅ Λύνεται | ⚠️ Χρειάζεται επιπλέον fix | ✅ Λύνεται |
| FM-8 Dry-run stub | ✅ Λύνεται | ✅ Λύνεται (αν βάλει _appLoaded) | ✅ Λύνεται |

**Ανάλυση:**
- Η **Επιλογή Β** είναι η μόνη που διατηρεί το recovery overlay ως safety net για
  FM-3/FM-4. ΑΛΛΑ απαιτεί επιπλέον fix για το FM-7 (bundled path) και πειθαρχία σε
  κάθε OTA build.
- Οι **Επιλογές Α και Γ** είναι ουσιαστικά ίδιες για τα failure modes. Η διαφορά είναι
  εννοιολογική (η Γ τονίζει ότι το `markBootOk` παραμένει το σήμα υγείας).

---

## 7. Σύσταση

**Προτείνω την Επιλογή Γ (υβριδική)** με μια βελτίωση για να καλυφθεί το FM-3/FM-4:

1. **Ο boot loader καθαρίζει το recovery timeout** μόλις injectάρει το app.js
   (bundled ή OTA). Αυτό λύνει το FM-7 και FM-8 για όλα τα paths.

2. **Το `markBootOk()` παραμένει το σήμα υγείας** για το rollback. Δεν αλλάζει.

3. **Προαιρετική βελτίωση για FM-3/FM-4:** Αντί να βασιζόμαστε στο recovery overlay
   (που είναι παλιό σύστημα), μπορούμε να **αυξήσουμε το MAX_FAILURES** ή να
   **προσθέσουμε ένα σύντομο visual feedback** στο boot loader όταν κάνει rollback
   (π.χ. ένα μικρό toast "Επαναφορά προηγούμενης έκδοσης"). Αυτό δίνει στον χρήστη
   feedback χωρίς να βασιζόμαστε στο παλιό recovery overlay.

**Γιατί ΟΧΙ η Επιλογή Β:**
- Απαιτεί πειθαρχία σε κάθε OTA build (κίνδυνος ψευδούς σφάλματος αν ξεχαστεί).
- Δεν λύνει το FM-7 για το bundled path χωρίς επιπλέον αλλαγή.
- Το `DOMContentLoaded` timing είναι εύθραυστο με τον async boot loader.

**Γιατί ΟΧΙ η Επιλογή Α μόνη:**
- Εννοιολογικά σωστή, αλλά πρέπει να τονιστεί ότι το `markBootOk` παραμένει το σήμα
  υγείας — αλλιώς υπάρχει κίνδυνος να θεωρηθεί ότι το recovery overlay καλύπτει το
  rollback (δεν το κάνει).

---

## 8. Προτεινόμενη Υλοποίηση (Επιλογή Γ)

### Αλλαγή 1: `ota-boot-loader.js` — καθαρισμός recovery timeout

Στο `boot()`, μόλις επιλεγεί και injectάρει το app.js (και στα δύο paths: bundled και
OTA), προσθέτουμε:

```js
// Clear the legacy recovery watchdog. The boot loader has now injected
// the chosen app.js (bundled or OTA). The real health signal for rollback
// is markBootOk() called at the end of app.js, NOT this watchdog.
function markAppInjected() {
  window._appLoaded = true;
  if (window._startupTimeout) {
    clearTimeout(window._startupTimeout);
    window._startupTimeout = null;
  }
}
```

Καλούμε το `markAppInjected()`:
- Στο `loadBundledApp()` (αμέσως πριν/μετά το inject).
- Στο OTA path (αμέσως πριν/μετά το `loadScriptFromBlob`).

### Αλλαγή 2: `ota-dryrun/app.js` — (προαιρετική, για ασφάλεια)

Προσθέτουμε στο dry-run stub:

```js
window._appLoaded = true;
if (window._startupTimeout) clearTimeout(window._startupTimeout);
```

Αυτό είναι ασφαλές (defense-in-depth) αλλά δεν είναι απαραίτητο αν γίνει η Αλλαγή 1.

### Αλλαγή 3 (προαιρετική): Visual feedback για rollback

Στο `ota-boot-loader.js`, όταν γίνεται rollback (poisoned ή failure threshold), να
εμφανίζεται ένα μικρό toast "Επαναφορά προηγούμενης έκδοσης" αντί για black screen.

---

## 9. Ανοιχτά Ερωτήματα

1. Θέλουμε το visual feedback για το rollback (Αλλαγή 3) ή αρκεί το rollback χωρίς
   feedback (όπως σήμερα, αλλά με black screen αντί για recovery overlay);

2. Θέλουμε να διατηρήσουμε το recovery overlay για κάποια άλλη περίπτωση, ή μπορούμε
   να το απενεργοποιήσουμε εντελώς για το Capacitor path;

3. Το `_appLoaded` χρησιμοποιείται αλλού; (Έλεγχος: μόνο στο recovery bootloader και
   στο app.js line 2139-2140. Δεν χρησιμοποιείται στο rollback.)
