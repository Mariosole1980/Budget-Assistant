# 🐛 Issue Report — Σπασμένη εικόνα πριν το HTML splash (Android cold start)

**Αναφορά προβλήματος** · Διορθώθηκε στο build **v1503**

---

## 1. Σύμπτωμα

Κατά το **ψυχρό ξεκίνημα** (cold start / μετά από Android process death) της εφαρμογής,
**πριν** εμφανιστεί το branded HTML splash screen (`splash.html`), εμφανίζεται για ~1–2
δευτερόλεπτα μια **«σπασμένη» εικόνα**:

- Τεντωμένη / κομμένη full-screen φωτογραφία (σε Android 8–11), ή
- Τετράγωνο εικονίδιο εφαρμογής που δείχνει λάθος / κατεστραμμένο (σε Android 12+ σε κάποια OEM).

Ο χρήστης το περιέγραψε ως: *«η φωτογραφία που εμφανίζεται πριν το splash screen html στο cold start είναι σπασμένη»*.

---

## 2. Τι ΔΕΝ είναι το πρόβλημα

Η εικόνα **δεν** είναι μέρος του web layer — δεν είναι το `splash.html`, ούτε κάποιο asset του
PWA. Είναι το **native Android launch window**, που σχεδιάζει το λειτουργικό σύστημα **πριν**
καν δημιουργηθεί το WebView. Γι' αυτό **δεν μπορεί να καλυφθεί** με JavaScript/CSS:
το `index.html`/`app.js` απλά δεν έχουν τρέξει ακόμα εκείνη τη στιγμή.

---

## 3. Root cause (δύο ξεχωριστές αιτίες)

| Πλατφόρμα | Αιτία |
|---|---|
| **Android 8–11 (API 27–30)** | Το `res/values-v27/styles.xml` έδειχνε τη full-screen φωτογραφία `splash.png` ως `android:windowBackground`. Σε πραγματικές συσκευές (διαφορετικό aspect ratio, notch/cutout) η εικόνα εμφανιζόταν τεντωμένη/κομμένη → «σπασμένη». |
| **Android 12+ (API 31+)** | Το εικονίδιο του SplashScreen API ήταν `@android:color/transparent`. Πολλά OEM builds (Samsung, Xiaomi κ.ά.) **δεν αναγνωρίζουν ένα color ως έγκυρο εικονίδιο splash** → εμφανίζουν το τετράγωνο launcher icon (`@mipmap/ic_launcher`), που δείχνει σαν σπασμένη φωτογραφία. |

---

## 4. Λύση (υλοποιήθηκε)

Το native launch window έγινε **σκέτο solid `#171B26`** — χωρίς φωτογραφία, χωρίς εικονίδιο —
ώστε να «λιώνει» απευθείας μέσα στο HTML splash (το `splash.html` είναι σκούρο navy).

| Αλλαγή | Περιγραφή |
|---|---|
| `res/drawable/splash_icon.xml` (**νέο**) | Πλήρως διάφανο vector drawable → αξιόπιστο «κανένα εικονίδιο» σε όλες τις συσκευές/API. |
| `res/values/styles.xml` | `windowSplashScreenAnimatedIcon` → `@drawable/splash_icon`, φόντο `#171B26` (`android:windowBackground`). |
| `res/values-v31/styles.xml` | Ίδιο fix για Android 12+. |
| `res/values-v27/styles.xml` | Αφαιρέθηκε το `@drawable/splash` (φωτογραφία) → σκέτο `#171B26`. |
| Διαγραφή αρχείων | Και τα 26 `res/*/splash.png` διαγράφηκαν (αφαιρέθηκε και ~1.4MB από το APK). |

---

## 5. Αποτέλεσμα & επαλήθευση

- Η native οθόνη εκκίνησης είναι πλέον καθαρό σκούρο φόντο → φαίνεται σαν να ξεκινάει
  **άμεσα** το HTML splash, χωρίς καμία σπασμένη εικόνα.
- `gradlew assembleDebug` / `assembleRelease` / `bundleRelease` → **BUILD SUCCESSFUL**.
- Επαληθεύτηκε ότι το release APK **δεν περιέχει** κανένα native `splash.png`.

---

## 6. Περιορισμοί / σημαντικές σημειώσεις

1. Το native launch window **δεν μπορεί να παραλειφθεί 100%** — το Android οφείλει να
   σχεδιάσει κάτι όσο ξεκινάει το WebView. Πλέον, όμως, είναι αόρατο (ίδιο χρώμα με το splash).
2. Η διόρθωση είναι **native-only** (`res/`) → **ΔΕΝ μεταφέρεται με OTA** (το Capgo
   `capacitor-updater` ενημερώνει μόνο το web bundle `www/`). Απαιτείται εγκατάσταση του
   νέου native build (**v1503** / `BudgetAssistant-Latest.apk` ή AAB στο Play Console).
3. Στο web layer παραμένει ένα **ορφανό** `assets/splash.png` (μη αναφερόμενο πουθενά) —
   δεν αγγίχθηκε γιατί ανήκει στο PWA/Cloudflare deploy.

---

## 7. Related

- `plans/native-launch-pipeline-audit.md` — προηγούμενη ανάλυση του native launch pipeline.
- Commit: `2ae5620` — `fix(native-splash): replace broken native launch-window photo with solid #171B26 screen so HTML splash starts immediately`
- Release: `e06b577` — `release: build v1503 [automated universal release]`
