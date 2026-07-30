const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\076a7ee5-1606-43d9-896e-e1521821bfa0\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_ext_730_results.txt";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found:", transcriptPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

let output = "Searching brain 076a7ee5-1606-43d9-896e-e1521821bfa0 for build 730...\n";

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const contentStr = JSON.stringify(obj).toUpperCase();
    
    // Match build version 730 or v730 or anything about build 730
    if (contentStr.includes('"730"') || contentStr.includes('730 ') || contentStr.includes(' 730') || contentStr.includes('V730') || contentStr.includes('BUILD 730')) {
      output += `\n--- Match at line ${index} (Step Index: ${obj.step_index}, Created: ${obj.created_at}, Type: ${obj.type}) ---\n`;
      output += `Content snippet: ${JSON.stringify(obj.content || '').substring(0, 1500)}\n`;
      if (obj.tool_calls) {
        output += `Tool calls: ${JSON.stringify(obj.tool_calls, null, 2)}\n`;
      }
    }
  } catch (e) {
    // ignore
  }
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Written results to:", outputPath);
