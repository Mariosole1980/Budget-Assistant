const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const output = [];

function searchDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (item === '.system_generated' || item === 'logs' || item === 'messages' || item === 'scratch') {
        searchDir(fullPath);
      } else if (item.length > 20) { // likely a brain ID
        searchDir(fullPath);
      }
    } else if (item.endsWith('.jsonl')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('build_and_deploy.ps1') || line.includes('version.json') || line.includes('v730') || line.includes('v729') || line.includes('v731')) {
          try {
            const parsed = JSON.parse(line);
            output.push({
              file: fullPath,
              lineNum: idx + 1,
              step: parsed.step_index,
              type: parsed.type,
              created_at: parsed.created_at,
              snippet: line.substring(0, 300)
            });
          } catch(e) {
            output.push({
              file: fullPath,
              lineNum: idx + 1,
              snippet: line.substring(0, 300)
            });
          }
        }
      });
    }
  }
}

searchDir(brainDir);
fs.writeFileSync('scratch/all_builds_search.json', JSON.stringify(output, null, 2));
console.log(`Found ${output.length} references to build deployments.`);
