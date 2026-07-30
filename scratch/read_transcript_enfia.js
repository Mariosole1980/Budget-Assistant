const fs = require('fs');

const path = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\076a7ee5-1606-43d9-896e-e1521821bfa0\\.system_generated\\logs\\transcript.jsonl";

const lines = fs.readFileSync(path, 'utf8').split('\n');

lines.forEach((line, idx) => {
    if (line.includes('ΕΝΦΙΑ') || line.includes('ενφια') || line.includes('Ενφια') || line.includes('11/12') || line.includes('10/12') || line.includes('ΔΟΣΗ') || line.includes('δόση')) {
        console.log(`Line ${idx+1}:`);
        console.log(line.slice(0, 300));
        console.log('---');
    }
});
