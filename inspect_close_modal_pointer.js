const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const lines = appJs.split('\n');
console.log("=== Line 8335-8365 of app.js ===");
for (let i = 8330; i < Math.min(lines.length, 8365); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
