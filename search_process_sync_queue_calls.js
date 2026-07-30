const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('processSyncQueue(', idx)) !== -1) {
  console.log("Found processSyncQueue call at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 100), idx + 200));
  console.log("-----------------------------------------------");
  idx += 'processSyncQueue('.length;
}
