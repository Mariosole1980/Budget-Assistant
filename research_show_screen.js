const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('showScreen', idx)) !== -1) {
  console.log("Found showScreen at pos:", idx);
  console.log(appJs.substring(idx, idx + 600));
  console.log("-----------------------------------------------");
  idx += 'showScreen'.length;
}
