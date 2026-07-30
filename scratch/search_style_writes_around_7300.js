const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\0b4b40ec-6bec-448d-b870-7826bcd30916\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log("Searching style.css modifications between step 7100 and 7310...");

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index >= 7100 && obj.step_index <= 7310) {
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          const args = tc.arguments || tc.args || {};
          const file = args.TargetFile || args.AbsolutePath || '';
          if (file.includes('style.css')) {
            console.log(`\nStep ${obj.step_index} | Tool: ${tc.name}`);
            console.log(`  Instruction: ${args.Instruction}`);
            console.log(`  Description: ${args.Description}`);
            console.log(`  Replacement content snippet:`);
            const rep = args.ReplacementContent || JSON.stringify(args.ReplacementChunks || '');
            console.log(rep.substring(0, 1000));
          }
        });
      }
    }
  } catch (e) {}
});
