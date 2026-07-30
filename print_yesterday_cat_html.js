const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'b360fd4b-a43a-4605-b65b-9c5ebbd42ece', '.system_generated', 'logs', 'transcript_full.jsonl');

const lines = fs.readFileSync(logFile, 'utf8').split('\n');
const line = lines[8826]; // 8827 (1-based index) -> 8826 (0-based index)
try {
  const obj = JSON.parse(line);
  console.log(JSON.stringify(obj, null, 2).substring(0, 4000));
} catch(e) {
  console.error(e);
}
