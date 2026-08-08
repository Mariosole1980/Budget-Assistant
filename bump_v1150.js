// Bump all source + www copies from v1149 -> v1150.
const fs = require('fs');

const OLD = 1149;
const NEW = 1150;

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

// --- Source files ---

// app.js
bumpFile('app.js', [[`build v${OLD}`, `build v${NEW}`]]);

// index.html
bumpFile('index.html', [
    [`build v${OLD}`, `build v${NEW}`],
    [`const CURRENT_BUILD = ${OLD};`, `const CURRENT_BUILD = ${NEW};`],
    [`sw.js?v=${OLD}`, `sw.js?v=${NEW}`],
]);

// sw.js
bumpFile('sw.js', [[`SW Version ${OLD}`, `SW Version ${NEW}`]]);

// version.json
bumpFile('version.json', [[`"version": ${OLD}`, `"version": ${NEW}`]]);

// build.gradle
bumpFile('android/app/build.gradle', [
    [`versionCode ${OLD}`, `versionCode ${NEW}`],
    [`versionName "1.0.${OLD}"`, `versionName "1.0.${NEW}"`],
]);

// --- www copies ---

// www/app.js
bumpFile('www/app.js', [[`build v${OLD}`, `build v${NEW}`]]);

// www/index.html
bumpFile('www/index.html', [
    [`build v${OLD}`, `build v${NEW}`],
    [`const CURRENT_BUILD = ${OLD};`, `const CURRENT_BUILD = ${NEW};`],
    [`sw.js?v=${OLD}`, `sw.js?v=${NEW}`],
]);

// www/sw.js
bumpFile('www/sw.js', [[`SW Version ${OLD}`, `SW Version ${NEW}`]]);

// www/version.json (url + version fields)
bumpFile('www/version.json', [
    [`1.0.${OLD}.zip`, `1.0.${NEW}.zip`],
    [`"version":  "1.0.${OLD}"`, `"version":  "1.0.${NEW}"`],
]);

console.log(`\nAll copies bumped from v${OLD} to v${NEW}.`);
