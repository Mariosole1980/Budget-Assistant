const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const idx = appJs.indexOf('const prevTabName = state.activeTab;');
if (idx !== -1) {
  console.log(appJs.substring(idx - 50, idx + 400));
} else {
  console.log("prevTabName not found!");
}
