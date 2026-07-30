const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const results = [];

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath);
    } else {
      // only search json, jsonl, txt, js, html files
      const ext = path.extname(file).toLowerCase();
      if (['.json', '.jsonl', '.txt', '.js', '.html'].includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Look for v730, version": 730, version":730
          const regex = /v730\b|version"\s*:\s*730\b/i;
          if (regex.test(content)) {
            console.log(`Match found in: ${fullPath}`);
            results.push(fullPath);
          }
        } catch(e) {
          // ignore read errors
        }
      }
    }
  }
}

search(brainDir);
fs.writeFileSync('scratch/precise_v730_files.json', JSON.stringify(results, null, 2));
console.log(`Done. Found ${results.length} files.`);
