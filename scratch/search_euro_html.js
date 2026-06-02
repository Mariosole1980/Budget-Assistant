const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\index.html', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for € in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('€')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
