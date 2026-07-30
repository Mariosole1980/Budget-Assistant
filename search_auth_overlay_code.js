const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('auth-overlay', idx)) !== -1) {
  console.log("Found auth-overlay at:", idx);
  console.log(appJs.substring(Math.max(0, idx - 100), idx + 300).replace(/\n/g, ' '));
  console.log("-----------------------------------------------");
  idx += 'auth-overlay'.length;
}
