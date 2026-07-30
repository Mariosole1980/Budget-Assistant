const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let output = "";

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
    if (line.includes('730')) {
      // Check if it's just a line number or timestamp
      if (line.includes('"timestamp"') && line.includes('.730')) {
        // Timestamp milliseconds, ignore
        return;
      }
      if (line.includes('line 730') || line.includes('Line 730') || line.includes('L730')) {
        // Line number, ignore
        return;
      }
      
      output += `\n--- Match in Brain ${brainId} at line ${index} ---\n`;
      output += `${line.substring(0, 1000)}\n`;
    }
  });
});

fs.writeFileSync("C:\\Users\\mario\\Desktop\\money-manager\\scratch\\precise_730_matches.txt", output, 'utf-8');
console.log("Precise matches written.");
