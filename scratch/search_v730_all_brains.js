const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const transcriptPath = path.join(brainPath, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    if (line.includes('version.json') && (line.includes('730') || line.includes('729') || line.includes('731'))) {
      try {
        const obj = JSON.parse(line);
        console.log(`\nFound match in Brain ${brainId} at Line ${index + 1} (Step: ${obj.step_index}, Created: ${obj.created_at})`);
        console.log(`Snippet: ${line.substring(0, 1000)}`);
      } catch (e) {}
    }
  });
});
