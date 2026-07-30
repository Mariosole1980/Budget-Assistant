const fs = require('fs');

const content = fs.readFileSync('scratch/all_builds_chronological.txt', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('730') && !line.includes('2026-07-28')) {
    console.log(`Line ${idx + 1}: ${line}`);
    // Print snippet line that follows
    if (lines[idx + 1]) {
      console.log(`  ${lines[idx + 1].substring(0, 150)}`);
    }
    console.log('---');
  }
});
