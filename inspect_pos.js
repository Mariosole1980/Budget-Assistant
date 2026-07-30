const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

console.log(html.substring(68950, 69200));
