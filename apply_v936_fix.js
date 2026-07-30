const fs = require('fs');

const indexHtmlPath = 'c:/Users/mario/Desktop/money-manager/index.html';
const swPath = 'c:/Users/mario/Desktop/money-manager/sw.js';
const vJsonPath = 'c:/Users/mario/Desktop/money-manager/version.json';
const wwwVJsonPath = 'c:/Users/mario/Desktop/money-manager/www/version.json';

// 1. Remove malformed `<div   </div>` in index.html
let html = fs.readFileSync(indexHtmlPath, 'utf8');

if (!html.includes('<div   </div>')) {
  console.error("ERROR: Could not find '<div   </div>' in index.html!");
  process.exit(1);
}

html = html.replace('<div   </div>', '');

// 2. Bump version references to 936
html = html.replace(/Έκδοση 1\.0\.0 \(build v\d+\)/g, 'Έκδοση 1.0.0 (build v936)');

// 3. Inject cache buster for v936 before </body>
const cbScript = `
  <script>
    // Aggressive Cache Buster for v936
    (async function() {
      if (!localStorage.getItem('cacheBusted_v936')) {
        console.log("Busting PWA cache for v936...");
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
        localStorage.setItem('cacheBusted_v936', 'true');
        window.location.reload(true);
      }
    })();
  </script>
`;

if (html.includes('cacheBusted_v936')) {
  console.log("Cache buster v936 already present.");
} else {
  html = html.replace('</body>', cbScript + '\n</body>');
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log("Updated index.html successfully.");

// 4. Update sw.js CACHE_NAME
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE_NAME = 'budget-tracker-v\d+';/g, "const CACHE_NAME = 'budget-tracker-v936';");
fs.writeFileSync(swPath, sw, 'utf8');
console.log("Updated sw.js successfully.");

// 5. Update version.json
const vObj = { version: 936 };
fs.writeFileSync(vJsonPath, JSON.stringify(vObj, null, 2), 'utf8');
try {
  fs.writeFileSync(wwwVJsonPath, JSON.stringify(vObj, null, 2), 'utf8');
} catch(e) {}
console.log("Updated version.json to v936 successfully.");
