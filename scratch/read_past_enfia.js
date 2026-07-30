const fs = require('fs');

const path = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript.jsonl";

const lines = fs.readFileSync(path, 'utf8').split('\n');

const lineNumbers = [14334, 14358, 14499, 14580];

lineNumbers.forEach(ln => {
    if (lines[ln - 1]) {
        console.log(`Line ${ln}:`);
        console.log(lines[ln - 1]);
        console.log('=' .repeat(50));
    }
});
