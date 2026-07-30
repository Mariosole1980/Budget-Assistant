const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\92accbcb-9725-415b-bfa2-907fb2ea521c\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    // Look at all tool calls
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        const argsStr = JSON.stringify(tc.arguments || tc.args || '');
        if (argsStr.includes('730') && (argsStr.includes('version.json') || argsStr.includes('style.css') || argsStr.includes('app.js'))) {
          console.log(`\nTool Call Match at Line ${index + 1} (Step: ${obj.step_index}, Created: ${obj.created_at})`);
          console.log(`Tool: ${tc.name}`);
          console.log(`Args: ${argsStr.substring(0, 1000)}`);
        }
      });
    }
  } catch (e) {}
});
