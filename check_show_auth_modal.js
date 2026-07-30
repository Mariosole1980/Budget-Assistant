const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('AuthModal', idx)) !== -1) {
  console.log(appJs.substring(Math.max(0, idx - 40), idx + 250).replace(/\n/g, ' '));
  console.log("-----------------------------------------------");
  idx += 'AuthModal'.length;
}
