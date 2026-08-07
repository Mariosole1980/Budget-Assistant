// Bump www/ deployed copies from v1139 -> v1140.
const fs = require('fs');

const OLD = 1139;
const NEW = 1140;

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

// www/index.html
bumpFile('www/index.html', [
    [`build v${OLD}`, `build v${NEW}`],
    [`const CURRENT_BUILD = ${OLD};`, `const CURRENT_BUILD = ${NEW};`],
]);

// www/app.js
bumpFile('www/app.js', [[`build v${OLD}`, `build v${NEW}`]]);

// www/sw.js
bumpFile('www/sw.js', [[`SW Version ${OLD}`, `SW Version ${NEW}`]]);

// www/version.json (url + version fields)
bumpFile('www/version.json', [
    [`1.0.${OLD}.zip`, `1.0.${NEW}.zip`],
    [`"version":  "1.0.${OLD}"`, `"version":  "1.0.${NEW}"`],
]);

console.log(`\nwww/ copies bumped from v${OLD} to v${NEW}.`);
