const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let output = "Searching all brains for build 730 info:\n";

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const transcriptPath = path.join(brainPath, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  console.log("Reading brain log:", brainId);
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    // Check if line contains 730 or v730
    if (line.includes('730') || line.toLowerCase().includes('v730')) {
      // Filter out timestamps and step indexes to find actual mentions
      const isTimestamp = line.includes('"timestamp"') && (line.includes('.730') || line.includes(':30.'));
      const isStepIndex = line.includes('"step_index":730') || line.includes('"step_index": 730');
      const isLineMatch = line.includes('Line 730:') || line.includes('line 730');
      
      if (!isTimestamp && !isStepIndex && !isLineMatch) {
        output += `\n====================================================\n`;
        output += `Brain: ${brainId} | Line: ${index + 1}\n`;
        output += `Snippet: ${line.substring(0, 2000)}\n`;
      }
    }
  });
});

fs.writeFileSync("scratch/all_brains_730_search.txt", output, 'utf-8');
console.log("Finished search. Results written to scratch/all_brains_730_search.txt");
