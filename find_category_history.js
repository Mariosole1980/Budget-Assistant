const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

console.log("Searching in directories:", convDirs);

for (const dir of convDirs) {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    console.log("Scanning logfile:", logFile);
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    let idx = 0;
    lines.forEach((l, lineNum) => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        // We want to find tool calls to write_to_file or replace_file_content or code contents
        const str = JSON.stringify(obj);
        if (str.includes('renderCategoryManagerList') && str.includes('function') && obj.source === 'MODEL') {
          console.log(`Found match in conversation ${dir} at line ${lineNum + 1}`);
          fs.writeFileSync(`C:\\Users\\mario\\.gemini\\antigravity\\brain\\ab44c5c1-750f-4bef-b9f4-af5147d4c3c8\\scratch\\match_${dir}_${lineNum}.json`, JSON.stringify(obj, null, 2));
        }
      } catch (e) {}
    });
  }
}
console.log("Search completed.");
