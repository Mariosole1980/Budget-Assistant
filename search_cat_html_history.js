const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((l, lineNum) => {
      if (l.includes('category-manager-modal') && l.includes('replace_file_content') && l.includes('index.html')) {
        console.log(`[HTML MATCH] Conv: ${dir}, Line: ${lineNum + 1}`);
        console.log(l.substring(l.indexOf('category-manager-modal') - 100, l.indexOf('category-manager-modal') + 500));
        console.log("-----------------------------------------");
      }
    });
  }
});
