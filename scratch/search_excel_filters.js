const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\app.js', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for excel categories filtering in app.js ===');
lines.forEach((line, index) => {
  if (line.includes('imported') || line.includes('has_imported') || line.includes('Excel')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
