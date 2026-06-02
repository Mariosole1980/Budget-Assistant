const { execSync } = require('child_process');
try {
  const diff = execSync('git diff app.js', { encoding: 'utf8', cwd: 'c:\\Users\\mario\\Desktop\\money-manager' });
  const lines = diff.split('\n');
  console.log('=== git diff app.js ===');
  // print first 100 lines of diff
  lines.slice(0, 150).forEach(line => console.log(line));
  if (lines.length > 150) {
    console.log(`... and ${lines.length - 150} more lines`);
  }
} catch (e) {
  console.error(e);
}
