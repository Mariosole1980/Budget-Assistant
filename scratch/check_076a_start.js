const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\076a7ee5-1606-43d9-896e-e1521821bfa0\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.trim().split('\n');

console.log("Printing first 20 steps of 076a7ee5:");

for (let i = 0; i < Math.min(20, lines.length); i++) {
  try {
    const obj = JSON.parse(lines[i]);
    console.log(`Line ${i + 1} | Step ${obj.step_index} | Type: ${obj.type} | Date: ${obj.created_at}`);
    if (obj.tool_calls) {
      console.log(`  Tool calls: ${JSON.stringify(obj.tool_calls.map(tc => ({name: tc.name, cmd: (tc.arguments || tc.args || {}).CommandLine})))}`);
    } else if (obj.content) {
      console.log(`  Content: ${obj.content.substring(0, 300).replace(/\r?\n/g, ' ')}`);
    }
  } catch (e) {}
}
