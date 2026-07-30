const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

console.log("Scanning all conversations for 26-29 July activity...");

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    const userPrompts = [];
    
    lines.forEach(l => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        if (obj.source === 'USER_EXPLICIT' && obj.type === 'USER_INPUT' && obj.content) {
          userPrompts.push({
            time: obj.created_at,
            text: obj.content
          });
        }
      } catch(e) {}
    });
    
    if (userPrompts.length > 0) {
      console.log(`\n==================================================`);
      console.log(`Conv ID: ${dir} (Total user prompts: ${userPrompts.length})`);
      userPrompts.forEach(p => {
        // Only print first 150 chars of request
        const cleanText = p.text.replace(/<[^>]+>/g, '').trim().split('\n')[0];
        console.log(`  [${p.time}] ${cleanText}`);
      });
    }
  }
});
