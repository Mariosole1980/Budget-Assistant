const fs = require('fs');
const rootApp = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\app.js', 'utf8');
const subApp = fs.readFileSync('c:\\Users\\mario\\Desktop\\money-manager\\money-manager\\app.js', 'utf8');

console.log('Root app.js size:', rootApp.length);
console.log('Sub app.js size:', subApp.length);
console.log('Are they identical?', rootApp === subApp);
