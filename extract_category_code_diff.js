const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'b360fd4b-a43a-4605-b65b-9c5ebbd42ece', '.system_generated', 'logs', 'transcript_full.jsonl');

if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, lineNum) => {
    if (!l.trim()) return;
    try {
      const obj = JSON.parse(l);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'replace_file_content' || tc.name === 'write_to_file') {
            const args = tc.arguments || tc.Arguments;
            if (args) {
              const code = args.ReplacementContent || args.CodeContent;
              if (code && code.includes('renderCategoryManagerList')) {
                console.log(`Found edit in b360fd4b line ${lineNum + 1}`);
                console.log(code.substring(0, 1500));
                console.log("==========================================");
              }
            }
          }
        });
      }
    } catch (e) {}
  });
} else {
  console.log("Logfile b360fd4b not found!");
}
