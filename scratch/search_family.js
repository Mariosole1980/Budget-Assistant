const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\app.js', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for familyId or family_id in app.js ===');
lines.forEach((line, index) => {
  if (line.includes('familyId') || line.includes('family_id')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
