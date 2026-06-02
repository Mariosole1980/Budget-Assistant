const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\app.js', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for format currency/amount in app.js ===');
lines.forEach((line, index) => {
  if (line.includes('format') && (line.includes('Currency') || line.includes('Amount') || line.includes('Money') || line.includes('Price'))) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
