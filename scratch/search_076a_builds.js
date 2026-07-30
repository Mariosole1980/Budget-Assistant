const fs = require('fs');

const content = fs.readFileSync('scratch/all_builds_chronological.txt', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('076a7ee5-1606-43d9-896e-e1521821bfa0')) {
    console.log(`Line ${idx + 1}: ${line}`);
    if (lines[idx + 1]) {
      console.log(`  ${lines[idx + 1].substring(0, 150)}`);
    }
    console.log('---');
  }
});
