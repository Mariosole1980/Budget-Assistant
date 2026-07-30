const fs = require('fs');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\92accbcb-9725-415b-bfa2-907fb2ea521c\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_full_transcript_results.txt";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found:", transcriptPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

let output = "Searching full transcript for build 730...\n";

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const content = JSON.stringify(obj.content || '').toUpperCase() + JSON.stringify(obj.tool_calls || '').toUpperCase();
    if (content.includes("730") || content.includes("V730")) {
      output += `\n--- Match at line ${index} (Step Index: ${obj.step_index}, Type: ${obj.type}, Created: ${obj.created_at}) ---\n`;
      // Check if it's a file write tool call
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            output += `Tool call details: ${JSON.stringify(tc, null, 2)}\n`;
          }
        });
      }
      output += `Content snippet: ${JSON.stringify(obj.content || '').substring(0, 1000)}\n`;
    }
  } catch (e) {
    // ignore
  }
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Written results to:", outputPath);
