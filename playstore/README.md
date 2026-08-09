# Budget Assistant — Play Store Assets

## Φάκελος: `playstore/`

```
playstore/
├── icon-512.png          ← 512×512 app icon (upload στο Play Console)
├── feature-graphic.jpg   ← 1024×500 banner (upload στο Play Console)
├── el/
│   ├── short_description.txt   ← ≤80 χαρακτήρες (Ελληνικά)
│   └── full_description.txt    ← ≤4000 χαρακτήρες (Ελληνικά)
└── en/
    ├── short_description.txt   ← ≤80 chars (English)
    └── full_description.txt    ← ≤4000 chars (English)
```

---

## Android Icons (αντικαταστάθηκαν αυτόματα)

| Density | Folder | Size |
|---------|--------|------|
| ldpi | mipmap-ldpi | 36×36 |
| mdpi | mipmap-mdpi | 48×48 |
| hdpi | mipmap-hdpi | 72×72 |
| xhdpi | mipmap-xhdpi | 96×96 |
| xxhdpi | mipmap-xxhdpi | 144×144 |
| xxxhdpi | mipmap-xxxhdpi | 192×192 |

Κάθε density έχει: `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`, `ic_launcher_background.png`

---

## Build Config Changes

- `versionCode`: 1206 → **1207**
- `versionName`: "1.0.1206" → **"1.1.0"**
- `targetSdkVersion`: 35 ✅
- Signing credentials: μεταφέρθηκαν στο `local.properties` (δεν ανεβαίνει στο git)

---

## Release AAB

`android/app/build/outputs/bundle/release/app-release.aab`

---

## Βήματα Play Console (χειροκίνητα)

1. Πήγαινε: https://play.google.com/console
2. **Create app** → "Budget Assistant" → Greek + English
3. **Store listing** → upload:
   - `icon-512.png`
   - `feature-graphic.jpg`
   - Κείμενα από `playstore/el/` και `playstore/en/`
4. **Production → Create new release** → upload `app-release.aab`
5. **Content rating** → συμπλήρωσε questionnaire
6. **Data safety** → δήλωσε: χρησιμοποιείς Supabase για sync
7. **Privacy Policy** → βάλε URL: `https://budget-assistant-pwa.pages.dev/privacy.html`
8. **Review and publish** → Submit for review

> [!IMPORTANT]
> Χρειάζεσαι Google Play Developer account (€25 εφάπαξ) αν δεν έχεις ήδη.
