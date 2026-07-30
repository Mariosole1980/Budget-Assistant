const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\mario\\.gemini\\antigravity\\brain";

function searchInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchInDir(fullPath);
        } else if (f.endsWith('transcript.jsonl') || f.endsWith('transcript_full.jsonl')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
                if (l.includes('ΕΝΦΙΑ') || l.includes('11/12') || l.includes('10/12') || l.includes('273.01')) {
                    console.log(`File: ${fullPath} Line: ${idx+1}`);
                    try {
                        const parsed = JSON.parse(l);
                        if (parsed.content) {
                            console.log('CONTENT:', typeof parsed.content === 'string' ? parsed.content.slice(0, 300) : JSON.stringify(parsed.content).slice(0, 300));
                        }
                    } catch(e) {
                        console.log('RAW:', l.slice(0, 300));
                    }
                    console.log('---');
                }
            });
        }
    }
}

searchInDir(brainDir);
