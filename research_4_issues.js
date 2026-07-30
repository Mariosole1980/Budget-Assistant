const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');
const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const styleCss = fs.readFileSync('c:/Users/mario/Desktop/money-manager/style.css', 'utf8');

console.log("=== 1. User Guide Z-Index vs Subscreen Modal Z-Index ===");
let idx = 0;
while ((idx = styleCss.indexOf('user-guide-modal', idx)) !== -1) {
  console.log(styleCss.substring(Math.max(0, idx - 50), idx + 200));
  console.log("-----------------------------------------------");
  idx += 'user-guide-modal'.length;
}

idx = 0;
while ((idx = styleCss.indexOf('settings-subscreen-modal', idx)) !== -1) {
  console.log(styleCss.substring(Math.max(0, idx - 50), idx + 200));
  console.log("-----------------------------------------------");
  idx += 'settings-subscreen-modal'.length;
}

console.log("=== 2. Tab Navigation & Popstate ===");
idx = 0;
while ((idx = appJs.indexOf('showScreen(', idx)) !== -1) {
  console.log("Found showScreen call at:", idx, "->", appJs.substring(Math.max(0, idx - 40), idx + 250).replace(/\n/g, ' '));
  idx += 'showScreen('.length;
}

console.log("=== 3. Subscreen Preferences CSS ===");
idx = 0;
while ((idx = styleCss.indexOf('.subscreen-card', idx)) !== -1) {
  console.log(styleCss.substring(idx, idx + 400));
  console.log("-----------------------------------------------");
  idx += '.subscreen-card'.length;
}

console.log("=== 4. Supabase Sync Indicator & Gray Dot Logic ===");
idx = 0;
while ((idx = appJs.indexOf('updateSyncStatusIndicator', idx)) !== -1) {
  console.log("Found updateSyncStatusIndicator at:", idx);
  console.log(appJs.substring(idx, idx + 600));
  console.log("-----------------------------------------------");
  idx += 'updateSyncStatusIndicator'.length;
}
