const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'ab44c5c1-750f-4bef-b9f4-af5147d4c3c8', '.system_generated', 'logs', 'transcript_full.jsonl');

const lines = fs.readFileSync(logFile, 'utf8').split('\n');

const lineIndices = [1174, 2250]; // 0-based index for lines 1175, 2251

lineIndices.forEach(idx => {
  if (lines[idx]) {
    try {
      const obj = JSON.parse(lines[idx]);
      console.log(`=== Line ${idx + 1} ===`);
      console.log("Created At:", obj.created_at);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          const args = tc.arguments || tc.Arguments;
          if (args) {
            console.log("Instruction:", args.Instruction || args.instruction);
            console.log("TargetContent:", args.TargetContent || args.targetContent);
            console.log("ReplacementContent:", args.ReplacementContent || args.replacementContent);
          }
        });
      }
    } catch(e) {
      console.error(e);
    }
  }
});
