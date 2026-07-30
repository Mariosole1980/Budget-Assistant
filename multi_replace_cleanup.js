const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// The exact first block to remove
const block1StartStr = '// 1. Auto-cleanup of bad "διάφορα συμπληρώματα" templates';
const block1EndStr = '    return !isBad;\n  });';

let b1Start = appJs.indexOf(block1StartStr);
let b1End = appJs.indexOf(block1EndStr) + block1EndStr.length;

if (b1Start !== -1 && b1End !== -1) {
  // slice until the end of the if-statement checking if updated
  const block1FullEndStr = '  if ((state.recurringTemplates || []).length !== originalLength) {\n    updated = true;\n  }';
  const b1FullEnd = appJs.indexOf(block1FullEndStr) + block1FullEndStr.length;
  if (b1FullEnd > b1Start) {
    appJs = appJs.substring(0, b1Start) + '// Block 1 removed safely\n' + appJs.substring(b1FullEnd);
  }
}

const block2StartStr = '// Broad automatic cleanup of duplicate/stranded templates and transactions';
const block2EndStr = '// C. Clean up stranded generated transactions';

let b2Start = appJs.indexOf(block2StartStr);
let b2End = appJs.indexOf(block2EndStr);

if (b2Start !== -1 && b2End !== -1 && b2Start < b2End) {
  appJs = appJs.substring(0, b2Start) + '// Block 2 removed safely\n  ' + appJs.substring(b2End);
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');
console.log("Replaced cleanly.");
