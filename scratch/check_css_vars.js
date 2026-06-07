const fs = require('fs');
const content = fs.readFileSync('style.css', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('--red-negative') || line.includes('--blue-positive') || line.includes('--green-positive')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("CSS Variables for transaction colors in style.css:");
console.log(occurrences.join('\n'));
