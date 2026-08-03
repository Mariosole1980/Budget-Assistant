// Web-only version bump script.
// Bumps the version to 1028 for the WEB deployment WITHOUT rebuilding the APK.
// OTAEngine.js BUNDLED_NATIVE_VERSION is intentionally left at 1025 because the
// APK is not being rebuilt (web-only change). The Android/iOS app will OTA-download
// the new app.js (back-arrow close fix + background-tap-to-close for the settings
// subscreen modal), so the native layout is unaffected.
const fs = require('fs');

const OLD = 1027;
const NEW = 1028;

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
    [`style.css?v=1024`, `style.css?v=${NEW}`],
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

console.log(`\nWeb version bumped from v${OLD} to v${NEW}. OTAEngine.js BUNDLED_NATIVE_VERSION left at ${OLD} (no APK rebuild).`);
