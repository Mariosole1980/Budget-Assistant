const fs = require('fs');
const content = fs.readFileSync('style.css', 'utf8');

const occurrences = [];
const lines = content.split(/\r?\n/);
lines.forEach((line, idx) => {
  if (line.includes('trans-amount') || line.includes('amount-expense') || line.includes('amount-income') || line.includes('amount-transfer')) {
    occurrences.push(`${idx + 1}: ${line.trim()}`);
  }
});

console.log("Transaction amount color rules in style.css:");
console.log(occurrences.join('\n'));
