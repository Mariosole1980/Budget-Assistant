const fs = require('fs');
const path = require('path');

const scratchDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\ab44c5c1-750f-4bef-b9f4-af5147d4c3c8\\scratch';
const files = fs.readdirSync(scratchDir).filter(f => f.startsWith('match_'));

console.log("Found match files:", files);

files.forEach(file => {
  const filePath = path.join(scratchDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`=== File: ${file} ===`);
  // If it's a tool call, let's print the replacement contents or edits
  if (data.tool_calls) {
    data.tool_calls.forEach(tc => {
      if (tc.Arguments && tc.Arguments.ReplacementContent) {
        console.log("REPLACEMENT CONTENT:");
        console.log(tc.Arguments.ReplacementContent.substring(0, 1000));
        console.log("...");
      }
      if (tc.Arguments && tc.Arguments.CodeContent) {
        console.log("CODE CONTENT:");
        console.log(tc.Arguments.CodeContent.substring(0, 1000));
        console.log("...");
      }
    });
  }
});
