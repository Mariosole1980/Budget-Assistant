const fs = require('fs');
const path = require('path');

const brainsDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const brains = fs.readdirSync(brainsDir);

let builds = [];

brains.forEach(brainId => {
  const brainPath = path.join(brainsDir, brainId);
  if (!fs.statSync(brainPath).isDirectory()) return;
  
  const transcriptPath = path.join(brainPath, ".system_generated", "logs", "transcript_full.jsonl");
  if (!fs.existsSync(transcriptPath)) return;
  
  const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = fileContent.split('\n');
  
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    
    // Look for version updates
    const upper = line.toUpperCase();
    if (upper.includes('BUILD') || upper.includes('DEPLOY') || upper.includes('VERSION')) {
      const match = line.match(/(v\d{3}|version\s+\d{3}|build\s+v\d{3}|version\":\s*\d{3})/i);
      if (match) {
        builds.push({
          brain: brainId,
          line: index + 1,
          text: match[0],
          timestamp: line.match(/"created_at":"([^"]+)"/) ? line.match(/"created_at":"([^"]+)"/)[1] : 'unknown',
          snippet: line.substring(0, 500)
        });
      }
    }
  });
});

builds.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

let output = `Found ${builds.length} builds in chronological order:\n\n`;
builds.forEach(b => {
  output += `[${b.timestamp}] Brain: ${b.brain} | Line ${b.line} | Match: ${b.text}\nSnippet: ${b.snippet}\n\n`;
});

fs.writeFileSync('scratch/all_builds_chronological.txt', output, 'utf-8');
console.log("Saved chronological builds to scratch/all_builds_chronological.txt");
