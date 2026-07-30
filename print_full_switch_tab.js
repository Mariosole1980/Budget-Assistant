const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const idx = appJs.indexOf('function switchTab(');
if (idx !== -1) {
  console.log(appJs.substring(idx, idx + 2500));
}
