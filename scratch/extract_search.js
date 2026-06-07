const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split(/\r?\n/);

function findFunction(name) {
  console.log(`\n=================== SEARCHING FOR: ${name} ===================`);
  let found = false;
  let braces = 0;
  let startIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${name}`) || lines[i].includes(`${name} = function`) || lines[i].includes(`${name}(`)) {
      if (lines[i].includes('function') || lines[i].trim().startsWith(name + ' =') || lines[i].trim().startsWith(name + '(')) {
        startIdx = i;
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    console.log(`Could not find function '${name}'`);
    return;
  }
  
  console.log(`Found starting at line ${startIdx + 1}:`);
  let output = [];
  for (let i = startIdx; i < Math.min(startIdx + 150, lines.length); i++) {
    output.push(`${i + 1}: ${lines[i]}`);
    // count braces to find the end
    const line = lines[i];
    for (let c of line) {
      if (c === '{') braces++;
      if (c === '}') braces--;
    }
    if (braces === 0 && i > startIdx && line.includes('}')) {
      break;
    }
  }
  console.log(output.join('\n'));
}

findFunction('handleSearchChange');
findFunction('resetSearchFilters');
findFunction('openSearchBottomSheet');
findFunction('selectPeriodSearchFilter');
findFunction('selectTypeSearchFilter');
findFunction('selectAccountSearchFilter');
findFunction('selectCategorySearchFilter');
findFunction('applyAdvancedSearchFiltersVisual');
