const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\mario\\.gemini\\antigravity\\brain';
const convDirs = fs.readdirSync(brainDir);

console.log("Analyzing yesterday's (29/7) activity...");

const yesterdayDateStr = '2026-07-29';
let logEntries = [];

convDirs.forEach(dir => {
  const logFile = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    lines.forEach(l => {
      if (!l.trim()) return;
      try {
        const obj = JSON.parse(l);
        if (obj.created_at && obj.created_at.startsWith(yesterdayDateStr)) {
          logEntries.push({
            convId: dir,
            step: obj.step_index,
            source: obj.source,
            type: obj.type,
            content: obj.content,
            thinking: obj.thinking,
            tool_calls: obj.tool_calls
          });
        }
      } catch(e) {}
    });
  }
});

console.log(`Found ${logEntries.length} entries for 29/7.`);

// Group by conversation and summarize
const convGroups = {};
logEntries.forEach(entry => {
  if (!convGroups[entry.convId]) {
    convGroups[entry.convId] = [];
  }
  convGroups[entry.convId].push(entry);
});

Object.keys(convGroups).forEach(convId => {
  console.log(`\n=== Conversation ID: ${convId} ===`);
  const entries = convGroups[convId];
  
  // Extract user prompts
  const userPrompts = entries.filter(e => e.source === 'USER_EXPLICIT' && e.type === 'USER_INPUT');
  console.log("User requests:");
  userPrompts.forEach(up => {
    console.log(`  - [${up.step}]: ${up.content.trim().substring(0, 300)}...`);
  });
  
  // Extract file updates / key modifications
  const fileEdits = [];
  entries.forEach(e => {
    if (e.tool_calls) {
      e.tool_calls.forEach(tc => {
        if (tc.name === 'replace_file_content' || tc.name === 'write_to_file') {
          const args = tc.arguments || tc.Arguments;
          if (args) {
            fileEdits.push({
              tool: tc.name,
              file: args.TargetFile || args.targetFile || "unknown",
              desc: args.Description || args.description || "unknown"
            });
          }
        }
      });
    }
  });
  
  console.log("File modifications done:");
  const uniqueEdits = Array.from(new Set(fileEdits.map(fe => `${fe.file} (${fe.desc})`)));
  uniqueEdits.forEach(ue => console.log(`  - ${ue}`));
});
