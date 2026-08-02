/**
 * OTA dry-run app.js — v1009 (BROKEN BUILD — for rollback test)
 * ============================================================
 * This is a DELIBERATELY BROKEN app.js used ONLY for the rollback test.
 *
 * It passes OTAEngine validation (contains "const state", size >= 1000,
 * not an HTML error page) so it gets downloaded, staged and ACTIVATED.
 *
 * BUT it does NOT call markBootOk() and it throws an error, simulating a
 * broken update. This is what triggers the boot loader's rollback:
 *   - Each app start increments the failure counter (registerBootAttempt).
 *   - After MAX_FAILURES (3) consecutive failed boots, v1009 is poisoned
 *     and the app rolls back to the bundled v1007.
 *
 * DO NOT deploy this to production. This is a test artifact.
 * ============================================================
 */
const state = {
    version: 1009,
    source: 'OTA-dryrun-BROKEN',
    transactions: [],
    accounts: [],
    lang: 'el'
};

(function () {
    'use strict';

    // This build is intentionally broken. It does NOT call markBootOk(),
    // so the boot loader's failure counter keeps incrementing on every
    // app start until the rollback threshold (MAX_FAILURES = 3) is reached.

    // Simulate a runtime crash in the app initialization.
    // This makes the app visibly fail (blank screen) so the user can
    // confirm the broken build is actually running before rollback.
    throw new Error('[OTA-dryrun] v1009 is a DELIBERATELY BROKEN build for rollback testing.');

    // NOTE: The code below never runs because of the throw above.
    // It exists only to keep the file size above MIN_APP_JS_SIZE and to
    // document the intended (healthy) behavior for comparison.
    function neverCalled() {
        var banner = document.createElement('div');
        banner.id = 'ota-dryrun-banner';
        banner.textContent = '❌ OTA v1009 BROKEN — this should never render';
        document.body.appendChild(banner);
    }
    neverCalled();
})();
