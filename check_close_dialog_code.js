const fs = require('fs');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const pos = 396470;
console.log(appJs.substring(pos - 50, pos + 500));
