const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let output = "Searching all brains for version.json writes...\n";

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const logsDir = path.join(brainPath, ".system_generated", "logs");
  if (!fs.existsSync(logsDir)) return;
  
  const transcriptPath = path.join(logsDir, "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    // Check if line contains version.json and is a tool call or action
    if (line.includes('version.json')) {
      if (line.includes('730') || line.includes('729') || line.includes('731') || line.includes('728') || line.includes('732')) {
        output += `\n--- Brain ${brainId} at line ${index} (Step: ${index}) ---\n`;
        output += `${line.substring(0, 1000)}\n`;
      }
    }
  });
});

fs.writeFileSync("C:\\Users\\mario\\Desktop\\money-manager\\scratch\\version_json_search_results.txt", output, 'utf-8');
console.log("version.json search complete.");
