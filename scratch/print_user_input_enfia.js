const fs = require('fs');

const path = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript.jsonl";

const lines = fs.readFileSync(path, 'utf8').split('\n');

const lineNumbers = [14334, 14358, 14499, 14580];

lineNumbers.forEach(ln => {
    const line = lines[ln - 1];
    if (line) {
        const obj = JSON.parse(line);
        console.log(`Line ${ln}:`);
        console.log(obj.content || JSON.stringify(obj, null, 2));
        console.log('='.repeat(60));
    }
});
