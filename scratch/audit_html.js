const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Find duplicate IDs
const idRegex = /id="([^"]+)"/g;
const ids = {};
let m;
while ((m = idRegex.exec(html)) !== null) {
    ids[m[1]] = (ids[m[1]] || 0) + 1;
}
const dupIds = Object.entries(ids).filter(([k, v]) => v > 1);
console.log('=== DUPLICATE IDs ===');
if (dupIds.length === 0) console.log('None');
dupIds.forEach(([k, v]) => console.log(`  ${k} (x${v})`));

// Find script tags
console.log('\n=== SCRIPT TAGS ===');
const scriptRegex = /<script[^>]*>/g;
let sm;
while ((sm = scriptRegex.exec(html)) !== null) {
    console.log(`  line ~${html.slice(0, sm.index).split('\n').length}: ${sm[0]}`);
}

// Check for inline onclick handlers referencing functions
console.log('\n=== INLINE ONCLICK SAMPLE (first 30) ===');
const onclickRegex = /onclick="([^"]+)"/g;
let om;
let count = 0;
while ((om = onclickRegex.exec(html)) !== null && count < 30) {
    console.log(`  ${om[1]}`);
    count++;
}

// Check for external resources / CDN
console.log('\n=== EXTERNAL LINKS (http) ===');
const httpRegex = /(?:src|href)="(https?:\/\/[^"]+)"/g;
let hm;
const seen = new Set();
while ((hm = httpRegex.exec(html)) !== null) {
    if (!seen.has(hm[1])) {
        seen.add(hm[1]);
        console.log(`  ${hm[1]}`);
    }
}
