const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Extracting style.css content from commit e6c7a87 (Step 7306)...");
  const fileContent = execSync('git show e6c7a87:style.css', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const lines = fileContent.split('\n');
  
  let output = "";
  
  lines.forEach((line, idx) => {
    const upper = line.toUpperCase();
    if (upper.includes('CALC-') || upper.includes('KEYPAD') || upper.includes('KEY-BTN') || upper.includes('KEYBOARD-OFFSET')) {
      output += `Line ${idx + 1}: ${line.trim()}\n`;
      output += "  Context:\n";
      const start = Math.max(0, idx - 3);
      const end = Math.min(lines.length - 1, idx + 5);
      for (let i = start; i <= end; i++) {
        const prefix = i === idx ? '=>' : '  ';
        output += `    ${prefix} L${i + 1}: ${lines[i]}\n`;
      }
      output += '----------------------------------------------------\n';
    }
  });
  
  fs.writeFileSync('scratch/style_at_7306_utf8.txt', output, 'utf-8');
  console.log("Saved style_at_7306_utf8.txt");
} catch (e) {
  console.error("Error showing style.css from commit:", e);
}
