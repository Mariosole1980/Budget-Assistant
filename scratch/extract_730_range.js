const fs = require('fs');

const content = fs.readFileSync('scratch/all_builds_chronological.txt', 'utf-8');
const lines = content.split('\n');

console.log("Searching for build version matches in the 720s-730s range...");

lines.forEach((line, idx) => {
  if (line.includes('Match:')) {
    const match = line.match(/(v72\d|v73\d|version\s+72\d|version\s+73\d|build\s+v72\d|build\s+v73\d)/i);
    if (match) {
      console.log(`Line ${idx + 1}: ${line}`);
      if (lines[idx + 1]) {
        console.log(`  ${lines[idx + 1].substring(0, 150)}`);
      }
      console.log('---');
    }
  }
});
