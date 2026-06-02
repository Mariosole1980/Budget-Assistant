const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\12ed399c-9123-45d9-adac-f36fd8b25d85\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const steps = [];
  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.step_index >= 15500 && data.step_index <= 15842) {
        steps.push(data);
      }
    } catch (e) {}
  }

  console.log(`Found ${steps.length} steps in range 15500 - 15842.`);
  for (const step of steps) {
    if (step.type === 'USER_INPUT' || step.type === 'PLANNER_RESPONSE') {
      console.log(`Step ${step.step_index} | ${step.source} | ${step.type} | ${step.created_at}:`);
      console.log(step.content ? step.content.substring(0, 500) : '(no content)');
      console.log('='.repeat(50));
    }
  }
}

main().catch(console.error);
