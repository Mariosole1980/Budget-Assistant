const fs = require('fs');
const path = require('path');

// Helper to replace text in a file
function replaceInFile(filepath, targets) {
  let content = fs.readFileSync(filepath, 'utf8');
  let originalLength = content.length;
  
  for (const target of targets) {
    if (!content.includes(target.search)) {
      console.error(`ERROR: Target not found in ${filepath}: \n"${target.search}"`);
      process.exit(1);
    }
    content = content.replace(target.search, target.replace);
  }
  
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Successfully updated ${filepath}. Bytes: ${originalLength} -> ${content.length}`);
}

// 1. Edits for app.js
const appJsTargets = [
  // Translations version bump
  {
    search: "app_version: 'Έκδοση 1.0.0 (build v219)',",
    replace: "app_version: 'Έκδοση 1.0.0 (build v220)',"
  },
  {
    search: "app_version: 'Version 1.0.0 (build v219)',",
    replace: "app_version: 'Version 1.0.0 (build v220)',"
  },
  // Add normalizeText and modify handleSearchChange
  {
    search: `function handleSearchChange() {
  const searchInput = document.getElementById('search-input');`,
    replace: `function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .trim();
}

function handleSearchChange() {
  const searchInput = document.getElementById('search-input');`
  },
  // Modify handleSearchChange query extraction and text query filtering
  {
    search: `  const query = searchInput.value.toLowerCase().trim();
  const filterType = document.getElementById('search-filter-type').value;
  const filterAcc = document.getElementById('search-filter-account').value;
  const filterCat = document.getElementById('search-filter-category').value;
  const filterSubEl = document.getElementById('search-filter-subcategory');
  const filterSub = filterSubEl ? filterSubEl.value : '';
  const minAmt = parseFloat(document.getElementById('search-filter-amount-min').value) || null;
  const maxAmt = parseFloat(document.getElementById('search-filter-amount-max').value) || null;
  const dateStart = document.getElementById('search-filter-date-start').value;
  const dateEnd = document.getElementById('search-filter-date-end').value;
  
  // Member Filter value
  const filterMember = document.getElementById('search-filter-member')?.value || '';

  const filtered = state.transactions.filter(t => {
    // 1. Text Query (Search in Note, Category, Subcategory, Description, Account)
    if (query) {
      const note = (t.note || '').toLowerCase();
      const cat = (t.category || '').toLowerCase();
      const sub = (t.subcategory || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const acc = (t.account_from || '').toLowerCase();
      const accTo = (t.account_to || '').toLowerCase();
      
      if (!note.includes(query) && !cat.includes(query) && !sub.includes(query) && !desc.includes(query) && !acc.includes(query) && !accTo.includes(query)) {
        return false;
      }
    }`,
    replace: `  const query = normalizeText(searchInput.value);
  const filterType = document.getElementById('search-filter-type').value;
  const filterAcc = document.getElementById('search-filter-account').value;
  const filterCat = document.getElementById('search-filter-category').value;
  const filterSubEl = document.getElementById('search-filter-subcategory');
  const filterSub = filterSubEl ? filterSubEl.value : '';
  const minAmt = parseFloat(document.getElementById('search-filter-amount-min').value) || null;
  const maxAmt = parseFloat(document.getElementById('search-filter-amount-max').value) || null;
  const dateStart = document.getElementById('search-filter-date-start').value;
  const dateEnd = document.getElementById('search-filter-date-end').value;
  
  // Member Filter value
  const filterMember = document.getElementById('search-filter-member')?.value || '';

  const filtered = state.transactions.filter(t => {
    // 1. Text Query (Search in Note, Category, Subcategory, Description, Account)
    if (query) {
      const note = normalizeText(t.note);
      const cat = normalizeText(t.category);
      const sub = normalizeText(t.subcategory);
      const desc = normalizeText(t.description);
      const acc = normalizeText(t.account_from);
      const accTo = normalizeText(t.account_to);
      
      if (!note.includes(query) && !cat.includes(query) && !sub.includes(query) && !desc.includes(query) && !acc.includes(query) && !accTo.includes(query)) {
        return false;
      }
    }`
  },
  // Null-safe Date Split
  {
    search: `    // 6. Date Range Filter
    const datePart = t.date.split('T')[0];`,
    replace: `    // 6. Date Range Filter
    const datePart = String(t.date || '').split('T')[0].split(' ')[0];`
  },
  // Autocomplete Suggestions Normalization in getAdvancedNotes
  {
    search: `  const q = (query || '').trim().toLowerCase();
  const suggestions = [];
  
  for (const [key, details] of noteDetails.entries()) {
    if (!q || key.includes(q)) {
      suggestions.push(details);
    }
  }
  
  // Sort suggestions: if there is a query, prioritize matches that start with the query
  if (q) {
    suggestions.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStarts = aTitle.startsWith(q);
      const bStarts = bTitle.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aTitle.localeCompare(bTitle);
    });
  }`,
    replace: `  const q = normalizeText(query);
  const suggestions = [];
  
  for (const [key, details] of noteDetails.entries()) {
    const normKey = normalizeText(details.title);
    if (!q || normKey.includes(q)) {
      suggestions.push(details);
    }
  }
  
  // Sort suggestions: if there is a query, prioritize matches that start with the query
  if (q) {
    suggestions.sort((a, b) => {
      const aTitle = normalizeText(a.title);
      const bTitle = normalizeText(b.title);
      const aStarts = aTitle.startsWith(q);
      const bStarts = bTitle.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aTitle.localeCompare(bTitle);
    });
  }`
  }
];

// Normalize newlines in app.js search targets to make sure they match CRLF
let appJsRaw = fs.readFileSync('app.js', 'utf8');
const isCrlf = appJsRaw.includes('\r\n');

const normalizedAppJsTargets = appJsTargets.map(target => {
  let search = target.search;
  let replace = target.replace;
  if (isCrlf) {
    search = search.replace(/\n/g, '\r\n');
    replace = replace.replace(/\n/g, '\r\n');
  } else {
    search = search.replace(/\r\n/g, '\n');
    replace = replace.replace(/\r\n/g, '\n');
  }
  return { search, replace };
});

replaceInFile('app.js', normalizedAppJsTargets);

// 2. Edits for index.html
const indexHtmlRaw = fs.readFileSync('index.html', 'utf8');
const isIndexCrlf = indexHtmlRaw.includes('\r\n');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const indexHtmlTargets = [
  {
    search: `Έκδοση 1.0.0 (build v219)`,
    replace: `Έκδοση 1.0.0 (build v220)`
  },
  {
    search: `id="deploy-timestamp" style="color: var(--text-muted); font-size: 10px; opacity: 0.6;">Deploy v219 · 07/06/2026 12:40`,
    replace: `id="deploy-timestamp" style="color: var(--text-muted); font-size: 10px; opacity: 0.6;">Deploy v220 · ${dateStr}`
  },
  {
    search: `<script src="app.js?v=219"></script>`,
    replace: `<script src="app.js?v=220"></script>`
  }
];

const normalizedIndexTargets = indexHtmlTargets.map(target => {
  let search = target.search;
  let replace = target.replace;
  if (isIndexCrlf) {
    search = search.replace(/\n/g, '\r\n');
    replace = replace.replace(/\n/g, '\r\n');
  } else {
    search = search.replace(/\r\n/g, '\n');
    replace = replace.replace(/\r\n/g, '\n');
  }
  return { search, replace };
});

replaceInFile('index.html', normalizedIndexTargets);

// 3. Edits for sw.js
const swTargets = [
  {
    search: `// SW Version 170`,
    replace: `// SW Version 171`
  }
];

replaceInFile('sw.js', swTargets);

console.log("All file modifications applied successfully!");
