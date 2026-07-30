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
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        // Look inside tool calls
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            const name = tc.name || tc.Name;
            const args = tc.arguments || tc.Arguments;
            if (args) {
              const code = args.ReplacementContent || args.CodeContent || args.replacementContent || args.codeContent;
              if (code && code.includes('renderCategoryManagerList')) {
                console.log(`[FOUND EDIT] Conv: ${dir}, Step: ${obj.step_index}, Line: ${lineNum + 1}`);
                console.log(code.substring(0, 1000));
                console.log("-----------------------------------------");
              }
            }
          });
        }
      } catch (e) {}
    });
  }
});
