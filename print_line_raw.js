const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const logFile = path.join(brainDir, 'ab44c5c1-750f-4bef-b9f4-af5147d4c3c8', '.system_generated', 'logs', 'transcript_full.jsonl');

const lines = fs.readFileSync(logFile, 'utf8').split('\n');
console.log(lines[1174]); // line 1175
