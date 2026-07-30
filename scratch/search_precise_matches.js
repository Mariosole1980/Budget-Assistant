const fs = require('fs');

const content = fs.readFileSync('scratch/precise_730_matches.txt', 'utf-8');
const lines = content.split('\n');

console.log(`Searching precise matches file (${lines.length} lines)...`);

let currentBrain = "";
let currentMatchHeader = "";

lines.forEach((line, index) => {
  if (line.startsWith('--- Match in Brain')) {
    currentMatchHeader = line.trim();
  }
  
  const upper = line.toUpperCase();
  if (upper.includes('V730') || upper.includes('BUILD 730') || upper.includes('VERSION 730') || upper.includes('VERSION": 730') || upper.includes('VERSION":730')) {
    console.log(`\nMatch at line ${index + 1}:`);
    if (currentMatchHeader) {
      console.log(`Context: ${currentMatchHeader}`);
    }
    console.log(line.trim().substring(0, 1000));
  }
});
