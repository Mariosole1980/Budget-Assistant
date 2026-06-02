const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\app.js', 'utf8');
const lines = content.split('\n');
console.log('=== Matches for state.accounts/state.categories filtering/mutations in app.js ===');
lines.forEach((line, index) => {
  if ((line.includes('state.accounts') || line.includes('state.categories')) && (line.includes('filter') || line.includes('map') || line.includes(' = ') || line.includes('push'))) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
