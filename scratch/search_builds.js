const fs = require('fs');

const transcriptPath = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\92accbcb-9725-415b-bfa2-907fb2ea521c\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\mario\\Desktop\\money-manager\\scratch\\search_builds_results.txt";

if (!fs.existsSync(transcriptPath)) {
  console.log("Transcript not found:", transcriptPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(transcriptPath, 'utf-8');
const lines = fileContent.split('\n');

let output = "Searching full transcript for build tasks...\n";

lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    const cmd = JSON.stringify(obj.tool_calls || '');
    if (cmd.includes('build_and_deploy') || cmd.includes('build_and_deploy.ps1')) {
      output += `\n--- Match at line ${index} (Step Index: ${obj.step_index}, Created: ${obj.created_at}) ---\n`;
      output += `Tool call: ${JSON.stringify(obj.tool_calls, null, 2)}\n`;
    }
    // Also capture system messages indicating finished tasks
    if (obj.type === 'SYSTEM_MESSAGE' || obj.type === 'RUN_COMMAND') {
      const content = JSON.stringify(obj.content || '');
      if (content.includes('build_and_deploy') || content.includes('build_and_deploy.ps1') || content.includes('BudgetAssistant.apk') || content.includes('build v')) {
        output += `\n--- Finished Task Match at line ${index} (Step Index: ${obj.step_index}, Created: ${obj.created_at}) ---\n`;
        output += `Content: ${content.substring(0, 1000)}\n`;
      }
    }
  } catch (e) {
    // ignore
  }
});

fs.writeFileSync(outputPath, output, 'utf-8');
console.log("Written results to:", outputPath);
