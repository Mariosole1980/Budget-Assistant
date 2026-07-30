const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const idx = html.indexOf('id="hub-row-categories"');
console.log(html.substring(Math.max(0, idx - 100), idx + 400));
