const fs = require('fs');

const content = fs.readFileSync('scratch/all_brains_matches_filtered.txt', 'utf-8');
const blocks = content.split('\n\n');

blocks.forEach(block => {
  if (block.includes('0b4b40ec-6bec-448d-b870-7826bcd30916')) {
    console.log(block);
    console.log('----------------------------------------------------');
  }
});
