const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

if (!fs.existsSync(versionJsonPath)) {
  console.error('[FAIL] version.json missing');
  process.exit(1);
}

const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const canonicalVersion = versionData.version;

let errors = [];

// 1. Check index.html
const indexPath = path.join(rootDir, 'index.html');
const indexTxt = fs.readFileSync(indexPath, 'utf8');

if (!indexTxt.includes(`const CURRENT_BUILD = ${canonicalVersion};`)) {
  errors.push(`index.html: CURRENT_BUILD does not match canonical version ${canonicalVersion}`);
}
if (!indexTxt.includes(`id="user-guide-version-badge"`)) {
  errors.push(`index.html: user-guide-version-badge missing`);
} else if (!indexTxt.includes(`>v${canonicalVersion}</span>`)) {
  errors.push(`index.html: user-guide-version-badge does not show v${canonicalVersion}`);
}

// 2. Check sw.js
const swPath = path.join(rootDir, 'sw.js');
const swTxt = fs.readFileSync(swPath, 'utf8');

if (!swTxt.includes(`// SW Version ${canonicalVersion}`)) {
  errors.push(`sw.js: // SW Version does not match canonical version ${canonicalVersion}`);
}
if (!swTxt.includes(`const CACHE_NAME = 'money-manager-v${canonicalVersion}-'`)) {
  errors.push(`sw.js: CACHE_NAME does not contain v${canonicalVersion}`);
}

// 3. Check app.js
const appPath = path.join(rootDir, 'app.js');
const appTxt = fs.readFileSync(appPath, 'utf8');

if (!appTxt.includes(`(build v${canonicalVersion}`)) {
  errors.push(`app.js: app_version build number does not match v${canonicalVersion}`);
}
// NOTE: The Greek guide title/version strings are now DYNAMIC (read CURRENT_BUILD
// at runtime via template literals), so they self-sync. Verify the dynamic pattern
// exists rather than a static version, to avoid false failures.
if (!appTxt.includes(`1. Έκδοση & Τι Νέο Υπάρχει (v\${typeof CURRENT_BUILD`)) {
  errors.push(`app.js: Greek guide title is not dynamic (expected CURRENT_BUILD template)`);
}
if (!appTxt.includes(`<strong>Τρέχουσα Έκδοση Εφαρμογής:</strong> v\${typeof CURRENT_BUILD`)) {
  errors.push(`app.js: Greek guide version string is not dynamic (expected CURRENT_BUILD template)`);
}

// 4. Check Root vs www parity
const wwwDir = path.join(rootDir, 'www');
const filesToCompare = ['version.json', 'sw.js', 'index.html', 'app.js'];

filesToCompare.forEach(f => {
  const rootFile = path.join(rootDir, f);
  const wwwFile = path.join(wwwDir, f);
  if (!fs.existsSync(wwwFile)) {
    errors.push(`www/${f} does not exist!`);
  } else {
    const rootBuf = fs.readFileSync(rootFile);
    const wwwBuf = fs.readFileSync(wwwFile);
    if (!rootBuf.equals(wwwBuf)) {
      errors.push(`www/${f} content does not match root ${f}!`);
    }
  }
});

// 5. Check for known stale markers (e.g. v934, v889)
const stalePatterns = [/v934/i, /v889/i];
stalePatterns.forEach(pattern => {
  if (pattern.test(indexTxt)) errors.push(`index.html contains stale pattern: ${pattern}`);
  if (pattern.test(swTxt)) errors.push(`sw.js contains stale pattern: ${pattern}`);
  if (pattern.test(appTxt)) errors.push(`app.js contains stale pattern: ${pattern}`);
});

if (errors.length > 0) {
  console.error('[FAIL] Version Check Failed with errors:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

console.log(`[PASS] Version Check PASSED for v${canonicalVersion}. All markers and www parity 100% verified.\n`);
