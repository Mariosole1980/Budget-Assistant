const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('function openSettingsSubscreen', idx)) !== -1) {
  console.log("Found openSettingsSubscreen at pos:", idx);
  console.log(appJs.substring(idx, idx + 800));
  console.log("==========================================");
  idx += 'function openSettingsSubscreen'.length;
}
