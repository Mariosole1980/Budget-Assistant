const fs = require('fs');

const content = fs.readFileSync('scratch/all_builds_chronological.txt', 'utf-8');
const blocks = content.split('\n\n');

blocks.forEach(block => {
  if (block.includes('730') || block.includes('729') || block.includes('731')) {
    // Make sure it's not a step index or line number within the search results
    if (block.includes('Match:')) {
      console.log(block);
      console.log('----------------------------------------------------');
    }
  }
});
