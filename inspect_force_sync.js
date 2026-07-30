const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

let idx = appJs.indexOf('async function forceSyncNow');
if (idx !== -1) {
  console.log(appJs.substring(idx, idx + 1200));
} else {
  console.log("forceSyncNow function not found with async, searching forceSyncNow:");
  idx = appJs.indexOf('forceSyncNow');
  if (idx !== -1) {
    console.log(appJs.substring(idx, idx + 1200));
  }
}
