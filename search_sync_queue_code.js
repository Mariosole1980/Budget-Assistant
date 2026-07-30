const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = 0;
while ((idx = appJs.indexOf('enqueueSyncMutation', idx)) !== -1) {
  console.log("Found enqueueSyncMutation at pos:", idx);
  console.log(appJs.substring(Math.max(0, idx - 50), idx + 250));
  console.log("-----------------------------------------------");
  idx += 'enqueueSyncMutation'.length;
}

idx = 0;
while ((idx = appJs.indexOf('flush', idx)) !== -1) {
  if (appJs.substring(idx, idx + 30).toLowerCase().includes('sync')) {
    console.log("Found flush sync at pos:", idx);
    console.log(appJs.substring(Math.max(0, idx - 50), idx + 250));
    console.log("-----------------------------------------------");
  }
  idx += 'flush'.length;
}
