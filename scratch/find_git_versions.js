const { execSync } = require('child_process');

try {
  console.log("Searching git commit log for versions in the 700s-800s...");
  const output = execSync('git log --all --grep="v7" --grep="v8" --oneline', { encoding: 'utf8' });
  console.log("Matches:");
  console.log(output || "(none)");
} catch (e) {
  console.error("Error running git log search:", e);
}
