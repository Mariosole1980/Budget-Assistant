const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let output = "Searching all brains for style.css changes related to the calculator keypad...\n";

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const logsDir = path.join(brainPath, ".system_generated", "logs");
  if (!fs.existsSync(logsDir)) return;
  
  const transcriptPath = path.join(logsDir, "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  console.log("Searching in brain:", brainId);
  
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        obj.tool_calls.forEach(tc => {
          if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
            const argsStr = JSON.stringify(tc.arguments || tc.args || '');
            if (argsStr.includes('style.css') && (argsStr.includes('calc-keypad') || argsStr.includes('keyboard-offset') || argsStr.includes('calc-key-btn') || argsStr.includes('calc-btn'))) {
              output += `\n--- Match in Brain ${brainId} at line ${index} (Step Index: ${obj.step_index}, Created: ${obj.created_at}) ---\n`;
              output += `Tool call: ${JSON.stringify(tc, null, 2)}\n`;
            }
          }
        });
      }
    } catch (e) {
      // ignore
    }
  });
});

fs.writeFileSync("C:\\Users\\mario\\Desktop\\money-manager\\scratch\\style_css_writes_results.txt", output, 'utf-8');
console.log("style.css writes search complete.");
