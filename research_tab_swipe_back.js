const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("=== Searching switchTab / showScreen definition ===");
let idx = 0;
while ((idx = appJs.indexOf('function showScreen', idx)) !== -1) {
  console.log(appJs.substring(idx, idx + 1000));
  console.log("-----------------------------------------------");
  idx += 'function showScreen'.length;
}

idx = 0;
while ((idx = appJs.indexOf('function switchTab', idx)) !== -1) {
  console.log(appJs.substring(idx, idx + 1000));
  console.log("-----------------------------------------------");
  idx += 'function switchTab'.length;
}
