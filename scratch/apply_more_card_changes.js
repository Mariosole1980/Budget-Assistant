const fs = require('fs');

// Files to process
const htmlFiles = ['index.html', 'www/index.html'];
const cssFiles = ['style.css', 'www/style.css'];

// --- HTML changes ---
// 1. Decrease padding from 16px 16px to 14px 16px in hub rows
// 2. Title font-size 14px -> 15px (settings-item-label spans)
// 3. Subtitle font-size 11px -> 12px (description spans)

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let count = { padding: 0, title: 0, subtitle: 0 };

    // 1. Decrease padding in hub rows (only the settings-list-item hub rows)
    // Match: style="cursor: pointer; padding: 16px 16px;"
    const paddingRegex = /(style="cursor: pointer; padding: )16px 16px;/g;
    content = content.replace(paddingRegex, (m, p1) => {
        count.padding++;
        return p1 + '14px 16px;';
    });

    // 2. Title font-size 14px -> 15px in settings-item-label spans
    // Pattern: font-weight:700; font-family:'Outfit',sans-serif; font-size:14px; color:var(--text-primary);
    const titleRegex = /(font-weight:700; font-family:'Outfit',sans-serif; font-size:)14px(; color:var\(--text-primary\);)/g;
    content = content.replace(titleRegex, (m, p1, p2) => {
        count.title++;
        return p1 + '15px' + p2;
    });

    // 3. Subtitle font-size 11px -> 12px
    // Pattern: <span style="font-size:11px;color:var(--text-secondary);"
    const subtitleRegex = /(<span style="font-size:)11px(;color:var\(--text-secondary\);)"/g;
    content = content.replace(subtitleRegex, (m, p1, p2) => {
        count.subtitle++;
        return p1 + '12px' + p2 + '"';
    });

    fs.writeFileSync(file, content);
    console.log(`${file}: padding=${count.padding}, title=${count.title}, subtitle=${count.subtitle}`);
}

// --- CSS changes ---
// Decrease min-height from 60px to 56px in .settings-list-item
for (const file of cssFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let count = 0;

    // Only change within .settings-list-item rule (min-height: 60px)
    const regex = /(min-height: )60px;/g;
    content = content.replace(regex, (m, p1) => {
        count++;
        return p1 + '56px;';
    });

    fs.writeFileSync(file, content);
    console.log(`${file}: min-height changes=${count}`);
}

console.log('DONE');
