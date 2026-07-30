const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("Checking for 'hasFocus':");
let idx = 0;
while ((idx = appJs.indexOf('hasFocus', idx)) !== -1) {
  console.log("Found at", idx, ":", appJs.substring(Math.max(0, idx - 50), idx + 100).replace(/\n/g, ' '));
  idx += 'hasFocus'.length;
}

console.log("\nChecking for '_appJustResumed':");
idx = 0;
while ((idx = appJs.indexOf('_appJustResumed', idx)) !== -1) {
  console.log("Found at", idx, ":", appJs.substring(Math.max(0, idx - 50), idx + 100).replace(/\n/g, ' '));
  idx += '_appJustResumed'.length;
}

console.log("\nChecking for 'pointerEvents':");
idx = 0;
while ((idx = appJs.indexOf('pointerEvents = \'none\'', idx)) !== -1) {
  console.log("Found at", idx, ":", appJs.substring(Math.max(0, idx - 50), idx + 100).replace(/\n/g, ' '));
  idx += 'pointerEvents'.length;
}
