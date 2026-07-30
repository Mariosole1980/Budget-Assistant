const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("=== Searching resume listeners in app.js ===");
let idx = 0;
while ((idx = appJs.indexOf('visibilityState', idx)) !== -1) {
  console.log("Found visibilityState at:", idx);
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 300));
  console.log("-----------------------------------------------");
  idx += 'visibilityState'.length;
}

idx = 0;
while ((idx = appJs.indexOf('window._appJustResumed', idx)) !== -1) {
  console.log("Found _appJustResumed at:", idx);
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 300));
  console.log("-----------------------------------------------");
  idx += 'window._appJustResumed'.length;
}
