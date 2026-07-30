const fs = require('fs');
const vPath = 'c:/Users/mario/Desktop/money-manager/version.json';
const swPath = 'c:/Users/mario/Desktop/money-manager/sw.js';
const wwwVPath = 'c:/Users/mario/Desktop/money-manager/www/version.json';

// Update version.json
let vObj = JSON.parse(fs.readFileSync(vPath, 'utf8'));
vObj.version = 935;
fs.writeFileSync(vPath, JSON.stringify(vObj, null, 2), 'utf8');
try { fs.writeFileSync(wwwVPath, JSON.stringify(vObj, null, 2), 'utf8'); } catch(e){}

// Update sw.js
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE_NAME = 'budget-tracker-v\\d+';/g, "const CACHE_NAME = 'budget-tracker-v935';");
fs.writeFileSync(swPath, sw, 'utf8');

// Inject cache buster in index.html
let html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const cbStr = `
  <script>
    // Aggressive Cache Buster for v935
    (async function() {
      if (!localStorage.getItem('cacheBusted_v935')) {
        console.log("Busting PWA cache for v935...");
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
        localStorage.setItem('cacheBusted_v935', 'true');
        window.location.reload(true);
      }
    })();
  </script>
</body>`;
html = html.replace('</body>', cbStr);
html = html.replace(/Έκδοση 1\.0\.0 \(build v\d+\)/g, 'Έκδοση 1.0.0 (build v935)');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/index.html', html, 'utf8');
console.log('Version bumped to 935 and cache buster injected.');
