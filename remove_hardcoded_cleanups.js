const fs = require('fs');

const appJsPath = 'c:/Users/mario/Desktop/money-manager/app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. Remove auto-cleanup of "διάφορα συμπληρώματα"
const block1Regex = /\/\/ 1\. Auto-cleanup of bad "διάφορα συμπληρώματα" templates[\s\S]*?updated = true;\s*\}/;
if (block1Regex.test(appJs)) {
  appJs = appJs.replace(block1Regex, '// Auto-cleanup of bad templates disabled to protect user data');
  console.log("Removed auto-cleanup of συμπληρώματα.");
} else {
  console.log("Block 1 regex not matched!");
}

// 2. Remove broad automatic cleanup of templates & transactions (lines 4413-4460)
const block2Regex = /\/\/ Broad automatic cleanup of duplicate\/stranded templates and transactions[\s\S]*?if \(match644\.length > 1\)[\s\S]*?\}\s*\}\s*\}/;
if (block2Regex.test(appJs)) {
  appJs = appJs.replace(block2Regex, '// Broad automatic cleanup disabled to protect user data');
  console.log("Removed broad automatic cleanup block.");
} else {
  console.log("Block 2 regex not matched!");
}

fs.writeFileSync(appJsPath, appJs, 'utf8');

// Also update www/app.js
fs.writeFileSync('c:/Users/mario/Desktop/money-manager/www/app.js', appJs, 'utf8');
console.log("Updated both app.js and www/app.js cleanly.");
