const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('οταν κανω swipe back ενω μπορει να βρισκομαι στην επισκοπηση')) {
        console.log(`Found in ${dir}`);
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
           try {
             const obj = JSON.parse(lines[j]);
             if (obj.content) {
                console.log(`\n--- [${obj.source}] ---`);
                console.log(obj.content.replace(/<[^>]+>/g, '').substring(0, 800));
             }
           } catch(e) {}
        }
      }
    }
  }
});
