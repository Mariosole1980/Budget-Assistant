const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("=== popstate listener ===");
let idx = 0;
while ((idx = appJs.indexOf('popstate', idx)) !== -1) {
  console.log("Found popstate at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 800));
  console.log("-----------------------------------------------");
  idx += 'popstate'.length;
}

console.log("=== closeModal function ===");
idx = appJs.indexOf('function closeModal(');
if (idx !== -1) {
  console.log(appJs.substring(idx, idx + 1200));
}

console.log("=== triggerBackAction function ===");
idx = appJs.indexOf('function triggerBackAction(');
if (idx !== -1) {
  console.log(appJs.substring(idx, idx + 1200));
}
