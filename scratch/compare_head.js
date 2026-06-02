const { execSync } = require('child_process');
try {
  const rootCommits = execSync('git log -n 1 --oneline app.js', { encoding: 'utf8', cwd: 'c:\\Users\\mario\\Desktop\\money-manager' });
  const subCommits = execSync('git log -n 1 --oneline money-manager/app.js', { encoding: 'utf8', cwd: 'c:\\Users\\mario\\Desktop\\money-manager' });
  console.log('Last commit for root app.js:', rootCommits.trim());
  console.log('Last commit for nested app.js:', subCommits.trim());

  const diff = execSync('git diff HEAD:app.js HEAD:money-manager/app.js', { encoding: 'utf8', cwd: 'c:\\Users\\mario\\Desktop\\money-manager' });
  console.log('Diff size between root and nested app.js in HEAD:', diff.length);
  if (diff.length > 0) {
    console.log(diff.substring(0, 500));
  }
} catch (e) {
  console.error(e);
}
