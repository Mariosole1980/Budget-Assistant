const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');
const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

console.log("=== ISSUE 4: Lines around 22367 in app.js ===");
const lines = appJs.split('\n');
console.log("Total lines in app.js:", lines.length);
if (lines.length >= 22360) {
  for (let i = Math.max(0, 22350); i < Math.min(lines.length, 22380); i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log("Showing last 30 lines of app.js:");
  for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}

console.log("\n=== ISSUE 4: Searching User Guide functions ===");
let idx = 0;
while ((idx = appJs.indexOf('UserGuide', idx)) !== -1) {
  console.log("Found UserGuide at pos:", idx, "->", appJs.substring(Math.max(0, idx - 50), idx + 150).replace(/\n/g, ' '));
  idx += 'UserGuide'.length;
}

console.log("\n=== ISSUE 6: Startup / Auth / Startup Modal Visibility ===");
// Check where auth overlay or add transaction modal is shown at startup
idx = 0;
while ((idx = appJs.indexOf('showAuthModal', idx)) !== -1) {
  console.log("Found showAuthModal at:", idx, "->", appJs.substring(Math.max(0, idx - 50), idx + 150).replace(/\n/g, ' '));
  idx += 'showAuthModal'.length;
}

console.log("\n=== ISSUE 5: App Preferences Modal HTML & CSS ===");
const prefModalIdx = indexHtml.indexOf('id="preferences-subscreen"') !== -1 ? indexHtml.indexOf('id="preferences-subscreen"') : indexHtml.indexOf('id="preferences');
if (prefModalIdx !== -1) {
  console.log(indexHtml.substring(prefModalIdx, prefModalIdx + 300));
} else {
  console.log("Preferences subscreen HTML not found by exact ID, searching 'preferences'");
  let pIdx = 0;
  while ((pIdx = indexHtml.indexOf('preferences', pIdx)) !== -1) {
    if (indexHtml.substring(pIdx - 10, pIdx + 30).includes('id=')) {
      console.log("HTML match:", indexHtml.substring(pIdx - 20, pIdx + 150));
    }
    pIdx += 'preferences'.length;
  }
}
