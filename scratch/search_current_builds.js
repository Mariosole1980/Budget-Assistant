const fs = require('fs');
const path = require('path');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\92accbcb-9725-415b-bfa2-907fb2ea521c\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\current_session_builds.txt";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found");
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

let output = "Listing all build & deploy runs in current session:\n";

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    // Look for tool calls running build_and_deploy.ps1
    let isBuildCall = false;
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'run_command' && (tc.arguments || tc.args || {}).CommandLine && (tc.arguments || tc.args || {}).CommandLine.includes('build_and_deploy.ps1')) {
          isBuildCall = true;
        }
      });
    }
    
    // Look for command outputs of build_and_deploy.ps1
    let isBuildOutput = false;
    if (obj.type === 'RUN_COMMAND' && obj.content && (obj.content.includes('build_and_deploy.ps1') || obj.content.includes('Bumping version numbers') || obj.content.includes('Index.html build version bumped'))) {
      isBuildOutput = true;
    }
    
    if (isBuildCall || isBuildOutput || line.includes('730') || line.includes('731') || line.includes('729')) {
      output += `\n====================================================\n`;
      output += `Line: ${index + 1} | Step Index: ${obj.step_index} | Type: ${obj.type} | Created At: ${obj.created_at}\n`;
      if (obj.content) {
        output += `Content:\n${obj.content.substring(0, 2000)}\n`;
      }
      if (obj.tool_calls) {
        output += `Tool Calls: ${JSON.stringify(obj.tool_calls, null, 2)}\n`;
      }
    }
  } catch (e) {
    // Ignore JSON parsing errors
  }
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Done. Results written to:", outputPath);
