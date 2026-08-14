# Google OAuth Native Login Fix

## Problem

Users could not sign in with a Google account in the **native Android (Capacitor)** app. The web/PWA version worked, but the native app failed silently.

## Root Cause

The native Google OAuth flow uses a **deep-link callback** to return the session tokens to the app:

1. [`app.js:20585`](../app.js:20585) (and [`www/app.js:20588`](../www/app.js:20588)) request the OAuth redirect to `https://localhost`:
   ```js
   const nativeRedirectUrl = 'https://localhost';
   ```

2. After the user authenticates with Google, the Chrome Custom Tab redirects to:
   ```
   https://localhost#access_token=...&refresh_token=...
   ```

3. For the app to receive this callback, Android must route `https://localhost` back into the app via an **intent filter** in the AndroidManifest.

4. **The AndroidManifest had NO intent filter for `https://localhost`.** The only configured deep links were:
   - `https://budget-assistant-pwa.pages.dev`
   - `com.budgetassistant.app` (custom scheme)
   - `budgetassistant` (custom scheme)

   Because no intent filter matched `https://localhost`, Android could not deliver the callback to the app. The `appUrlOpen` event never fired, the session was never set, and the user was left stuck — never logged in.

## Fix

Added an intent filter for `https://localhost` to [`android/app/src/main/AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml:31):

```xml
<!-- OAuth callback for Google sign-in (redirectTo = https://localhost).
     NOTE: no autoVerify here because localhost cannot be verified via
     Android App Links; the callback is delivered as a deep link. -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="localhost" />
</intent-filter>
```

Notes:
- `autoVerify` is intentionally **omitted** because `localhost` cannot be verified via Android App Links (there is no real domain to verify). The callback is delivered as a plain deep link.
- The activity already uses `launchMode="singleTask"`, so when the app is running and the Chrome Custom Tab redirects to `https://localhost`, the URL is delivered to the existing activity via `onNewIntent`, and Capacitor's App plugin fires `appUrlOpen`.

## Verification

- Both [`app.js:20585`](../app.js:20585) and [`www/app.js:20588`](../www/app.js:20588) use `https://localhost` as the native redirect URL, which now matches the new intent filter.
- The `appUrlOpen` handlers at [`app.js:20606`](../app.js:20606) and [`www/app.js:15761`](../www/app.js:15761) extract `access_token`/`refresh_token` from the callback fragment and call `setSession()`. With the implicit flow (configured at [`app.js:3149`](../app.js:3149)), these tokens are present in the callback URL, so the session is set correctly.

## Rebuild Required

The AndroidManifest change requires a **native rebuild** of the Android app (the manifest is compiled into the APK). The running `release:native` build must be re-run so the new intent filter is included in the installed APK.
