const fs = require('fs');

const path = "C:\\Users\\mario\\.gemini\\antigravity\\brain\\b360fd4b-a43a-4605-b65b-9c5ebbd42ece\\.system_generated\\logs\\transcript.jsonl";

const lines = fs.readFileSync(path, 'utf8').split('\n');

lines.forEach((line, idx) => {
    if (line.includes('ΕΝΦΙΑ') || line.includes('ενφια') || line.includes('Ενφια') || line.includes('11/12') || line.includes('10/12') || line.includes('9/12') || line.includes('8/12')) {
        try {
            const parsed = JSON.parse(line);
            console.log(`Line ${idx+1} [${parsed.type}]:`);
            console.log(JSON.stringify(parsed.content || parsed.tool_calls || parsed, null, 2).slice(0, 1000));
            console.log('-'.repeat(50));
        } catch(e) {
            console.log(`Line ${idx+1}:`, line.slice(0, 300));
        }
    }
});
