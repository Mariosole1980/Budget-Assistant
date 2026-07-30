const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Running git log command...");
  const output = execSync('git log -p -S "calc-key-btn" style.css', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync('scratch/git_calc_key_btn_changes_utf8.txt', output, 'utf-8');
  console.log("Output saved in UTF-8 format to scratch/git_calc_key_btn_changes_utf8.txt");
} catch (e) {
  console.error("Error executing git log:", e);
}
