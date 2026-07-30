const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = appJs.indexOf('function closeModal(id)');
console.log(appJs.substring(idx, idx + 1200));
