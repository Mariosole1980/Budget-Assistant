const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

console.log('====================================================');
console.log('🚀 UNIVERSAL RELEASE (WEB + NATIVE/OTA)');
console.log('====================================================\n');

// Step 1: Git Working Tree Status Check (mandatory safety gate)
// Equivalent to the release-deploy safety check: abort if the tree is dirty so
// we never release from an uncommitted, unreproducible state.
console.log('[STEP 1/7] Checking Git working tree status...');
const statusOutput = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
if (statusOutput.length > 0) {
    console.error('[ERROR] Dirty working tree detected!');
    console.error('Uncommitted changes found in repository:');
    console.error(statusOutput);
    console.error('\nUniversal release aborted. Please commit or stash uncommitted work before releasing.\n');
    process.exit(1);
}
console.log('  [PASS] Git working tree is clean.\n');

// Step 1.5: Native-change detection (deterministic, conservative).
// Runs AFTER the git-clean check but BEFORE version-bump. At this point HEAD is
// the developer's committed state, so `git diff <last-release>..HEAD` contains
// ONLY real developer changes (version-sync has not run yet). This avoids the
// classification trap where version-sync rewrites version markers in
// android/app/build.gradle on every release (which would otherwise make every
// release look "native-relevant").
//
// CONSERVATIVE: any doubt (no baseline, diff failure, native-relevant change)
// → FULL native build. We never skip a safety gate.
console.log('[STEP 1.5/7] Detecting native-relevant changes...');
const NATIVE_RELEVANT_PATHS = [
    /^android\//,
    /^capacitor\.config\.json$/,
    /^package\.json$/,
    /^package-lock\.json$/
];

function detectNativeChange() {
    let baseline = '';
    try {
        baseline = execSync('git log --oneline --grep="release: build v" -1 --format=%H', { cwd: rootDir, encoding: 'utf8' }).trim();
    } catch (e) {
        baseline = '';
    }
    if (!baseline) {
        console.log('  [INFO] No prior release baseline found → FULL native build (safe fallback).');
        return true;
    }
    let changedFiles = [];
    try {
        changedFiles = execSync(`git diff --name-only ${baseline}..HEAD`, { cwd: rootDir, encoding: 'utf8' })
            .split('\n').map(s => s.trim()).filter(Boolean);
    } catch (e) {
        console.log('  [INFO] Could not compute diff → FULL native build (safe fallback).');
        return true;
    }
    const nativeChanged = changedFiles.some(f => NATIVE_RELEVANT_PATHS.some(re => re.test(f)));
    if (nativeChanged) {
        console.log('  [INFO] Native-relevant changes detected → FULL native build.');
    } else {
        console.log('  [INFO] No native-relevant changes → WEB-ONLY release (skip native build).');
    }
    return nativeChanged;
}

const nativeChanged = detectNativeChange();
process.env.RELEASE_NATIVE_MODE = nativeChanged ? 'full' : 'web';
console.log(`  [PASS] Release mode: ${nativeChanged ? 'FULL NATIVE' : 'WEB-ONLY'}\n`);

// Step 2: Bump version (so the build number always increments on every release)
console.log('[STEP 2/7] Bumping version...');
execSync('node scripts/version-bump.js', { cwd: rootDir, stdio: 'inherit' });

const version = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;
console.log(`  [PASS] New build version: ${version}\n`);

// Step 3: Version consistency check (STRICT / GATING — abort on failure)
// Previously this was WARN-only; it is now a mandatory gate so a version
// mismatch stops the release instead of continuing with a broken build.
console.log('[STEP 3/7] Running strict version consistency check...');
execSync('node scripts/version-check.js', { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Version check passed.\n');

// Step 4: Static health gate (mandatory — abort on failure)
// verify-health.js runs syntax checks, unit tests, script dependency/order
// checks, version consistency, and a brace-balance heuristic. It is the static
// complement to release-verify-live.js and must pass before any build/deploy.
console.log('[STEP 4/7] Running static health verification (verify-health)...');
execSync('node scripts/verify-health.js', { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Static health verification passed.\n');

// Step 5: Commit release state BEFORE build/deploy.
// Required so the Step 1 git status check remains clean for the next release
// (version-bump/version-sync modify tracked files) and to preserve
// reproducibility. Mirrors the release-deploy workflow.
//
// SAFETY: We use an EXPLICIT ALLOWLIST instead of `git add -A` so that no
// untracked or unexpected file can ever be swept into a release commit. Only
// the files that version-sync legitimately modifies for a release are staged.
console.log('[STEP 5/7] Committing release state to Git...');
const releaseFiles = [
    'version.json',
    'index.html',
    'sw.js',
    'app.js',
    'js/translations.js',
    'android/app/build.gradle'
];
execSync(`git add ${releaseFiles.join(' ')}`, { cwd: rootDir, stdio: 'inherit' });
execSync(`git commit -m "release: build v${version} [automated universal release]"`, { cwd: rootDir, stdio: 'inherit' });
console.log(`  [PASS] Git commit created for release v${version}.\n`);

// Step 6: Release (native + OTA, or web-only).
// The mode is decided deterministically in Step 1.5:
//   - FULL NATIVE: configure signing, Capacitor sync, gradle APK/AAB (parallel
//     with OTA bundle), copy artifacts, OTA bundle, then the SINGLE Cloudflare
//     Pages deploy of www/ (web app + OTA zip + version.json).
//   - WEB-ONLY: skip configure signing / cap sync / gradle / native artifacts,
//     but STILL generate the OTA bundle and perform the SINGLE Cloudflare Pages
//     deploy so the new web build reaches the CDN and the native app via OTA.
// Cloudflare is deployed EXACTLY ONCE per release path. All safety gates
// (version-check, verify-health, live verification) run on BOTH paths.
console.log(`[STEP 6/7] Running ${nativeChanged ? 'native + OTA' : 'web-only'} release (single Cloudflare deploy)...`);
execSync('node scripts/release-native.js', { cwd: rootDir, stdio: 'inherit' });
console.log(`  [PASS] ${nativeChanged ? 'Native + OTA' : 'Web-only'} release complete.\n`);

// Step 7: Live verification (STRICT / GATING — abort on failure)
// Previously this was WARN-only; it is now a mandatory gate so a failed live
// verification stops the release instead of reporting a false success.
console.log('[STEP 7/7] Running live production verification...');
execSync('node scripts/release-verify-live.js', { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Live production verification passed.\n');

console.log('====================================================');
console.log(`✨ SUCCESSFUL UNIVERSAL RELEASE: build v${version} (${nativeChanged ? 'FULL NATIVE' : 'WEB-ONLY'})`);
console.log('====================================================');
console.log('Live URL:');
console.log('  - https://budget-assistant-pwa.pages.dev');
console.log(`  - OTA bundle: https://budget-assistant-pwa.pages.dev/com.budgetassistant.app_1.0.${version}.zip`);
