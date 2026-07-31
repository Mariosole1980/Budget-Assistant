const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🚀 AUTOMATED FAIL-SAFE RELEASE WORKFLOW');
console.log('====================================================\n');

// Step 1: Git Working Tree Status Check
console.log('[STEP 1/7] Checking Git working tree status...');
const statusOutput = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
if (statusOutput.length > 0) {
  console.error('[ERROR] Dirty working tree detected!');
  console.error('Uncommitted changes found in repository:');
  console.error(statusOutput);
  console.error('\nRelease workflow aborted. Please commit or stash uncommitted work before releasing.\n');
  process.exit(1);
}
console.log('  [PASS] Git working tree is clean.\n');

// Step 2: Version Bump
console.log('[STEP 2/7] Incrementing version...');
execSync('node scripts/version-bump.js', { cwd: rootDir, stdio: 'inherit' });

// Step 3: Read New Version
const versionJsonPath = path.join(rootDir, 'version.json');
const newVersion = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;

// Step 4: Version Check
console.log('[STEP 3/7] Running strict version consistency check...');
execSync('node scripts/version-check.js', { cwd: rootDir, stdio: 'inherit' });

// Step 5: Git Commit Release State BEFORE Deploy
console.log('[STEP 4/7] Committing release state to Git...');
execSync('git add -A', { cwd: rootDir, stdio: 'inherit' });
execSync(`git commit -m "release: build v${newVersion} [automated release workflow]"`, { cwd: rootDir, stdio: 'inherit' });
console.log(`  [PASS] Git commit created for release v${newVersion}.\n`);

// Step 6: Deploy from www to Cloudflare Pages
console.log('[STEP 5/7] Deploying www/ artifact to Cloudflare Pages...');
const wranglerPath = process.platform === 'win32' ? 'cmd /c npx wrangler' : 'npx wrangler';

console.log('  [DEPLOY 1/2] Deploying to budget-assistant-pwa...');
execSync(`${wranglerPath} pages deploy www --project-name=budget-assistant-pwa --branch=main`, { cwd: rootDir, stdio: 'inherit' });

console.log('  [DEPLOY 2/2] Deploying to money-manager-pwa...');
execSync(`${wranglerPath} pages deploy www --project-name=money-manager-pwa --branch=main`, { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Both Cloudflare Pages deployments complete.\n');

// Step 7: Live Verification
console.log('[STEP 6/7] Running live production verification...');
execSync('node scripts/release-verify-live.js', { cwd: rootDir, stdio: 'inherit' });

console.log('====================================================');
console.log(`✨ SUCCESSFUL RELEASE: build v${newVersion}`);
console.log('====================================================');
console.log('Live URLs:');
console.log('  - https://budget-assistant-pwa.pages.dev');
console.log('  - https://money-manager-pwa.pages.dev\n');
