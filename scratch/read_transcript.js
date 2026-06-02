const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\12ed399c-9123-45d9-adac-f36fd8b25d85\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const userMessages = [];
  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.source === 'USER_EXPLICIT' && data.type === 'USER_INPUT') {
        userMessages.push({
          step_index: data.step_index,
          created_at: data.created_at,
          content: data.content
        });
      }
    } catch (e) {
      // skip malformed lines
    }
  }

  const last10 = userMessages.slice(-10);
  for (const msg of last10) {
    console.log(`Step ${msg.step_index} | ${msg.created_at}:`);
    console.log(msg.content);
    console.log('-'.repeat(50));
  }
}

main().catch(console.error);
