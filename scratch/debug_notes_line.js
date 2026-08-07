const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('Σημειωματάριο') && line.includes('Checklists')) {
        const idx = line.indexOf('Σημειωματάριο');
        const before = line.slice(0, idx);
        // print the last 4 chars before the text
        const tail = before.slice(-6);
        console.log('LINE', i + 1);
        console.log('  tail before text:', JSON.stringify(tail));
        for (const ch of tail) {
            console.log('    char', JSON.stringify(ch), 'codePoint', ch.codePointAt(0).toString(16));
        }
    }
});
