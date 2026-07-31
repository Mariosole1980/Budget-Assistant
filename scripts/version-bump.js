const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

if (!fs.existsSync(versionJsonPath)) {
  console.error('[ERROR] version.json not found');
  process.exit(1);
}

const vData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const currentVersion = vData.version || 838;
const newVersion = currentVersion + 1;

vData.version = newVersion;
fs.writeFileSync(versionJsonPath, JSON.stringify(vData, null, 2));

console.log(`[VERSION-BUMP] Version incremented: ${currentVersion} -> ${newVersion}`);

// Execute version:sync
execSync('node scripts/version-sync.js', { cwd: rootDir, stdio: 'inherit' });
