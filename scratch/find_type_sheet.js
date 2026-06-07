const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split(/\r?\n/);

function findSnippet(term) {
  console.log(`\n=================== SEARCHING SNIPPET FOR: ${term} ===================`);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(term)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    console.log(`Could not find ${term}`);
    return;
  }

  let output = [];
  for (let i = Math.max(0, startIdx - 5); i < Math.min(startIdx + 40, lines.length); i++) {
    output.push(`${i + 1}: ${lines[i]}`);
  }
  console.log(output.join('\n'));
}

findSnippet('search-bottom-sheet-type');
findSnippet('search-bottom-sheet-period');
findSnippet('search-bottom-sheet-account');
findSnippet('search-bottom-sheet-category');
findSnippet('search-bottom-sheet-amount');
