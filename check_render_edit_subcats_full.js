const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = appJs.indexOf('function renderEditCategorySubcategories');
console.log(appJs.substring(idx, idx + 2000));
