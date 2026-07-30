const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\0b4b40ec-6bec-448d-b870-7826bcd30916\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log(`Searching 0b4b40ec transcript (${lines.length} lines) for '730'...`);

let count = 0;
lines.forEach((line, index) => {
  if (!line.trim()) return;
  
  // Look for 730 specifically as a version or build
  if (line.includes('730') || line.includes('v730') || line.includes('V730')) {
    // Exclude matches that are just timestamps or unrelated step indexes like step_index: 7301
    // Let's print the line if it seems to contain a version
    const lower = line.toLowerCase();
    if (lower.includes('build') || lower.includes('version') || lower.includes('deploy') || lower.includes('style.css') || lower.includes('calc-key')) {
      count++;
      console.log(`\nLine ${index + 1}:`);
      console.log(line.trim().substring(0, 1000));
    }
  }
});

console.log(`\nTotal matches: ${count}`);
