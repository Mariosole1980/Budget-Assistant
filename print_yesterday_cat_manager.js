const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'b360fd4b-a43a-4605-b65b-9c5ebbd42ece', '.system_generated', 'logs', 'transcript_full.jsonl');

const lines = fs.readFileSync(logFile, 'utf8').split('\n');
const lineIndex = 7662; // 0-based index for line 7663
const line = lines[lineIndex];

try {
  const obj = JSON.parse(line);
  fs.writeFileSync('C:\\Users\\mario\\.gemini\\antigravity\\brain\\ab44c5c1-750f-4bef-b9f4-af5147d4c3c8\\scratch\\yesterday_cat_manager.json', JSON.stringify(obj, null, 2));
  console.log("Successfully extracted yesterday's category manager JSON to scratch/yesterday_cat_manager.json");
} catch(e) {
  console.error("Error parsing:", e);
}
