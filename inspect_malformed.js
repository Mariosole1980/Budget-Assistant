const fs = require('fs');
const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/index.html', 'utf8');

const pos = 69026;
console.log(html.substring(pos - 300, pos + 300));
