const fs = require('fs');

const wwwHtmlExists = fs.existsSync('c:/Users/mario/Desktop/money-manager/www/index.html');
const wwwJsExists = fs.existsSync('c:/Users/mario/Desktop/money-manager/www/app.js');

console.log("www/index.html exists:", wwwHtmlExists);
console.log("www/app.js exists:", wwwJsExists);

if (wwwHtmlExists) {
  const html = fs.readFileSync('c:/Users/mario/Desktop/money-manager/www/index.html', 'utf8');
  console.log("www/index.html contains malformed div:", html.includes('<div   </div>'));
}
