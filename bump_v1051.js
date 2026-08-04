// Web-only version bump: v1050 -> v1051 (CurrencyService.isEnabled crash fix).
// This forces the OTA engine to re-download app.js + js/CurrencyService.js
// because devices on v1050 still crash on the web with
// "CurrencyService.isEnabled is not a function".
//
// ROOT CAUSE: A stale OTA app.js (v1050) cached in IndexedDB, or a stale
// js/CurrencyService.js served from the service-worker cache, predates the
// self-healing bootstrap guard. Because the OTA engine only re-downloads when
// remoteVersion > currentVersion, devices stuck on the broken cached build
// (remote v1050 <= current v1050) never receive the fix.
//
// FIX:
//   1) app.js bootstrap guard is hardened: it now installs a complete inline
//      fallback synchronously AND runs a self-healing watchdog that re-verifies
//      window.CurrencyService after the async js/CurrencyService.js load, so a
//      stale cached file can NEVER clobber it with an incomplete instance.
//   2) updateSettingsDisplay() (the exact crash site) now defensively re-binds
//      CurrencyService from window if it is missing isEnabled.
//   3) Bump to v1051 so the OTA engine + service worker re-download the fixed
//      app.js and js/CurrencyService.js, clearing the stale cached builds.
//
// OTAEngine.js BUNDLED_NATIVE_VERSION is intentionally left at 1046 (no APK rebuild).
const fs = require('fs');

const OLD = 1050;
const NEW = 1051;

function bumpFile(path, replacements) {
    if (!fs.existsSync(path)) {
        console.log(`SKIP (missing): ${path}`);
        return;
    }
    let content = fs.readFileSync(path, 'utf8');
    let changed = false;
    for (const [pattern, replacement] of replacements) {
        if (content.includes(pattern)) {
            content = content.split(pattern).join(replacement);
            changed = true;
        } else {
            console.log(`  NOT FOUND in ${path}: ${pattern}`);
        }
    }
    if (changed) {
        fs.writeFileSync(path, content);
        console.log(`UPDATED: ${path}`);
    } else {
        console.log(`NO CHANGE: ${path}`);
    }
}

// version.json
bumpFile('version.json', [[`{"version": ${OLD}}`, `{"version": ${NEW}}`]]);

// index.html
bumpFile('index.html', [
    [`build v${OLD}`, `build v${NEW}`],
    [`const CURRENT_BUILD = ${OLD};`, `const CURRENT_BUILD = ${NEW};`],
    [`style.css?v=${OLD}`, `style.css?v=${NEW}`],
    [`sw.js?v=${OLD}`, `sw.js?v=${NEW}`],
    [`app.js?v=${OLD}`, `app.js?v=${NEW}`],
    [`ota-boot-loader.js?v=${OLD}`, `ota-boot-loader.js?v=${NEW}`],
    [`OTAEngine.js?v=${OLD}`, `OTAEngine.js?v=${NEW}`],
    [`capacitor.js?v=${OLD}`, `capacitor.js?v=${NEW}`],
    [`xlsx.full.min.js?v=${OLD}`, `xlsx.full.min.js?v=${NEW}`],
    [`NLPProcessor.js?v=${OLD}`, `NLPProcessor.js?v=${NEW}`],
    [`MemoryEngine.js?v=${OLD}`, `MemoryEngine.js?v=${NEW}`],
    [`DecisionEngine.js?v=${OLD}`, `DecisionEngine.js?v=${NEW}`],
    [`OnlineAIProvider.js?v=${OLD}`, `OnlineAIProvider.js?v=${NEW}`],
    [`AIEngine.js?v=${OLD}`, `AIEngine.js?v=${NEW}`],
    [`IntentCorpus.js?v=${OLD}`, `IntentCorpus.js?v=${NEW}`],
    [`KnowledgeGraph.js?v=${OLD}`, `KnowledgeGraph.js?v=${NEW}`],
    [`CurrencyService.js?v=${OLD}`, `CurrencyService.js?v=${NEW}`],
]);

// app.js
bumpFile('app.js', [[`build v${OLD}`, `build v${NEW}`]]);

// sw.js
bumpFile('sw.js', [[`SW Version ${OLD}`, `SW Version ${NEW}`]]);

// ota-boot-loader.js
bumpFile('ota-boot-loader.js', [
    [`app.js?v=${OLD}`, `app.js?v=${NEW}`],
    [`style.css?v=${OLD}`, `style.css?v=${NEW}`],
]);

console.log(`\nWeb version bumped from v${OLD} to v${NEW}. OTAEngine.js BUNDLED_NATIVE_VERSION left at 1046 (no APK rebuild).`);
