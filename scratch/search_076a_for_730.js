const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\076a7ee5-1606-43d9-896e-e1521821bfa0\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log(`Searching 076a7ee5 transcript (${lines.length} lines) for '730'...`);

lines.forEach((line, index) => {
  if (!line.trim()) return;
  if (line.includes('730')) {
    console.log(`\nLine ${index + 1}:`);
    console.log(line.trim().substring(0, 1000));
  }
});
