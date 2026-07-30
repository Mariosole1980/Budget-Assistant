const fs = require('fs');

const indexHtml = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("=== Bottom Nav Items in index.html ===");
let idx = 0;
while ((idx = indexHtml.indexOf('nav-item', idx)) !== -1) {
  console.log(indexHtml.substring(Math.max(0, idx - 20), idx + 200).replace(/\n/g, ' '));
  console.log("-----------------------------------------------");
  idx += 'nav-item'.length;
}

console.log("=== Nav Tab Click Handlers in app.js ===");
idx = 0;
while ((idx = appJs.indexOf('nav-item', idx)) !== -1) {
  console.log("Found nav-item in app.js at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 40), idx + 250).replace(/\n/g, ' '));
  console.log("-----------------------------------------------");
  idx += 'nav-item'.length;
}
