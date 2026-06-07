const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('autocomplete') || line.toLowerCase().includes('suggest')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Autocomplete/Suggestion lines in app.js:");
console.log(occurrences.slice(0, 100).join('\n'));
