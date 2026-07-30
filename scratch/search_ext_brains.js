const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = ["076a7ee5-1606-43d9-896e-e1521821bfa0", "b360fd4b-a43a-4605-b65b-9c5ebbd42ece"];
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_ext_brains_results.txt";

let output = "Searching historical brains for build 730...\n";

brains.forEach(brainId => {
  const transcriptPath = path.join(brainsDir, brainId, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) {
    output += `\nBrain ${brainId} transcript NOT found.\n`;
    return;
  }
  
  output += `\n=== Brain: ${brainId} ===\n`;
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const obj = JSON.parse(line);
      const content = JSON.stringify(obj.content || '').toUpperCase() + JSON.stringify(obj.tool_calls || '').toUpperCase();
      
      // Look for style.css changes or build 730
      if (content.includes("STYLE.CSS") && (content.includes("CALC-KEYPAD") || content.includes("730") || content.includes("V730"))) {
        output += `\n--- Match at step ${obj.step_index} (Line ${index}, Created: ${obj.created_at}) ---\n`;
        // Check if there are tool calls writing style.css
        if (obj.tool_calls) {
          obj.tool_calls.forEach(tc => {
            if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
              if (JSON.stringify(tc).includes('style.css')) {
                output += `Tool call: ${JSON.stringify(tc, null, 2)}\n`;
              }
            }
          });
        }
        // Snippet of content
        output += `Content snippet: ${JSON.stringify(obj.content || '').substring(0, 2000)}\n`;
      }
    } catch (e) {
      // ignore
    }
  });
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Written results to:", outputPath);
