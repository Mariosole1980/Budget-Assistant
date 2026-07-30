const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log(`Searching b360fd4b transcript (${lines.length} lines) for '730'...`);

lines.forEach((line, index) => {
  if (!line.trim()) return;
  if (line.includes('730')) {
    console.log(`\nLine ${index + 1}:`);
    console.log(line.trim().substring(0, 1000));
  }
});
