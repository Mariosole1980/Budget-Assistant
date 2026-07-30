const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (!line.trim()) return;
  if (line.includes('version.json')) {
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            console.log(`\nLine ${index + 1} | Step ${obj.step_index} | Created: ${obj.created_at}`);
            console.log(`Tool: ${tc.name}`);
            console.log(`Args: ${JSON.stringify(tc.arguments || tc.args || '')}`);
          }
        });
      }
    } catch (e) {}
  }
});
