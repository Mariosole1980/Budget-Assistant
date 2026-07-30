const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log("Reading lines from 9000 to end...");

for (let i = 9000; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'RUN_COMMAND' || obj.type === 'SYSTEM_MESSAGE' || obj.type === 'CHECKPOINT') {
      const upper = JSON.stringify(obj).toUpperCase();
      if (upper.includes('BUILD') || upper.includes('DEPLOY') || upper.includes('VERSION')) {
        console.log(`\nLine ${i + 1} | Step ${obj.step_index} | Type: ${obj.type} | Date: ${obj.created_at}`);
        if (obj.content) {
          // Look for version string in content
          const match = obj.content.match(/(v\d{3}|version\s+\d{3}|build\s+v\d{3}|version\":\s*\d{3}|Bumping version numbers to \d{3})/i);
          console.log(`  Match: ${match ? match[0] : 'N/A'}`);
          console.log(`  Content snippet: ${obj.content.substring(0, 500).replace(/\r?\n/g, ' ')}`);
        }
      }
    }
  } catch (e) {}
}
