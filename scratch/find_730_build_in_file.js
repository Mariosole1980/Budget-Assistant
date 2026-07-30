const fs = require('fs');

const content = fs.readFileSync('scratch/all_builds_chronological.txt', 'utf-8');
const blocks = content.split('\nSnippet:');

blocks.forEach(block => {
  const lines = block.trim().split('\n');
  const header = lines[0];
  if (header.includes('Match: v730') || header.includes('Match: build v730') || header.includes('Match: version 730')) {
    console.log('====================================================');
    console.log(block);
  }
});
