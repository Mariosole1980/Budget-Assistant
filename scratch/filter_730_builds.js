const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/all_builds_search.json', 'utf8'));
console.log(`Loaded ${data.length} records.`);

const filtered = data.filter(item => {
  const s = item.snippet.toLowerCase();
  return s.includes('730') || s.includes('729') || s.includes('731');
});

fs.writeFileSync('scratch/filtered_730_builds.json', JSON.stringify(filtered, null, 2));
console.log(`Filtered down to ${filtered.length} records.`);

// Group by brain ID to see where they are
const groups = {};
filtered.forEach(item => {
  const match = item.file.match(/brain\\([^\\]+)/);
  const brainId = match ? match[1] : 'unknown';
  if (!groups[brainId]) groups[brainId] = [];
  groups[brainId].push(item);
});

Object.keys(groups).forEach(brainId => {
  console.log(`Brain ${brainId}: ${groups[brainId].length} records`);
});
