const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let sessions = [];

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const transcriptPath = path.join(brainPath, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  try {
    const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = fileContent.trim().split('\n');
    if (lines.length === 0 || !lines[0]) return;
    
    const firstObj = JSON.parse(lines[0]);
    const lastObj = JSON.parse(lines[lines.length - 1]);
    
    sessions.push({
      id: brainId,
      firstStep: firstObj.step_index,
      lastStep: lastObj.step_index,
      startTime: firstObj.created_at || 'unknown',
      endTime: lastObj.created_at || 'unknown',
      stepsCount: lines.length
    });
  } catch (e) {
    // console.log("Error reading", brainId, e);
  }
});

sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

sessions.forEach(s => {
  console.log(`Brain: ${s.id} | Steps: ${s.firstStep} -> ${s.lastStep} (${s.stepsCount} steps) | Time: ${s.startTime} -> ${s.endTime}`);
});
