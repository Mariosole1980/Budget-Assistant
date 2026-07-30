const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'ab44c5c1-750f-4bef-b9f4-af5147d4c3c8', '.system_generated', 'logs', 'transcript_full.jsonl');

const lines = fs.readFileSync(logFile, 'utf8').split('\n');
lines.forEach((l, lineNum) => {
  if (l.includes('replace_file_content') && l.includes('index.html') && (l.includes('subscreen-') || l.includes('settings-subscreen-modal'))) {
    console.log(`[DIFF MATCH] Line: ${lineNum + 1}`);
    try {
      const obj = JSON.parse(l);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          const args = tc.arguments || tc.Arguments;
          if (args) {
            console.log("Instruction:", args.Instruction);
            console.log("TargetContent:", args.TargetContent ? args.TargetContent.substring(0, 300) : "NONE");
            console.log("ReplacementContent:", args.ReplacementContent ? args.ReplacementContent.substring(0, 300) : "NONE");
            console.log("-----------------------------------------");
          }
        });
      }
    } catch(e) {}
  }
});
