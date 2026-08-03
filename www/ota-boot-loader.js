/**
 * ============================================================
 * OTA BOOT LOADER — v1 conservative (REVIEW DRAFT)
 * ============================================================
 * Purpose: Decide at boot whether to load the OTA app.js+style.css
 *          (from IndexedDB via Blob URL) OR the bundled app.js.
 *
 * CRITICAL RULE: EXACTLY ONE app.js loads. Never both.
 *   - OTA valid  -> load OTA app.js (skip bundled)
 *   - OTA error  -> load bundled app.js (fallback)
 *
 * v1 scope (conservative):
 *   - ONLY app.js + style.css + version metadata
 *   - NO index.html replacement, NO modules, NO native changes
 *
 * This file is the REVIEW DRAFT. It is NOT yet wired into index.html.
 * The production integration replaces ONLY the line:
 *     <script src="app.js?v=1037"></script>
 * with an inline <script> that calls window.OTABootLoader.boot().
 * ============================================================
 */
window.OTABootLoader = (function () {
    'use strict';

    // ------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------
    var DB_NAME = 'ota_assets_db';
    var DB_VERSION = 1;
    var STORE = 'assets';
    var KEY_ACTIVE = 'ota_active_build';      // { version, appJs, styleCss, appliedAt }
    var KEY_POISONED = 'ota_poisoned_builds'; // [version, ...]
    var KEY_FAIL_COUNT = 'ota_fail_count';    // number of consecutive failed boots
    var KEY_BOOT_OK = 'ota_boot_ok';          // marker written by app.js on successful boot
    var MAX_FAILURES = 3;                     // rollback threshold
    var IDB_TIMEOUT_MS = 1500;                // hard timeout for IndexedDB lookup

    // Bundled fallback (must match the static tag we replace)
    var BUNDLED_APP_JS = 'app.js?v=1037';
    var BUNDLED_STYLE_CSS = 'style.css?v=1037';

    // ------------------------------------------------------------
    // IndexedDB helpers (promise + timeout)
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
                var req = tx.objectStore(STORE).delete(key);
                req.onsuccess = function () { resolve(); };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    // Wrap any promise with a hard timeout. If it doesn't settle in time,
    // we treat it as "no OTA" and fall back to bundled. This guarantees the
    // app NEVER hangs in a loading state because of IndexedDB.
    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                reject(new Error('IndexedDB lookup timed out after ' + ms + 'ms'));
            }, ms);
            promise.then(function (v) {
                clearTimeout(timer);
                resolve(v);
            }, function (e) {
                clearTimeout(timer);
                reject(e);
            });
        });
    }

    // ------------------------------------------------------------
    // localStorage helpers (rollback state)
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
    // Blob URL loaders (NO eval)
    // ------------------------------------------------------------
    function loadScriptFromBlob(code) {
        return new Promise(function (resolve, reject) {
            try {
                var blob = new Blob([code], { type: 'text/javascript' });
                var url = URL.createObjectURL(blob);
                var script = document.createElement('script');
                script.src = url;
                script.onload = function () { resolve(); };
                script.onerror = function () { reject(new Error('Blob script load error')); };
                document.head.appendChild(script);
            } catch (e) { reject(e); }
        });
    }

    function loadStyleFromBlob(code) {
        return new Promise(function (resolve, reject) {
            try {
                var blob = new Blob([code], { type: 'text/css' });
                var url = URL.createObjectURL(blob);
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.onload = function () { resolve(); };
                link.onerror = function () { reject(new Error('Blob style load error')); };
                document.head.appendChild(link);
            } catch (e) { reject(e); }
        });
    }

    // ------------------------------------------------------------
    // Legacy recovery watchdog
    // ------------------------------------------------------------
    // The old synchronous <script src="app.js"> relied on a 4s watchdog in
    // index.html (window._startupTimeout) that fires if window._appLoaded is
    // not true. With the async boot loader, app.js is injected AFTER an
    // IndexedDB lookup, so the watchdog can fire spuriously even when the
    // app is healthy. We clear it the moment we inject the chosen app.js.
    // NOTE: This is INDEPENDENT of the rollback system. The real health
    // signal for rollback is markBootOk(), called at the end of app.js.
    function markAppInjected() {
        window._appLoaded = true;
        if (window._startupTimeout) {
            clearTimeout(window._startupTimeout);
            window._startupTimeout = null;
        }
    }

    // ------------------------------------------------------------
    // Rollback feedback toast
    // ------------------------------------------------------------
    // When the boot loader rolls back to the bundled build (poisoned build
    // or failure threshold exceeded), show a brief non-blocking toast so the
    // user is not left staring at a black screen with no feedback.
    function showRollbackToast(message) {
        try {
            var existing = document.getElementById('ota-rollback-toast');
            if (existing) existing.remove();
            var toast = document.createElement('div');
            toast.id = 'ota-rollback-toast';
            toast.textContent = message || 'Επαναφορά προηγούμενης έκδοσης…';
            toast.style.cssText =
                'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
                'background:#1f2937;color:#e5e7eb;padding:10px 18px;border-radius:8px;' +
                'font-size:13px;font-weight:600;z-index:9999999;box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
                'border:1px solid #374151;max-width:90%;text-align:center;';
            document.body.appendChild(toast);
            setTimeout(function () {
                var t = document.getElementById('ota-rollback-toast');
                if (t) t.remove();
            }, 3500);
        } catch (e) { /* best-effort */ }
    }

    // ------------------------------------------------------------
    // Bundled fallback loader (classic script tag, same as today)
    // ------------------------------------------------------------
    function loadBundledApp() {
        return new Promise(function (resolve, reject) {
            // Guard flag: exactly one app.js may load per page lifetime.
            window.__OTA_APP_LOADED = true;
            // Clear the legacy recovery watchdog: the chosen app.js is now
            // being injected. markBootOk() (at the end of app.js) remains the
            // authoritative health signal for rollback.
            markAppInjected();
            var script = document.createElement('script');
            script.src = BUNDLED_APP_JS;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error('Bundled app.js load error')); };
            document.head.appendChild(script);
        });
    }

    // ------------------------------------------------------------
    // Rollback bookkeeping
    // ------------------------------------------------------------
    // Called at the START of boot when an OTA build is about to be used.
    // Increments the failure counter. If it exceeds MAX_FAILURES, the build
    // is poisoned and we fall back to bundled.
    function registerBootAttempt(version) {
        var count = parseInt(lsGet(KEY_FAIL_COUNT) || '0', 10);
        if (isNaN(count)) count = 0;
        count += 1;
        lsSet(KEY_FAIL_COUNT, String(count));
        if (count > MAX_FAILURES) {
            addPoisoned(version);
            // KEY_ACTIVE lives in IndexedDB, not localStorage. Remove it there
            // so the poisoned build is not re-selected on the next boot.
            idbDelete(KEY_ACTIVE).catch(function () { /* best-effort */ });
            lsRemove(KEY_FAIL_COUNT);
            return false; // rollback
        }
        return true;
    }

    // Called by app.js AFTER successful initialization (see below).
    // Resets the failure counter so a healthy build never rolls back.
    function markBootOk() {
        lsRemove(KEY_FAIL_COUNT);
        lsSet(KEY_BOOT_OK, '1');
    }

    // ------------------------------------------------------------
    // MAIN BOOT DECISION
    // ------------------------------------------------------------
    // Returns a Promise. On resolve, EXACTLY ONE app.js has been injected.
    function boot() {
        // GUARD FLAG: if an app.js is already loaded (bundled or OTA), do NOT
        // load a second one. This is the last line of defense against the
        // "double app.js" bug. It is set synchronously right before injecting
        // the chosen app.js below.
        if (window.__OTA_APP_LOADED) {
            console.warn('[OTABoot] app.js already loaded; skipping boot loader.');
            return Promise.resolve();
        }

        // 0) If IndexedDB is unavailable entirely, go bundled immediately.
        if (typeof indexedDB === 'undefined') {
            return loadBundledApp();
        }

        // 1) Read active OTA build from IndexedDB with a hard timeout.
        return withTimeout(idbGet(KEY_ACTIVE), IDB_TIMEOUT_MS)
            .then(function (active) {
                // No OTA build staged -> bundled.
                if (!active || !active.version || !active.appJs) {
                    return loadBundledApp();
                }

                // STALE OTA GUARD: Only load the OTA build if it is STRICTLY NEWER
                // than the bundled APK (otaVersion > bundledVersion). If the OTA
                // build is EQUAL to or OLDER than the bundled APK, prefer the
                // bundled app.js. This prevents a stale OTA build (e.g. v1015)
                // cached in IndexedDB from being loaded over a freshly-installed
                // APK that already contains that version's code. The bundled
                // version is read from CURRENT_BUILD, which index.html defines
                // BEFORE calling boot().
                //
                // IMPORTANT: We reject when otaVersion <= bundledVersion (equal OR
                // older). Allowing an equal-version OTA build would let a stale
                // build (e.g. v1015) load over a freshly-installed v1015 APK and
                // display the wrong version. A legitimately-downloaded OTA build is
                // always NEWER than the bundled APK (the engine only downloads when
                // remoteVersion > currentVersion), so rejecting equal/older is safe.
                // CURRENT_BUILD is declared with `const` in index.html, which creates
                // a global lexical binding (NOT a window property). So we read it via
                // `typeof CURRENT_BUILD` (same as getCurrentBuildNumber() in OTAEngine),
                // falling back to window.CURRENT_BUILD if it was explicitly exposed.
                var bundledVersion = (typeof CURRENT_BUILD !== 'undefined')
                    ? parseInt(CURRENT_BUILD, 10)
                    : ((typeof window !== 'undefined' && typeof window.CURRENT_BUILD !== 'undefined')
                        ? parseInt(window.CURRENT_BUILD, 10) : 0);
                var otaVersion = parseInt(active.version, 10);
                if (bundledVersion > 0 && otaVersion > 0 && otaVersion <= bundledVersion) {
                    console.log('[OTABoot] Stale OTA v' + otaVersion + ' <= bundled v' + bundledVersion + '. Using bundled app.js.');
                    // Clear the stale OTA build so it is not re-selected next boot.
                    idbDelete(KEY_ACTIVE).catch(function () { /* best-effort */ });
                    return loadBundledApp();
                }

                // Poisoned build -> bundled (and clear it from IndexedDB).
                if (isPoisoned(active.version)) {
                    idbDelete(KEY_ACTIVE).catch(function () { /* best-effort */ });
                    showRollbackToast('Η ενημέρωση v' + active.version + ' απορρίφθηκε. Επαναφορά προηγούμενης έκδοσης…');
                    return loadBundledApp();
                }

                // Rollback check: increment failure counter; if exceeded, poison.
                if (!registerBootAttempt(active.version)) {
                    console.warn('[OTABoot] v' + active.version + ' exceeded failure threshold. Rolling back to bundled.');
                    showRollbackToast('Η ενημέρωση v' + active.version + ' απέτυχε. Επαναφορά προηγούμενης έκδοσης…');
                    return loadBundledApp();
                }

                // 2) OTA path: load OTA style.css, then OTA app.js.
                //    We do NOT load the bundled app.js. Exactly one app.js runs.
                var stylePromise = active.styleCss
                    ? loadStyleFromBlob(active.styleCss)
                    : Promise.resolve(); // style.css optional in v1

                return stylePromise
                    .then(function () {
                        // Guard flag: exactly one app.js may load per page lifetime.
                        window.__OTA_APP_LOADED = true;
                        // Clear the legacy recovery watchdog: the OTA app.js is
                        // now being injected. markBootOk() (at the end of app.js)
                        // remains the authoritative health signal for rollback.
                        markAppInjected();
                        return loadScriptFromBlob(active.appJs);
                    })
                    .then(function () {
                        console.log('[OTABoot] Loaded OTA app.js v' + active.version + ' from IndexedDB via Blob URL.');
                        // Expose the active version for the UI badge / debugging.
                        window.OTA_ACTIVE_VERSION = active.version;
                        return;
                    });
            })
            .catch(function (err) {
                // ANY error (IDB timeout, corrupt data, blob failure) -> bundled fallback.
                console.warn('[OTABoot] OTA load failed, falling back to bundled:', err);
                return loadBundledApp();
            });
    }

    // ------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------
    return {
        boot: boot,
        markBootOk: markBootOk,
        registerBootAttempt: registerBootAttempt,
        isPoisoned: isPoisoned,
        addPoisoned: addPoisoned,
        getPoisonedList: getPoisonedList,
        DB_NAME: DB_NAME,
        KEY_ACTIVE: KEY_ACTIVE,
        KEY_BOOT_OK: KEY_BOOT_OK,
        KEY_FAIL_COUNT: KEY_FAIL_COUNT,
        MAX_FAILURES: MAX_FAILURES
    };
})();
