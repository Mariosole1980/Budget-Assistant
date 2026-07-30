const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');
const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("In index.html:", html.includes('subscreen-categories'));
console.log("In app.js:", appJs.includes('subscreen-categories'));
