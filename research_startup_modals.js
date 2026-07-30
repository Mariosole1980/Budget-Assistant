const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("=== Searching DOMContentLoaded & initApp ===");
let idx = 0;
while ((idx = appJs.indexOf('DOMContentLoaded', idx)) !== -1) {
  console.log("Found DOMContentLoaded at:", idx);
  console.log(appJs.substring(idx, idx + 1000));
  console.log("-----------------------------------------------");
  idx += 'DOMContentLoaded'.length;
}

idx = 0;
while ((idx = appJs.indexOf('openModal', idx)) !== -1) {
  const line = appJs.substring(Math.max(0, idx - 50), idx + 80).replace(/\n/g, ' ');
  if (line.includes('add-transaction') || line.includes('quick-add') || line.includes('setup') || line.includes('welcome') || line.includes('auth')) {
    console.log("Found openModal call:", line);
  }
  idx += 'openModal'.length;
}
