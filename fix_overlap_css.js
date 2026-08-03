// Fix the overlapping text UI issue in the version row (Account & Legal screen).
// Root cause: .settings-item-value can be squeezed to zero width (no flex-shrink:0),
// and .settings-item-label doesn't take available space, so the long version text
// overlaps the "Budget Assistant" value.
//
// Approach: scope the fix to the version row only (via a dedicated class) so other
// settings screens are NOT affected.
const fs = require('fs');

// 1. Add a dedicated class to the version row in index.html (and www/index.html)
const htmlFiles = ['index.html', 'www/index.html'];
for (const file of htmlFiles) {
    if (!fs.existsSync(file)) {
        console.log(`SKIP (missing): ${file}`);
        continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    // The version row div spans two lines. Match the opening div tag regardless of
    // CRLF/LF line endings.
    const oldRow = /<div class="settings-list-item"\r?\n\s*style="padding: 14px 16px; background: transparent; border-top: 1px solid var\(--border\); margin-top: 8px;">/;
    const newRow = `<div class="settings-list-item version-info-row"\n              style="padding: 14px 16px; background: transparent; border-top: 1px solid var(--border); margin-top: 8px;">`;
    if (oldRow.test(content)) {
        content = content.replace(oldRow, newRow);
        fs.writeFileSync(file, content);
        console.log(`  [OK] Added version-info-row class (${file})`);
    } else {
        console.log(`  [WARN] version row not found (${file})`);
    }
}

// 2. Add scoped CSS for the version row (style.css and www/style.css)
const cssFiles = ['style.css', 'www/style.css'];
const scopedCss = `
/* Version info row (Account & Legal): prevent label/value overlap.
   Scoped to .version-info-row so other settings screens are unaffected. */
.version-info-row {
  align-items: flex-start;
  gap: 12px;
}
.version-info-row .settings-item-label {
  flex: 1 1 auto;
  min-width: 0;
}
.version-info-row .settings-item-value {
  flex-shrink: 0;
  white-space: nowrap;
  text-align: right;
}
`;

for (const file of cssFiles) {
    if (!fs.existsSync(file)) {
        console.log(`SKIP (missing): ${file}`);
        continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('.version-info-row')) {
        console.log(`  [SKIP] already has version-info-row CSS (${file})`);
        continue;
    }
    content += scopedCss;
    fs.writeFileSync(file, content);
    console.log(`  [OK] Appended version-info-row CSS (${file})`);
}

console.log('DONE');
