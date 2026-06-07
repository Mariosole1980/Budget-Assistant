const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split(/\r?\n/);

// Find search overlay start
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="search-overlay"')) { start = i; break; }
}
if (start === -1) { console.log("not found"); process.exit(1); }

// Print 200 lines from there
const out = [];
for (let i = start; i < Math.min(start + 200, lines.length); i++) {
  out.push(`${i+1}: ${lines[i]}`);
}
console.log(out.join('\n'));
