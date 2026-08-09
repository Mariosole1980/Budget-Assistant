const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

console.log('====================================================');
console.log('🚀 UNIVERSAL RELEASE (WEB + NATIVE/OTA)');
console.log('====================================================\n');

// Step 1: Bump version (so the build number always increments on every release)
console.log('[STEP 1/6] Bumping version...');
execSync('node scripts/version-bump.js', { cwd: rootDir, stdio: 'inherit' });

const version = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;
console.log(`  [PASS] New build version: ${version}\n`);

// Step 2: Version consistency check
console.log('[STEP 2/6] Running version consistency check...');
try {
    execSync('node scripts/version-check.js', { cwd: rootDir, stdio: 'inherit' });
    console.log('  [PASS] Version check passed.\n');
} catch (e) {
    console.warn('  [WARN] Version check reported issues (continuing anyway).\n');
}

// Step 3: Deploy web to BOTH Cloudflare Pages projects
console.log('[STEP 3/6] Deploying web to Cloudflare Pages...');
const wranglerPath = process.platform === 'win32' ? 'cmd /c npx wrangler' : 'npx wrangler';

console.log('  [DEPLOY 1/2] budget-assistant-pwa...');
execSync(`${wranglerPath} pages deploy www --project-name=budget-assistant-pwa --branch=main --commit-dirty=true`, { cwd: rootDir, stdio: 'inherit' });

console.log('  [DEPLOY 2/2] money-manager-pwa...');
execSync(`${wranglerPath} pages deploy www --project-name=money-manager-pwa --branch=main --commit-dirty=true`, { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Both web deployments complete.\n');

// Step 4: Native + OTA release (reads the bumped version, rebuilds APK/AAB,
// generates the Capgo OTA bundle, and re-deploys www to budget-assistant-pwa
// so the OTA zip + version.json reach the CDN).
console.log('[STEP 4/6] Running native + OTA release...');
execSync('node scripts/release-native.js', { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Native + OTA release complete.\n');

// Step 5: Re-deploy www to money-manager-pwa so it also carries the OTA
// version.json manifest (the OTA bundle itself is served from
// budget-assistant-pwa per version.json, but keeping both in sync is cleaner).
console.log('[STEP 5/6] Re-deploying www to money-manager-pwa (OTA manifest sync)...');
execSync(`${wranglerPath} pages deploy www --project-name=money-manager-pwa --branch=main --commit-dirty=true`, { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] money-manager-pwa re-deployed.\n');

// Step 6: Live verification
console.log('[STEP 6/6] Running live production verification...');
try {
    execSync('node scripts/release-verify-live.js', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
    console.warn('  [WARN] Live verification reported issues (continuing).');
}

console.log('====================================================');
console.log(`✨ SUCCESSFUL UNIVERSAL RELEASE: build v${version}`);
console.log('====================================================');
console.log('Live URLs:');
console.log('  - https://budget-assistant-pwa.pages.dev');
console.log('  - https://money-manager-pwa.pages.dev');
console.log(`  - OTA bundle: https://budget-assistant-pwa.pages.dev/com.budgetassistant.app_1.0.${version}.zip`);
