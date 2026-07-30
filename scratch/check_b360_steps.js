const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript_full.jsonl";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

console.log(`Checking steps in b360fd4b (${lines.length} lines)...`);

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    // Print every 500 steps, or any step mentioning build_and_deploy.ps1
    let isInteresting = obj.step_index % 500 === 0;
    
    // Check if it runs build_and_deploy.ps1
    let runsBuild = false;
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'run_command' && (tc.arguments || tc.args || {}).CommandLine && (tc.arguments || tc.args || {}).CommandLine.includes('build_and_deploy.ps1')) {
          runsBuild = true;
        }
      });
    }
    
    if (isInteresting || runsBuild) {
      let buildMatch = line.match(/(v\d{3}|version\s+\d{3}|build\s+v\d{3})/i);
      console.log(`Step ${obj.step_index} | Date: ${obj.created_at} | Build: ${buildMatch ? buildMatch[0] : 'N/A'}`);
      if (runsBuild) {
        console.log(`  CommandLine: ${JSON.stringify(obj.tool_calls[0].arguments || obj.tool_calls[0].args)}`);
      }
    }
  } catch (e) {}
});
