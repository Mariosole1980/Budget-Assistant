const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');
const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const styleCss = fs.readFileSync('c:/Users/mario/Desktop/money-manager/style.css', 'utf8');

console.log("=== Searching openSettingsSubscreen ===");
let idx = 0;
while ((idx = appJs.indexOf('openSettingsSubscreen', idx)) !== -1) {
  console.log(appJs.substring(idx, idx + 600));
  console.log("-----------------------------------------------");
  idx += 'openSettingsSubscreen'.length;
}

console.log("=== Searching preferences-subscreen in indexHtml ===");
idx = indexHtml.indexOf('id="preferences-subscreen"');
if (idx !== -1) {
  console.log(indexHtml.substring(Math.max(0, idx - 100), idx + 800));
} else {
  console.log("Not found preferences-subscreen in HTML");
}
