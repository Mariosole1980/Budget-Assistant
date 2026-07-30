const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\0b4b40ec-6bec-448d-b870-7826bcd30916\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log("Searching steps around 7300...");

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index >= 7290 && obj.step_index <= 7320) {
      console.log(`\nStep ${obj.step_index} | Type: ${obj.type} | Date: ${obj.created_at}`);
      if (obj.tool_calls) {
        console.log(`  Tool calls: ${JSON.stringify(obj.tool_calls.map(tc => ({name: tc.name, args: tc.arguments || tc.args})))}`);
      }
      if (obj.content) {
        console.log(`  Content snippet: ${obj.content.substring(0, 500).replace(/\r?\n/g, ' ')}`);
      }
    }
  } catch (e) {}
});
