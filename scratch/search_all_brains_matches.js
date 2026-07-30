const fs = require('fs');

const path = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_all_brains_results.txt";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\all_brains_matches_filtered.txt";

if (!fs.existsSync(path)) {
  console.log("Results file not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(path, 'utf-8');
const lines = fileContent.split('\n');

let currentFile = "";
let matchedLines = [];

lines.forEach((line, index) => {
  if (line.includes('Found match in file:')) {
    currentFile = line.trim();
  }
  // Check if line contains v730, build 730, or 730 as version
  const upper = line.toUpperCase();
  if (upper.includes('730') && !upper.includes('TASK-730') && !upper.includes('STEP_INDEX":730') && !upper.includes('LINE 730:') && !upper.includes('7730')) {
    matchedLines.push({
      file: currentFile,
      lineIndex: index + 1,
      content: line.trim()
    });
  }
});

let outText = `Found ${matchedLines.length} filtered matches for build 730:\n\n`;
matchedLines.forEach(m => {
  outText += `File: ${m.file}\nLine ${m.lineIndex}: ${m.content}\n\n`;
});

fs.writeFileSync(outputPath, outText, 'utf-8');
console.log("Filtered results written to:", outputPath);
