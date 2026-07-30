const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('function renderEditCategorySubcategories', idx)) !== -1) {
  console.log(appJs.substring(idx, idx + 800));
  console.log("==========================================");
  idx += 'function renderEditCategorySubcategories'.length;
}
