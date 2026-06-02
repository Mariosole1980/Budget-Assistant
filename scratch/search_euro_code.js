const fs = require('fs');
const path = require('path');

function searchFile(filePath, term) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Matches for "${term}" in ${path.basename(filePath)} ===`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(term.toLowerCase())) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}

const dir = 'c:\\Users\\mario\\Desktop\\money-manager';
searchFile(path.join(dir, 'index.html'), 'EUR');
searchFile(path.join(dir, 'app.js'), 'EUR');
searchFile(path.join(dir, 'index.html'), '€');
searchFile(path.join(dir, 'app.js'), '€');
