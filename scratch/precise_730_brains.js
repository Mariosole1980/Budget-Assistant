const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let output = "Searching all brains for build 730 content...\n";

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
    if (line.includes('730') || line.includes('v730')) {
      // Analyze line to see if it contains build version metadata
      if (line.includes('build v730') || line.includes('build: v730') || line.includes('CURRENT_BUILD = 730') || line.includes('version": 730') || line.includes('build_and_deploy.ps1 for v730') || line.includes('deploying build v730')) {
        output += `\n--- Match in Brain ${brainId} at line ${index} (Step: ${index}, Created: ${line.substring(0, 100)}) ---\n`;
        output += `${line.substring(0, 2000)}\n`;
      }
    }
  });
});

fs.writeFileSync("C:\\Users\\mario\\Desktop\\money-manager\\scratch\\precise_730_brains_results.txt", output, 'utf-8');
console.log("Precision search complete.");
