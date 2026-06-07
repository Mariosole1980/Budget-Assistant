const fs = require('fs');
const readline = require('readline');

async function main() {
  const logPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\bad229bb-46a4-479e-86a8-2e413f995e55\\.system_generated\\logs\\transcript.jsonl';
  
  if (!fs.existsSync(logPath)) {
    console.error("Log file does not exist at " + logPath);
    return;
  }

  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const steps = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        steps.push(JSON.parse(line));
      } catch(e) {}
    }
  }

  console.log(`Total steps: ${steps.length}`);
  
  // Find USER_INPUT steps
  const userIndices = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].type === 'USER_INPUT') {
      userIndices.push(i);
    }
  }

  console.log(`Found ${userIndices.length} user inputs.`);
  
  // Let's print the last 4 user inputs, and 5 steps after each of them
  const numToShow = Math.min(4, userIndices.length);
  for (let u = userIndices.length - numToShow; u < userIndices.length; u++) {
    const idx = userIndices[u];
    console.log(`\n=================== USER INPUT (Step ${steps[idx].step_index}) ===================`);
    console.log(steps[idx].content);
    console.log(`========================================================================`);
    
    // Print steps after this one until the next user input or next 15 steps
    const end = Math.min(steps.length, idx + 25);
    for (let i = idx + 1; i < end; i++) {
      if (steps[i].type === 'USER_INPUT') {
        break; // stop at next user input
      }
      console.log(`Step ${steps[i].step_index} (${steps[i].source} - ${steps[i].type} - status: ${steps[i].status}):`);
      if (steps[i].content && steps[i].source === 'MODEL' && steps[i].type === 'PLANNER_RESPONSE') {
        console.log(steps[i].content.substring(0, 300));
      } else if (steps[i].content && steps[i].source === 'USER_EXPLICIT') {
        console.log(steps[i].content.substring(0, 300));
      } else if (steps[i].tool_calls) {
        console.log("Tool Calls:", JSON.stringify(steps[i].tool_calls, null, 2));
      }
      console.log('--------------------------------------------------');
    }
  }
}

main();
