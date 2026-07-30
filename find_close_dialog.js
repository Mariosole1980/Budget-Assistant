const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('closeNewCategoryDialog', idx)) !== -1) {
  console.log("Found closeNewCategoryDialog at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 200));
  console.log("---");
  idx += 'closeNewCategoryDialog'.length;
}
