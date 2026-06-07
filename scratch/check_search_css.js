const fs = require('fs');
const content = fs.readFileSync('style.css', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('search-bottom-sheet') || line.includes('search-overlay') || line.includes('bottom-sheet-option') || line.includes('search-filter-row') || line.includes('search-summary')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Search-related CSS rules in style.css:");
console.log(occurrences.join('\n'));
