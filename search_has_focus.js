const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('hasFocus()', idx)) !== -1) {
  console.log("Found hasFocus() at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 80), idx + 150));
  console.log("-----------------------------------------");
  idx += 'hasFocus()'.length;
}
