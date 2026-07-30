const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

function extractFunc(name) {
  const idx = appJs.indexOf(`function ${name}`);
  if (idx === -1) return `${name} NOT FOUND`;
  return appJs.substring(idx, idx + 2500);
}

console.log("=== mapTemplateToDb ===");
console.log(extractFunc('mapTemplateToDb'));

console.log("\n=== mapTemplateFromDb ===");
console.log(extractFunc('mapTemplateFromDb'));

console.log("\n=== processOfflineSyncQueue ===");
console.log(extractFunc('processOfflineSyncQueue'));

console.log("\n=== syncOnlineTransactions ===");
console.log(extractFunc('syncOnlineTransactions'));
