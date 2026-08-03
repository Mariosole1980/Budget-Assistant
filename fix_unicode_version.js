// Fix the broken unicode escape in the app_version translation.
// The Greek word "Έκδοση" was stored as literal 'u{0395}u{03BA}...' (missing backslashes),
// so it renders as raw text instead of the actual Greek characters.
const fs = require('fs');

const files = ['app.js', 'www/app.js'];

// The literal broken text currently in the file (no backslashes)
const BROKEN = "u{0395}u{03BA}u{03B4}u{03BF}u{03C3}u{03B7}";

for (const file of files) {
    if (!fs.existsSync(file)) {
        console.log(`SKIP (missing): ${file}`);
        continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes(BROKEN)) {
        // Replace the broken escape with the actual Greek word "Έκδοση"
        content = content.split(BROKEN).join('Έκδοση');
        fs.writeFileSync(file, content);
        console.log(`FIXED: ${file}`);
    } else {
        console.log(`NO BROKEN ESCAPE FOUND: ${file}`);
    }
}
