const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('v219') || line.includes('v218')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Occurrences in app.js:");
console.log(occurrences.join('\n'));
