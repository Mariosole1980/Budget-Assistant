const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('search-input') && line.includes('placeholder')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Occurrences in app.js:");
console.log(occurrences.join('\n'));
