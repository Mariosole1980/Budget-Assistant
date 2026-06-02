const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\index.html', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for currency/amount in index.html ===');
lines.forEach((line, index) => {
  const lower = line.toLowerCase();
  if (lower.includes('currency') || lower.includes('amount')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
