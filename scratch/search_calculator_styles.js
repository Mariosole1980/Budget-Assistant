const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf-8');
const lines = css.split('\n');

console.log("Searching style.css for calculator styles...");

let insideKeypad = false;
let linesPrinted = 0;

lines.forEach((line, idx) => {
  const upper = line.toUpperCase();
  if (upper.includes('CALC-') || upper.includes('KEYPAD') || upper.includes('KEY-BTN') || upper.includes('KEYBOARD-OFFSET')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    // Print 3 lines before and 5 lines after
    console.log("  Context:");
    const start = Math.max(0, idx - 3);
    const end = Math.min(lines.length - 1, idx + 8);
    for (let i = start; i <= end; i++) {
      const prefix = i === idx ? '=>' : '  ';
      console.log(`    ${prefix} L${i + 1}: ${lines[i]}`);
    }
    console.log('----------------------------------------------------');
  }
});
