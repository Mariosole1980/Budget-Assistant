const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

let settingsPrompts = [];

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((l, idx) => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        if (obj.source === 'USER_EXPLICIT' && obj.type === 'USER_INPUT' && obj.content) {
          const text = obj.content.toLowerCase();
          if (text.includes('ρυθμισ') || text.includes('εδοποιησ') || text.includes('συγχρον') || text.includes('ασφαλ') || text.includes('pin') || text.includes('backup') || text.includes('excel') || text.includes('pdf') || text.includes('κατηγορ') || text.includes('επαναλαμβ') || text.includes('καδο') || text.includes('διαγραφ')) {
            settingsPrompts.push({
              time: obj.created_at,
              convId: dir,
              text: obj.content
            });
          }
        }
      } catch(e) {}
    });
  }
});

settingsPrompts.sort((a, b) => a.time.localeCompare(b.time));

console.log(`Total settings related prompts found: ${settingsPrompts.length}`);
// Print last 40 prompts
settingsPrompts.slice(-40).forEach(p => {
  const clean = p.text.replace(/<[^>]+>/g, '').trim().split('\n')[0];
  console.log(`[${p.time}] (${p.convId}): ${clean}`);
});
