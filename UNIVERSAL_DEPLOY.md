# 🚀 Universal Deploy — Budget Assistant

Οδηγίες για να κάνεις **πλήρες deploy** του project σε όλες τις πλατφόρμες:
**Web (Cloudflare Pages)**, **Android (APK/AAB)** και **OTA (Capgo)**.

> Αυτό το αρχείο προορίζεται να δοθεί σε ένα AI agent (ή να ακολουθηθεί χειροκίνητα)
> ώστε να εκτελέσει το release σωστά και με τη σωστή σειρά.

---

## 1. Πριν ξεκινήσεις — Προϋποθέσεις

Βεβαιώσου ότι όλα τα παρακάτω ισχύουν **πριν** τρέξεις οτιδήποτε:

- [ ] Είσαι μέσα στον φάκελο του project: `c:/Users/mario/Desktop/budget-assistant`
- [ ] Έχεις εγκαταστήσει τις εξαρτήσεις: `npm install`
- [ ] Έχεις **Cloudflare Wrangler** authenticated (για το web deploy):
  - `npx wrangler whoami` → πρέπει να δείχνει το λογαριασμό σου
- [ ] Έχεις **Android SDK / Java** για τα Gradle builds
- [ ] Έχεις ρυθμισμένο το **Android signing** (keystore) — το χειρίζεται το
  `scratch/configure_signing.js`
- [ ] Έχεις ρυθμισμένο το **Capgo** API key (για το OTA bundle)
- [ ] Το `version.json` υπάρχει στη ρίζα του project

---

## 2. Τι κάνει το κάθε script

| Script | Τι κάνει |
|--------|----------|
| `scripts/version-bump.js` | Αυξάνει τον αριθμό build στο `version.json` |
| `scripts/version-check.js` | Ελέγχει τη συνέπεια version σε όλα τα αρχεία |
| `scripts/release-deploy.js` | **Web-only** release → Cloudflare Pages |
| `scripts/release-native.js` | **Native + OTA** stage (APK/AAB + Capgo bundle) |
| `scripts/release-all.js` | **Universal** release: όλα μαζί (web + native + OTA) |
| `scripts/release-verify-live.js` | Επαληθεύει ότι το live site δουλεύει |

---

## 3. Οι 3 τρόποι deploy

### Επιλογή Α — Πλήρες Universal Release (συνιστάται)

Κάνει **τα πάντα**: bump version → check → web deploy → native + OTA → verify.

```bash
npm run release:all
```

Αυτό εκτελεί με τη σειρά:
1. `version-bump.js` (αυξάνει το build number)
2. `version-check.js` (συνέπεια version)
3. Deploy `www/` → Cloudflare Pages (`budget-assistant-pwa`)
4. `release-native.js` (Android APK/AAB + Capgo OTA + re-deploy www)
5. `release-verify-live.js` (live verification)

**Σημείωση:** Το `release-all.js` **δεν** απαιτεί καθαρό git working tree
(σε αντίθεση με το `release-deploy.js`).

---

### Επιλογή Β — Μόνο Web (Cloudflare Pages)

Αν θέλεις **μόνο** το web deploy (χωρίς native/OTA):

```bash
npm run release:deploy
```

**ΠΡΟΣΟΧΗ:** Αυτό το script **απαιτεί καθαρό git working tree** (χωρίς
uncommitted changes). Αν υπάρχουν αλλαγές, θα σταματήσει με error. Κάνε
`git add -A && git commit` πρώτα, ή χρησιμοποίησε την Επιλογή Α.

---

### Επιλογή Γ — Μόνο Native + OTA

Αν το web είναι ήδη deployed και θες μόνο το native/OTA stage:

```bash
npm run release:native
```

Αυτό:
1. Ρυθμίζει signing + versionCode/versionName στο `build.gradle`
2. Κάνει `npx cap sync android`
3. Χτίζει **Debug APK**, **Release APK** και **AAB** (Gradle)
4. Αντιγράφει τα artifacts στο **Desktop**:
   - `BudgetAssistant-Latest.apk`
   - `BudgetAssistant.aab`
5. Δημιουργεί το **Capgo OTA bundle** και το βάζει στο `www/`
6. Ξανα-κάνει deploy το `www/` στο Cloudflare Pages (ώστε το OTA zip +
   `version.json` να φτάσουν στο CDN)

---

## 4. Τι παράγει το Universal Release

Μετά από `npm run release:all`, έχεις:

| Artifact | Τοποθεσία |
|----------|-----------|
| Live Web App | `https://budget-assistant-pwa.pages.dev` |
| Signed Release APK | `Desktop/BudgetAssistant-Latest.apk` |
| Play Store Bundle (AAB) | `Desktop/BudgetAssistant.aab` |
| OTA bundle (Capgo) | `https://budget-assistant-pwa.pages.dev/<filename>.zip` |
| OTA manifest | `www/version.json` |

---

## 5. Βήματα για το AI agent (αναλυτικά)

Αν δίνεις αυτές τις οδηγίες σε ένα AI agent, πες του να κάνει **ακριβώς** τα εξής:

### Βήμα 1 — Έλεγχος περιβάλλοντος
```bash
cd c:/Users/mario/Desktop/budget-assistant
node --version
npx wrangler whoami
```

### Βήμα 2 — Πλήρες Universal Release
```bash
npm run release:all
```

### Βήμα 3 — Επαλήθευση αποτελέσματος
- Επιβεβαίωσε ότι το live site απαντά: `https://budget-assistant-pwa.pages.dev`
- Επιβεβαίωσε ότι τα artifacts υπάρχουν στο Desktop:
  - `BudgetAssistant-Latest.apk`
  - `BudgetAssistant.aab`
- Επιβεβαίωσε ότι το `www/version.json` έχει ενημερωθεί με το νέο OTA bundle

### Βήμα 4 — (Προαιρετικό) Commit του release state
Αν θες να κρατήσεις το release state στο git:
```bash
git add -A
git commit -m "release: universal deploy"
```

---

## 6. Troubleshooting

| Πρόβλημα | Λύση |
|----------|------|
| `release:deploy` σταματά με "Dirty working tree" | Κάνε commit/stash τις αλλαγές ή χρησιμοποίησε `release:all` |
| Wrangler authentication error | Τρέξε `npx wrangler login` |
| Gradle build fails | Βεβαιώσου ότι έχεις Java 17+ και Android SDK |
| Capgo bundle error | Έλεγξε το Capgo API key / `@capgo/cli` εγκατάσταση |
| Live verification warnings | Συνήθως μη-κρίσιμα· το script συνεχίζει |

---

## 7. Σημειώσεις

- Το **canonical** Cloudflare Pages project είναι το `budget-assistant-pwa`.
- Το OTA bundle χρησιμοποιεί το `@capgo/capacitor-updater` στο native app.
- Το `release-all.js` είναι ο **συνιστώμενος** τρόπος για πλήρες release γιατί
  κάνει τα πάντα με τη σωστή σειρά και δεν απαιτεί καθαρό git tree.
