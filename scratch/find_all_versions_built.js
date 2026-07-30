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
    
    // Look for toolAction or toolSummary or content containing deploying v... or build v...
    // Also look for version number updates in the transcripts
    if (line.includes('build_and_deploy.ps1') || line.includes('build-deploy') || line.includes('version.json')) {
      const match = line.match(/(v\d{3}|version\s+\d{3}|build\s+v\d{3}|version\":\s*\d{3})/i);
      if (match) {
        builds.push({
          brain: brainId,
          line: index + 1,
          text: match[0],
          timestamp: line.match(/"created_at":"([^"]+)"/) ? line.match(/"created_at":"([^"]+)"/)[1] : 'unknown',
          snippet: line.substring(0, 300)
        });
      }
    }
  });
});

console.log(`Found ${builds.length} build references. Sorting...`);
builds.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

builds.forEach(b => {
  console.log(`[${b.timestamp}] Brain: ${b.brain.substring(0, 8)} | Match: ${b.text} | Snippet: ${b.snippet}`);
});
