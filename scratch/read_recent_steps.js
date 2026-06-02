const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('C:\\Users\\mario\\.gemini\\antigravity\\brain\\12ed399c-9123-45d9-adac-f36fd8b25d85\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const obj = JSON.parse(line);
        if (obj.step_index >= 16346 && obj.step_index <= 16386) {
          console.log(`Step ${obj.step_index} (${obj.source} - ${obj.type}):`);
          if (obj.content) {
            console.log(obj.content.substring(0, 1000));
          }
          if (obj.tool_calls) {
            console.log("Tool Calls:", JSON.stringify(obj.tool_calls, null, 2));
          }
          console.log('--------------------------------------------------');
        }
      } catch (e) {
        // ignore
      }
    }
  }
}

main();
