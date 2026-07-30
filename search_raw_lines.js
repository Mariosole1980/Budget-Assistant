const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, 'utf8').split('\n');
    lines.forEach((l, lineNum) => {
      if (l.includes('renderCategoryManagerList') && l.includes('function') && l.includes('replace_file_content')) {
        console.log(`[RAW MATCH] Conv: ${dir}, Line: ${lineNum + 1}`);
        // print a small excerpt
        console.log(l.substring(l.indexOf('renderCategoryManagerList') - 100, l.indexOf('renderCategoryManagerList') + 300));
        console.log("-----------------------------------------");
      }
    });
  }
});
