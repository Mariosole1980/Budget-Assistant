const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\12ed399c-9123-45d9-adac-f36fd8b25d85\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      const contentStr = data.content ? data.content.toLowerCase() : '';
      if (contentStr.includes('ευρω') || contentStr.includes('euro') || (data.step_index >= 15650 && data.step_index <= 15730)) {
        console.log(`Step ${data.step_index} | ${data.source} | ${data.type}:`);
        console.log(data.content);
        console.log('='.repeat(50));
      }
    } catch (e) {}
  }
}

main().catch(console.error);
