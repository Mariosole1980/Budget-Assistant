const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split(/\r?\n/);

let idx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('search-filter-row')) {
    idx = i;
    break;
  }
}

if (idx !== -1) {
  console.log(`Found filter rows starting at line ${idx + 1}:`);
  const output = [];
  for (let i = Math.max(0, idx - 5); i < Math.min(idx + 60, lines.length); i++) {
    output.push(`${i + 1}: ${lines[i]}`);
  }
  console.log(output.join('\n'));
} else {
  console.log("Could not find any search-filter-row");
}
