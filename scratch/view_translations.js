const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');

// Find TRANSLATIONS object
const match = content.match(/const TRANSLATIONS\s*=\s*({[\s\S]*?});/);
if (match) {
  const transObj = eval('(' + match[1] + ')');
  console.log('Greek keys:');
  for (let key in transObj.el) {
    if (key.includes('search') || key.includes('filter') || key.includes('period') || key.includes('photo') || key.includes('member')) {
      console.log(`  ${key}: "${transObj.el[key]}"`);
    }
  }
  console.log('\nEnglish keys:');
  for (let key in transObj.en) {
    if (key.includes('search') || key.includes('filter') || key.includes('period') || key.includes('photo') || key.includes('member')) {
      console.log(`  ${key}: "${transObj.en[key]}"`);
    }
  }
} else {
  console.log('TRANSLATIONS not found');
}
