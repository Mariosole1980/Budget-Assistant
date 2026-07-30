const fs = require('fs');

const content = fs.readFileSync('scratch/all_brains_730_search.txt', 'utf-8');
const blocks = content.split('====================================================');

blocks.forEach(block => {
  const upper = block.toUpperCase();
  if (upper.includes('VERSION') && (upper.includes('BUMP') || upper.includes('CREATE') || upper.includes('DEPLOY') || upper.includes('SUCCESS'))) {
    console.log('\n====================================================');
    console.log(block.trim().substring(0, 1000));
  }
});
