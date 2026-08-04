// Web-only version bump: v1048 -> v1049 (Main Currency card now shows all currencies).
// This forces the OTA engine to re-download app.js because the previous v1048
// build hardcoded only 4 currencies (EUR/USD/GBP/JPY) in the "Κύριο Νόμισμα"
// (Primary Currency) and "Νόμισμα Εμφάνισης" (Display Currency) settings cards.
// The fix now builds the options from CurrencyService.getCurrencies() so all
// available currencies (EUR, USD, GBP, JPY, CHF, CAD, AUD) appear.
// Since the OTA engine only updates when remoteVersion > currentVersion, we MUST
// bump the version so devices on v1048 re-download the fixed app.js.
// OTAEngine.js BUNDLED_NATIVE_VERSION is intentionally left at 1046 (no APK rebuild).
const fs = require('fs');

const OLD = 1048;
const NEW = 1049;

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
