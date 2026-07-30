const fs = require('fs');

const content = fs.readFileSync('scratch/all_brains_730_search.txt', 'utf-8');
const blocks = content.split('====================================================');

console.log(`Filtering ${blocks.length} blocks for current session 92accbcb...`);

blocks.forEach(block => {
  if (block.includes('92accbcb-9725-415b-bfa2-907fb2ea521c')) {
    const upper = block.toUpperCase();
    if (upper.includes('CALC-') || upper.includes('KEYPAD') || upper.includes('CALC_') || upper.includes('CALCULATOR') || upper.includes('KEY-BTN')) {
      console.log('\n====================================================');
      console.log(block.trim().substring(0, 3000));
    }
  }
});
