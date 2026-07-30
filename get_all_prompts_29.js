const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

let allPrompts29 = [];

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((l, idx) => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        if (obj.created_at && obj.created_at.startsWith('2026-07-29')) {
          if (obj.source === 'USER_EXPLICIT' && obj.type === 'USER_INPUT') {
            allPrompts29.push({
              convId: dir,
              line: idx + 1,
              time: obj.created_at,
              text: obj.content
            });
          }
        }
      } catch(e) {}
    });
  }
});

allPrompts29.sort((a, b) => a.time.localeCompare(b.time));

console.log(`Total user prompts on 2026-07-29: ${allPrompts29.length}`);
allPrompts29.forEach(p => {
  const cleanText = p.text.replace(/<[^>]+>/g, '').trim().split('\n')[0];
  console.log(`[${p.time}] (${p.convId}): ${cleanText}`);
});
