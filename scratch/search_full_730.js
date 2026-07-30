const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\92accbcb-9725-415b-bfa2-907fb2ea521c\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_full_730_results.txt";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found at path:", transcriptPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

let output = "Searching full transcript for version 730 mentions...\n";

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const content = JSON.stringify(obj.content || '').toUpperCase() + JSON.stringify(obj.tool_calls || '').toUpperCase();
    if (content.includes("730") || content.includes("V730")) {
      output += `\n--- Match at line ${index} (Step Index: ${obj.step_index}, Type: ${obj.type}, Created: ${obj.created_at}) ---\n`;
      const summary = JSON.stringify(obj.content || '').substring(0, 1500);
      output += `Summary: ${summary}\n`;
      if (obj.tool_calls) {
        output += `Tool Calls: ${JSON.stringify(obj.tool_calls).substring(0, 1500)}\n`;
      }
    }
  } catch (e) {
    // Ignore JSON parsing errors
  }
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Results written to:", outputPath);
