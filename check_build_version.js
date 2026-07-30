const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

console.log("Checking BUILD_VERSION references:");
let idx = 0;
while ((idx = appJs.indexOf('BUILD_VERSION', idx)) !== -1) {
  console.log("Found at pos", idx, ":", appJs.substring(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' '));
  idx += 'BUILD_VERSION'.length;
}

console.log("\nChecking renderUserGuideContent or user-guide-body:");
idx = 0;
while ((idx = appJs.indexOf('renderUserGuideContent', idx)) !== -1) {
  console.log("Found at pos", idx, ":", appJs.substring(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' '));
  idx += 'renderUserGuideContent'.length;
}
