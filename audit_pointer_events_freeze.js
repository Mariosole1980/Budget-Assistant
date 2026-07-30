const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');
const styleCss = fs.readFileSync('c:/Users/mario/Desktop/money-manager/style.css', 'utf8');

console.log("=== Searching pointerEvents in app.js ===");
const lines = appJs.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('pointerEvents')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});

console.log("\n=== Searching pointer-events in style.css ===");
const cssLines = styleCss.split('\n');
cssLines.forEach((l, idx) => {
  if (l.includes('pointer-events')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});
