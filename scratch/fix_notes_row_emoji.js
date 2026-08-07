const fs = require('fs');

const files = ['index.html', 'www/index.html'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const before = content;
    // Remove the leading 📝 emoji (U+1F4DD) + following space from the notes row label.
    // Only target the label that contains "Σημειωματάριο" (the notes row in More/Hub).
    const emoji = String.fromCodePoint(0x1F4DD); // 📝
    // Replace "📝 Σημειωματάριο" -> "Σημειωματάριο" (only the notes row label)
    content = content.split(emoji + ' Σημειωματάριο').join('Σημειωματάριο');
    if (content !== before) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`[OK] ${file}: removed redundant 📝 emoji from notes row label`);
    } else {
        console.log(`[SKIP] ${file}: pattern not found`);
    }
}
