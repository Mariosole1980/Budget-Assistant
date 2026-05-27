const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\mario\\.gemini\\antigravity\\brain\\12ed399c-9123-45d9-adac-f36fd8b25d85\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  output: process.stdout,
  terminal: false
});

let index = 1;
rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT' && obj.content.toLowerCase().includes('λογαριασμ')) {
      console.log(`${index++}. USER: ${obj.content}`);
    }
  } catch (e) {}
});
