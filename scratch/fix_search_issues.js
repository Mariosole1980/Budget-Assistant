const fs = require('fs');

// =============================
// Fix 1: app.js
// =============================
let appJs = fs.readFileSync('app.js', 'utf8');
const isCrlf = appJs.includes('\r\n');

function fixNewlines(str) {
  if (isCrlf) return str.replace(/\n/g, '\r\n');
  return str.replace(/\r\n/g, '\n');
}

// Fix 1a: Remove the 4 deprecated old-filter calls from openSearchOverlay
// Those calls block sheet opening and cause lag
const oldOverlay = fixNewlines(`  // Render inline dashboard filters
  renderPeriodChips();
  renderAccountChips();
  setCategoryTypeFilter('expense');
  initAmountRangeSlider();`);

const newOverlay = fixNewlines(`  // Trigger initial search to show all transactions
  handleSearchChange();`);

if (!appJs.includes(oldOverlay)) {
  console.error('ERROR: openSearchOverlay old calls not found!');
  process.exit(1);
}
appJs = appJs.replace(oldOverlay, newOverlay);
console.log('Fix 1a applied: removed old filter render calls from openSearchOverlay');

// Fix 1b: Bump version to v221 for this new deployment
appJs = appJs.replace(
  "app_version: 'Έκδοση 1.0.0 (build v220)',",
  "app_version: 'Έκδοση 1.0.0 (build v221)',"
);
appJs = appJs.replace(
  "app_version: 'Version 1.0.0 (build v220)',",
  "app_version: 'Version 1.0.0 (build v221)',"
);
console.log('Fix 1b applied: bumped version to v221');

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('app.js written successfully');

// =============================
// Fix 2: style.css - Colors
// =============================
let css = fs.readFileSync('style.css', 'utf8');

// Summary bar: income uses --blue-positive (green), expense uses --red-negative
css = css.replace(
  `.search-summary-item.income .summary-val {\r\n  color: #3b82f6; /* Premium Cyan Blue */\r\n}`,
  `.search-summary-item.income .summary-val {\r\n  color: var(--blue-positive); /* Match transactions list */\r\n}`
);
css = css.replace(
  `.search-summary-item.expense .summary-val {\r\n  color: #ef4444; /* Premium Red/Pink */\r\n}`,
  `.search-summary-item.expense .summary-val {\r\n  color: var(--red-negative); /* Match transactions list */\r\n}`
);
css = css.replace(
  `.search-summary-item.transfer .summary-val {\r\n  color: #ffffff; /* White */\r\n}`,
  `.search-summary-item.transfer .summary-val {\r\n  color: var(--text-secondary); /* Match transactions list */\r\n}`
);

// Search result amounts: match the transaction list colors
css = css.replace(
  `.search-item-amount.expense {\r\n  color: #ef4444;\r\n}`,
  `.search-item-amount.expense {\r\n  color: var(--red-negative);\r\n}`
);
css = css.replace(
  `.search-item-amount.income {\r\n  color: #3b82f6;\r\n}`,
  `.search-item-amount.income {\r\n  color: var(--blue-positive);\r\n}`
);
css = css.replace(
  `.search-item-amount.transfer {\r\n  color: #ffffff;\r\n}`,
  `.search-item-amount.transfer {\r\n  color: var(--text-secondary);\r\n}`
);

fs.writeFileSync('style.css', css, 'utf8');
console.log('Fix 2 applied: updated search colors to match transaction list CSS variables');

// =============================
// Fix 3: index.html version bump
// =============================
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  'Έκδοση 1.0.0 (build v220)',
  'Έκδοση 1.0.0 (build v221)'
);
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
html = html.replace(
  /Deploy v220 · [\d\/\: ]+/,
  `Deploy v221 · ${dateStr}`
);
html = html.replace(
  `<script src="app.js?v=220"></script>`,
  `<script src="app.js?v=221"></script>`
);
fs.writeFileSync('index.html', html, 'utf8');
console.log('Fix 3 applied: index.html bumped to v221');

// =============================
// Fix 4: sw.js version bump
// =============================
let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace('// SW Version 171', '// SW Version 172');
fs.writeFileSync('sw.js', sw, 'utf8');
console.log('Fix 4 applied: sw.js bumped to SW Version 172');

console.log('\nAll fixes applied successfully!');
