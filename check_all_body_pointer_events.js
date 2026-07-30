const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8');

const lines = appJs.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('document.body.style.pointerEvents')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});
