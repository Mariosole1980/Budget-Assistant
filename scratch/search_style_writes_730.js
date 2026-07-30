const fs = require('fs');
const path = require('path');

const filePath = 'scratch/style_css_writes_results.txt';
if (!fs.existsSync(filePath)) {
  console.log(`File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const blocks = content.split('--- Match');

console.log(`Total blocks: ${blocks.length}`);

blocks.forEach(block => {
  if (block.includes('730') || block.includes('729') || block.includes('731') || block.includes('732') || block.includes('v730') || block.includes('V730')) {
    console.log('====================================================');
    console.log(block.substring(0, 1500));
  }
});
