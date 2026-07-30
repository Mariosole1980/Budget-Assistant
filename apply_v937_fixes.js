const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
const indexHtmlPath = 'c:/Users/mario/Desktop/money-manager/index.html';
const swPath = 'c:/Users/mario/Desktop/money-manager/sw.js';
const vJsonPath = 'c:/Users/mario/Desktop/money-manager/version.json';
const wwwVJsonPath = 'c:/Users/mario/Desktop/money-manager/www/version.json';

// 1. Fix app.js: remove `|| !document.hasFocus()` guards that block mobile PWA actions
let appJs = fs.readFileSync(appJsPath, 'utf8');

const countBefore = (appJs.match(/!document\.hasFocus\(\)/g) || []).length;
console.log(`Found ${countBefore} instances of !document.hasFocus() in app.js.`);

// Replace `document.visibilityState === 'hidden' || !document.hasFocus()` with `document.visibilityState === 'hidden'`
appJs = appJs.replace(/document\.visibilityState === 'hidden' \|\| !document\.hasFocus\(\)/g, "document.visibilityState === 'hidden'");

const countAfter = (appJs.match(/!document\.hasFocus\(\)/g) || []).length;
console.log(`Instances remaining after replace: ${countAfter}`);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log("Updated app.js successfully.");

// 2. Fix index.html: add missing inline onclick handlers for hub rows
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Categories row
if (html.includes('id="hub-row-categories"') && !html.includes('id="hub-row-categories" onclick=')) {
  html = html.replace('id="hub-row-categories"', 'id="hub-row-categories" onclick="openSettingsCategoryManager()"');
  console.log("Added inline onclick to hub-row-categories.");
}

// Recurring row
if (html.includes('id="hub-row-recurring"') && !html.includes('id="hub-row-recurring" onclick=')) {
  html = html.replace('id="hub-row-recurring"', 'id="hub-row-recurring" onclick="openRecurringTemplatesModal()"');
  console.log("Added inline onclick to hub-row-recurring.");
}

// Trash row
if (html.includes('id="hub-row-trash"') && !html.includes('id="hub-row-trash" onclick=')) {
  html = html.replace('id="hub-row-trash"', 'id="hub-row-trash" onclick="openTrashBinModal()"');
  console.log("Added inline onclick to hub-row-trash.");
}

// 3. Bump version to v937 and inject cache buster
html = html.replace(/Έκδοση 1\.0\.0 \(build v\d+\)/g, 'Έκδοση 1.0.0 (build v937)');

const cbScript = `
  <script>
    // Aggressive Cache Buster for v937
    (async function() {
      if (!localStorage.getItem('cacheBusted_v937')) {
        console.log("Busting PWA cache for v937...");
        if ('serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
              await registration.unregister();
            }
          } catch(e) { console.error(e); }
        }
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            for (let key of keys) {
              await caches.delete(key);
            }
          } catch(e) { console.error(e); }
        }
        localStorage.setItem('cacheBusted_v937', 'true');
        window.location.reload(true);
      }
    })();
  </script>
`;

if (!html.includes('cacheBusted_v937')) {
  html = html.replace('</body>', cbScript + '\n</body>');
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log("Updated index.html successfully.");

// 4. Update sw.js CACHE_NAME to v937
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE_NAME = 'budget-tracker-v\d+';/g, "const CACHE_NAME = 'budget-tracker-v936';"); // replace v936 or any
sw = sw.replace(/const CACHE_NAME = 'budget-tracker-v\d+';/g, "const CACHE_NAME = 'budget-tracker-v937';");
fs.writeFileSync(swPath, sw, 'utf8');
console.log("Updated sw.js successfully.");

// 5. Update version.json to v937
const vObj = { version: 937 };
fs.writeFileSync(vJsonPath, JSON.stringify(vObj, null, 2), 'utf8');
try {
  fs.writeFileSync(wwwVJsonPath, JSON.stringify(vObj, null, 2), 'utf8');
} catch(e) {}
console.log("Updated version.json to v937 successfully.");
