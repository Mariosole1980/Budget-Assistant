const fs = require('fs');

const appJs = fs.readFileSync('c:/Users/mario/Desktop/money-manager/app.js', 'utf8').split('\n');

for (let i = 0; i < appJs.length; i++) {
  const l = appJs[i];
  if (l.includes('filter') && (l.includes('recurringTemplates') || l.includes('recovered_') || l.includes('συμπληρώματα') || l.includes('ΔΑΝΕΙΟ ΣΠΙΤΙΩΝ'))) {
    console.log(`Line ${i + 1}:`);
    for (let j = Math.max(0, i - 5); j <= Math.min(appJs.length - 1, i + 15); j++) {
      console.log(`${j + 1}: ${appJs[j]}`);
    }
    console.log("==================================================");
  }
}
