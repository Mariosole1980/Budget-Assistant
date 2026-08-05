/**
 * ============================================================
 * OTA ENGINE — v1 conservative (REVIEW DRAFT)
 * ============================================================
 * Downloads new web assets (app.js + style.css) from the server,
 * stages them in IndexedDB, validates them, and atomically activates
 * them. The BOOT LOADER (ota-boot-loader.js) reads the active build
 * on next launch.
 *
 * v1 scope (conservative):
 *   - ONLY app.js + style.css + version metadata
 *   - NO index.html replacement, NO modules, NO native changes
 *
 * This is the REVIEW DRAFT. It is NOT yet wired into index.html.
 * ============================================================
 */
window.OTAEngine = (function () {
  'use strict';

  // ------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------
  // BUILD-TIME OVERRIDE (SECURITY):
  //   - Dry-run APK:  'https://ota-dryrun.pages.dev'
  //   - Production:   null  (uses the real production server below)
  // This is a compile-time constant baked into the APK. It is NEVER
  // read from localStorage/runtime, which would be a supply-chain
  // attack vector (a malicious server could serve a malicious app.js
  // via Blob URL).
  var OTA_SERVER_OVERRIDE = null;
  var SERVER_BASE = OTA_SERVER_OVERRIDE || 'https://budget-assistant-pwa.pages.dev';
  var VERSION_URL = SERVER_BASE + '/version.json';
  var APP_JS_URL = SERVER_BASE + '/app.js';
  var STYLE_CSS_URL = SERVER_BASE + '/style.css';

  // IndexedDB (must match the boot loader's DB)
  var DB_NAME = 'ota_assets_db';
  var DB_VERSION = 1;
  var STORE = 'assets';

  // Keys in the assets store
  var KEY_ACTIVE = 'ota_active_build';       // { version, appJs, styleCss, appliedAt }
  var KEY_STAGING = 'ota_staging_build';     // { version, appJs, styleCss, downloadedAt, complete:true }
  var KEY_POISONED = 'ota_poisoned_builds';  // [version, ...]
  var KEY_FAIL_COUNT = 'ota_fail_count';     // consecutive failed boots (shared with boot loader)

  // Guardrails
  var MAX_ASSET_SIZE = 3 * 1024 * 1024;      // 3MB per asset (app.js is ~1MB, style.css ~170KB)
  var MIN_APP_JS_SIZE = 1000;                // sanity floor to reject error pages
  var MIN_STYLE_CSS_SIZE = 100;              // sanity floor
  var STAGING_TIMEOUT_MS = 30000;            // per-asset download timeout
  var CHECK_INTERVAL_MS = 4 * 60 * 1000;     // background check every 4 min
  var INITIAL_DELAY_MS = 4000;               // wait after boot before first check

  // ------------------------------------------------------------
  // IndexedDB helpers
  // ------------------------------------------------------------
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error || new Error('IDB open error')); };
      req.onblocked = function () { reject(new Error('IDB blocked')); };
    });
  }

  function idbPut(key, value) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function idbGet(key) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  function idbDelete(key) {
    return openDB().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function (e) { reject(e.target.error); };
      });
    });
  }

  // ------------------------------------------------------------
  // localStorage helpers (rollback state, shared with boot loader)
  // ------------------------------------------------------------
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function getPoisonedList() {
    try {
      var raw = lsGet(KEY_POISONED);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function addPoisoned(version) {
    var list = getPoisonedList();
    if (list.indexOf(version) === -1) list.push(version);
    lsSet(KEY_POISONED, JSON.stringify(list));
  }
  function isPoisoned(version) {
    return getPoisonedList().indexOf(version) !== -1;
  }

  // ------------------------------------------------------------
  // Fetch with timeout + size guard
  // ------------------------------------------------------------
  function fetchWithTimeout(url, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || STAGING_TIMEOUT_MS);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res;
      })
      .catch(function (e) {
        clearTimeout(timer);
        throw e;
      });
  }

  // ------------------------------------------------------------
  // Version / minNativeVersion handling
  // ------------------------------------------------------------
  // Reads the current native versionCode from the bundled app.
  // In Capacitor, this is exposed via the Capacitor native bridge.
  function getNativeVersionCode() {
    try {
      if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') {
        // Capacitor exposes the native app version via the bridge.
        // Fall back to a bundled constant if unavailable.
        if (window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
          return window.Capacitor.Plugins.App.getInfo().then(function (info) {
            // IMPORTANT: App.getInfo() returns:
            //   build   = versionCode as string, e.g. "1007"  <-- what we want
            //   version = versionName, e.g. "1.0.1007"  <-- parseInt gives 1 (WRONG)
            // We MUST read `build` FIRST. Reading `version` first caused the
            // minNative gate to see nativeCode=1 and block every update.
            var raw = info.build || info.versionCode || info.version;
            var parsed = parseInt(raw, 10);
            return (isNaN(parsed) || parsed <= 0) ? 0 : parsed;
          });
        }
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(0);
  }

  // The bundled native versionCode. This is injected at build time.
  // For v1012 the APK versionCode is 1012. Kept as a constant fallback.
  var BUNDLED_NATIVE_VERSION = 1073;

  // ------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------
  // Validates a downloaded asset before it can be staged/activated.
  // Returns true if valid, false otherwise.
  function validateAsset(name, code, minSize, maxSize) {
    if (typeof code !== 'string') return false;
    if (code.length < minSize) return false;
    if (code.length > maxSize) return false;
    // Reject obvious error pages (HTML instead of JS/CSS).
    // NOTE: both alternatives MUST be anchored to the start. The unanchored
    // `<html` would match `<html>` appearing anywhere (e.g. inside a comment or
    // template string) and falsely reject valid JS/CSS.
    if (/^\s*<!DOCTYPE|^\s*<html/i.test(code)) return false;
    if (name === 'app.js') {
      // app.js must define the global `state` object (a reliable signature).
      if (code.indexOf('const state') === -1 && code.indexOf('var state') === -1) return false;
    }
    return true;
  }

  // ------------------------------------------------------------
  // Download + Stage (atomic staging)
  // ------------------------------------------------------------
  // Downloads app.js + style.css for a target version, validates them,
  // and writes them to the STAGING key. The staging record is only
  // written AFTER both assets are fully downloaded and validated.
  // If the app is killed mid-download, the staging key is simply absent
  // or incomplete — the active build is untouched, so the app still boots
  // from the previous (or bundled) version. No partial activation.
  function downloadAndStage(version) {
    console.log('[OTAEngine] Downloading v' + version + ' assets...');

    var appPromise = fetchWithTimeout(APP_JS_URL + '?v=' + version + '&_t=' + Date.now())
      .then(function (r) {
        // DIAGNOSTIC: capture the response URL (detects redirects) and pass it through
        return r.text().then(function (code) { return { code: code, url: r.url }; });
      })
      .then(function (res) {
        var code = res.code;
        // DIAGNOSTIC: log exactly what the app received, so we can see if it differs
        // from what curl returns (cache/redirect/SW interference) in a single run.
        console.log('[OTAEngine-DIAG] app.js v' + version + ' response:',
          'url=' + res.url,
          'len=' + code.length,
          'first120=' + JSON.stringify(code.slice(0, 120)),
          'hasConstState=' + (code.indexOf('const state') !== -1),
          'hasVarState=' + (code.indexOf('var state') !== -1),
          'looksLikeHtml=' + (/^\s*<!DOCTYPE|<html/i.test(code)));
        if (!validateAsset('app.js', code, MIN_APP_JS_SIZE, MAX_ASSET_SIZE)) {
          throw new Error('app.js validation failed for v' + version);
        }
        return code;
      });

    // style.css is OPTIONAL — the app uses inline CSS in index.html.
    // If style.css is empty, missing, or fails validation, we skip it
    // gracefully and proceed with only app.js. A failing style.css must
    // NOT block the entire OTA update.
    var stylePromise = fetchWithTimeout(STYLE_CSS_URL + '?v=' + version + '&_t=' + Date.now())
      .then(function (r) { return r.text(); })
      .then(function (code) {
        // Accept empty or invalid style.css gracefully (returns null = skip)
        if (!validateAsset('style.css', code, MIN_STYLE_CSS_SIZE, MAX_ASSET_SIZE)) {
          console.log('[OTAEngine] style.css empty or invalid for v' + version + ' — skipping (app uses inline CSS)');
          return null;
        }
        return code;
      })
      .catch(function (e) {
        // style.css fetch failure is non-fatal
        console.log('[OTAEngine] style.css fetch failed (non-fatal):', e.message);
        return null;
      });

    return Promise.all([appPromise, stylePromise]).then(function (results) {
      var appJs = results[0];
      var styleCss = results[1]; // may be null if empty/missing

      // Build the staging record. Marked complete ONLY after app.js is
      // downloaded and validated. This is the atomic staging boundary.
      var staging = {
        version: version,
        appJs: appJs,
        styleCss: styleCss || '',
        downloadedAt: Date.now(),
        complete: true
      };

      // Write staging. If this write fails, nothing is activated.
      return idbPut(KEY_STAGING, staging).then(function () {
        console.log('[OTAEngine] Staged v' + version + ' (' + appJs.length + 'B app.js' + (styleCss ? ', ' + styleCss.length + 'B style.css' : ', no style.css') + ')');
        return staging;
      });
    });
  }

  // ------------------------------------------------------------
  // Atomic activation
  // ------------------------------------------------------------
  // Promotes the validated staging record to ACTIVE in a single write.
  // The boot loader reads KEY_ACTIVE on next launch. Because activation
  // is a single idbPut, there is no window where a half-activated build
  // exists. The previous active build is overwritten atomically.
  //
  // IMPORTANT (auto-apply): After a successful activation we reload the
  // page so the boot loader immediately loads the freshly-activated OTA
  // build. This removes the need to manually close/reopen the app. A
  // guard flag prevents infinite reload loops.
  function activateStaged(staging) {
    if (!staging || !staging.complete || !staging.version || !staging.appJs) {
      throw new Error('Cannot activate incomplete staging');
    }
    var active = {
      version: staging.version,
      appJs: staging.appJs,
      styleCss: staging.styleCss,
      appliedAt: Date.now()
    };
    return idbPut(KEY_ACTIVE, active).then(function () {
      // Clear staging + reset failure counter for the new build.
      return idbDelete(KEY_STAGING).then(function () {
        lsRemove(KEY_FAIL_COUNT);
        console.log('[OTAEngine] Activated v' + staging.version + '. Will load on next app start.');
        // Auto-apply: reload so the boot loader picks up the new build now.
        scheduleAutoReload(staging.version);
        return active;
      });
    });
  }

  // ------------------------------------------------------------
  // Auto-apply reload
  // ------------------------------------------------------------
  // After activation, reload the page so the boot loader loads the new
  // OTA build immediately (no manual close/reopen). Guarded against
  // infinite loops:
  //   - window.__OTA_RELOADING prevents a second reload from the same
  //     page lifetime.
  //   - We only reload if the newly-activated version differs from the
  //     version currently running (window.OTA_ACTIVE_VERSION). If the app
  //     is already running the activated build, no reload is needed.
  function scheduleAutoReload(activatedVersion) {
    try {
      if (window.__OTA_RELOADING) return;
      var running = (typeof window.OTA_ACTIVE_VERSION !== 'undefined' && window.OTA_ACTIVE_VERSION != null)
        ? parseInt(window.OTA_ACTIVE_VERSION, 10) : 0;
      var activated = parseInt(activatedVersion, 10);
      // If we are already running the activated build, nothing to do.
      if (running > 0 && activated > 0 && running === activated) {
        console.log('[OTAEngine] Already running v' + activated + '. No reload needed.');
        return;
      }
      window.__OTA_RELOADING = true;
      console.log('[OTAEngine] Auto-applying v' + activatedVersion + ' — reloading to load new build.');
      // Small delay so the IndexedDB write fully settles before reload.
      setTimeout(function () {
        window.location.reload();
      }, 300);
    } catch (e) {
      console.warn('[OTAEngine] Auto-reload failed (non-fatal):', e);
    }
  }

  // ------------------------------------------------------------
  // Corrupted build protection
  // ------------------------------------------------------------
  // If the boot loader detects repeated failures, it poisons the build.
  // This engine also refuses to re-activate a poisoned version.
  function isVersionPoisoned(version) {
    return isPoisoned(version);
  }

  // ------------------------------------------------------------
  // Main update check
  // ------------------------------------------------------------
  // 1. Fetch version.json (with minNativeVersion).
  // 2. If remote version <= current, do nothing.
  // 3. If remote requires a newer native version than installed, skip.
  // 4. If the remote version is poisoned, skip.
  // 5. Download + validate + stage.
  // 6. Activate atomically.
  function checkForUpdate() {
    // Offline guard (best-effort; navigator.onLine is unreliable in Capacitor,
    // but this is only an optimization — the fetch timeout handles real offline).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve(null);
    }

    return fetchWithTimeout(VERSION_URL + '?_t=' + Date.now(), 10000)
      .then(function (r) {
        return r.json();
      })
      .then(function (manifest) {
        var remoteVersion = parseInt(manifest.version || manifest.build, 10);
        if (isNaN(remoteVersion) || remoteVersion <= 0) {
          return null;
        }

        var currentVersion = getCurrentBuildNumber();
        if (remoteVersion <= currentVersion) {
          console.log('[OTAEngine] No update. Remote v' + remoteVersion + ' <= current v' + currentVersion);
          return null;
        }

        // minNativeVersion gate: if the OTA build needs a newer native
        // API than the installed APK, do NOT apply it (Play Store compliance).
        var minNative = parseInt(manifest.minNativeVersion, 10);
        if (minNative && minNative > 0) {
          return getNativeVersionCode().then(function (nativeCode) {
            var effectiveNative = nativeCode || BUNDLED_NATIVE_VERSION;
            if (effectiveNative < minNative) {
              console.log('[OTAEngine] Skipping v' + remoteVersion + ': requires native v' + minNative + ', installed v' + effectiveNative);
              return null;
            }
            return remoteVersion;
          });
        }
        return remoteVersion;
      })
      .then(function (targetVersion) {
        if (!targetVersion) return null;
        if (isVersionPoisoned(targetVersion)) {
          console.log('[OTAEngine] Skipping v' + targetVersion + ': poisoned build.');
          return null;
        }
        // Download + stage + activate.
        return downloadAndStage(targetVersion).then(activateStaged);
      })
      .catch(function (e) {
        // Any failure (network, validation, IDB) is non-fatal: the app
        // keeps running on its current version. Never throw to the caller.
        console.warn('[OTAEngine] Update check failed (non-fatal):', e);
        return null;
      });
  }

  // ------------------------------------------------------------
  // Current build number — SOURCE OF TRUTH
  // ------------------------------------------------------------
  // The boot loader sets window.OTA_ACTIVE_VERSION synchronously when it
  // loads an OTA app.js from IndexedDB. This is the authoritative value
  // for "what build is actually running right now".
  //
  // Priority:
  //   1. window.OTA_ACTIVE_VERSION  (set by boot loader after OTA load)
  //   2. bundled CURRENT_BUILD      (the APK's bundled version)
  //
  // This prevents the engine from thinking it is always on the bundled
  // build (1007) after an OTA activation (1008), which would otherwise
  // cause it to re-download the same version forever.
  function getCurrentBuildNumber() {
    if (typeof window !== 'undefined' && window.OTA_ACTIVE_VERSION) {
      var ota = parseInt(window.OTA_ACTIVE_VERSION, 10);
      if (!isNaN(ota) && ota > 0) return ota;
    }
    if (typeof CURRENT_BUILD !== 'undefined') {
      var parsed = parseInt(CURRENT_BUILD, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 1;
  }

  // ------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------
  function initOTACheck() {
    // Run after a delay so startup is instant with zero flicker.
    setTimeout(function () {
      checkForUpdate();
    }, INITIAL_DELAY_MS);

    // Re-check periodically while the app is open.
    setInterval(function () {
      checkForUpdate();
    }, CHECK_INTERVAL_MS);
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  return {
    initOTACheck: initOTACheck,
    checkForUpdate: checkForUpdate,
    downloadAndStage: downloadAndStage,
    activateStaged: activateStaged,
    getCurrentBuildNumber: getCurrentBuildNumber,
    isVersionPoisoned: isVersionPoisoned,
    addPoisoned: addPoisoned,
    // Expose constants for debugging / tests
    DB_NAME: DB_NAME,
    KEY_ACTIVE: KEY_ACTIVE,
    KEY_STAGING: KEY_STAGING,
    KEY_POISONED: KEY_POISONED,
    KEY_FAIL_COUNT: KEY_FAIL_COUNT,
    MAX_ASSET_SIZE: MAX_ASSET_SIZE
  };
})();

// ------------------------------------------------------------
// Auto-run: start the background OTA check.
// Only runs when the boot loader is present (OTA-enabled index.html).
// The boot loader loads OTAEngine.js BEFORE app.js, so this runs
// immediately. The engine itself waits INITIAL_DELAY_MS before the
// first check, so startup stays instant with zero flicker.
// ------------------------------------------------------------
if (window.OTABootLoader) {
  window.OTAEngine.initOTACheck();
}
