const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.trim().split('\n');

console.log(`b360fd4b has ${lines.length} lines.`);
console.log("Printing last 20 steps:");

const start = Math.max(0, lines.length - 20);
for (let i = start; i < lines.length; i++) {
  try {
    const obj = JSON.parse(lines[i]);
    console.log(`Line ${i + 1} | Step ${obj.step_index} | Type: ${obj.type} | Date: ${obj.created_at}`);
    if (obj.tool_calls) {
      console.log(`  Tool calls: ${JSON.stringify(obj.tool_calls.map(tc => ({name: tc.name, cmd: (tc.arguments || tc.args || {}).CommandLine})))}`);
    }
  } catch (e) {}
}
