const fs = require('fs');
const content = fs.readFileSync('scratch/style_css_writes_results.txt', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('730') || line.includes('729') || line.includes('731') || line.includes('732') || line.includes('781') || line.includes('780') || line.includes('774')) {
    console.log(`Line ${idx + 1}: ${line.substring(0, 150)}`);
  }
});
