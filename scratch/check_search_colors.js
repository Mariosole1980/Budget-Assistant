const fs = require('fs');
const content = fs.readFileSync('style.css', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('search-item-amount') || line.includes('search-result-item') || line.includes('search-item')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Search result item color rules in style.css:");
console.log(occurrences.join('\n'));
