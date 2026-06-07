const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split(/\r?\n/);

function findFunctionDefinition(name) {
  console.log(`\n=================== DEFINITION OF: ${name} ===================`);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${name}`) && !lines[i].includes('window.')) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    // Try without function keyword
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`${name} =`) || lines[i].includes(`${name}(`)) {
        if (!lines[i].includes('window.')) {
          startIdx = i;
          break;
        }
      }
    }
  }

  if (startIdx === -1) {
    console.log(`Could not find definition for ${name}`);
    return;
  }

  let braces = 0;
  let output = [];
  for (let i = startIdx; i < Math.min(startIdx + 250, lines.length); i++) {
    output.push(`${i + 1}: ${lines[i]}`);
    const line = lines[i];
    for (let c of line) {
      if (c === '{') braces++;
      if (c === '}') braces--;
    }
    if (braces === 0 && i > startIdx && (line.includes('}') || line.includes('};'))) {
      break;
    }
  }
  console.log(output.join('\n'));
}

findFunctionDefinition('handleSearchChange');
findFunctionDefinition('resetSearchFilters');
