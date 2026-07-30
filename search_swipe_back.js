const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

let results = [];

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach((l, idx) => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        if (obj.content) {
          const text = obj.content.toLowerCase();
          if (text.includes('swipe') || text.includes('swipe back') || text.includes('πίσω') || text.includes('πισω')) {
             if (text.includes('κολλα') || text.includes('freeze') || text.includes('παγων') || text.includes('gesture')) {
               results.push({
                 time: obj.created_at || 'unknown',
                 source: obj.source,
                 text: obj.content
               });
             }
          }
        }
      } catch(e) {}
    });
  }
});

results.sort((a, b) => a.time.localeCompare(b.time));

console.log(`Found ${results.length} results related to swipe back / freeze`);
results.forEach(r => {
  const clean = r.text.replace(/<[^>]+>/g, '').trim().split('\n')[0].substring(0, 300);
  console.log(`[${r.time}] [${r.source}]: ${clean}`);
});
