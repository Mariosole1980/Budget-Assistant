const fs = require('fs');

const content = fs.readFileSync('scratch/all_brains_730_search.txt', 'utf-8');
const blocks = content.split('====================================================');

console.log(`Analyzing ${blocks.length} blocks for styling...`);

blocks.forEach(block => {
  const upper = block.toUpperCase();
  if (upper.includes('CALC-') || upper.includes('KEYPAD') || upper.includes('CALC_') || upper.includes('CALCULATOR') || upper.includes('KEY-BTN')) {
    if (upper.includes('STYLE.CSS') || upper.includes('.CSS') || upper.includes('REPLACE') || upper.includes('HEIGHT') || upper.includes('BUTTON')) {
      console.log('\n====================================================');
      console.log(block.trim().substring(0, 3000));
    }
  }
});
