const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_all_brains_results.txt";

if (!fs.existsSync(brainDir)) {
  console.log("Brain directory not found:", brainDir);
  process.exit(1);
}

let output = "Searching all conversation transcripts for '730'...\n";

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.jsonl') || file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.js')) {
      // Read file and look for '730' or '730' versions
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('730') || content.includes('v730') || content.includes('V730')) {
          output += `\nFound match in file: ${filePath}\n`;
          // Find lines with 730
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('730') || line.includes('v730') || line.includes('V730')) {
              output += `Line ${idx + 1}: ${line.trim().substring(0, 300)}\n`;
            }
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

try {
  walkDir(brainDir);
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log("Completed! Results written to:", outputPath);
} catch (err) {
  console.error("Error walking directory:", err);
}
