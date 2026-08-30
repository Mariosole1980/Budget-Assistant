const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

// Release mode is decided deterministically by release-all.js (Step 1.5) and
// passed via env var. Default is 'full' so this script remains safe/backward
// compatible if invoked directly (it always performs the full native build).
const mode = process.env.RELEASE_NATIVE_MODE === 'web' ? 'web' : 'full';

console.log('====================================================');
console.log(`📱 AUTOMATED ${mode === 'full' ? 'NATIVE + OTA' : 'WEB-ONLY + OTA'} RELEASE STAGE`);
console.log('====================================================\n');

// Read canonical version
if (!fs.existsSync(versionJsonPath)) {
    console.error('[ERROR] version.json not found at:', versionJsonPath);
    process.exit(1);
}
const version = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;
if (!version || typeof version !== 'number') {
    console.error('[ERROR] Invalid version in version.json:', version);
    process.exit(1);
}
console.log(`[INFO] Release for build v${version} (mode: ${mode})\n`);

// Resolve the Capgo CLI (used for OTA bundle generation) directly via node.
// The `npx @capgo/cli` bin shim can be missing from node_modules/.bin (e.g.
// after an npx cleanup/temp-file mess), which makes `npx @capgo/cli` fail with
// "'capgo' is not recognized" even though the package is installed. Calling
// dist/index.js with node bypasses npx/bin-shim resolution entirely.
const capgoCliPath = path.join(rootDir, 'node_modules', '@capgo', 'cli', 'dist', 'index.js');
const capgoCliCmd = fs.existsSync(capgoCliPath) ? `node "${capgoCliPath}"` : 'npx @capgo/cli';

// Helper: run a command in the background (streaming output) and return a
// Promise that resolves on exit code 0 or rejects on failure.
function runAsync(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with exit code ${code}: ${cmd} ${args.join(' ')}`));
        });
        child.on('error', reject);
    });
}

// Helper: wait for a background process to finish (used to join the gradle
// build that was started in parallel with the OTA bundle).
function waitFor(child) {
    return new Promise((resolve, reject) => {
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Background command failed with exit code ${code}`));
        });
        child.on('error', reject);
    });
}

async function main() {
    // Hoisted to function scope so the final summary can reference it.
    let filename = '';

    // =====================================================================
    // FULL NATIVE PATH
    // =====================================================================
    if (mode === 'full') {
        // Step 1: Configure signing + versionCode/versionName in build.gradle
        console.log('[STEP 1/6] Configuring Android signing + version...');
        execSync('node scratch/configure_signing.js', { cwd: rootDir, stdio: 'inherit' });

        // Step 2: Capacitor sync
        // MUST complete before gradle starts (gradle reads
        // android/app/src/main/assets/public/ which cap sync populates).
        console.log('[STEP 2/6] Running npx cap sync android...');
        execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });
        execSync('node scripts/patch-billing.js', { cwd: rootDir, stdio: 'inherit' });
        console.log('  [PASS] Capacitor sync complete.\n');

        // Step 3 + Step 5 (parallel): Gradle Android builds ∥ Capgo OTA bundle.
        // SAFETY: These touch disjoint directories — gradle reads/writes
        // android/app/src/main/assets/public/ and android/app/build/, while the
        // OTA bundle reads/writes www/ (populated earlier by version-sync).
        // No shared files, so running them concurrently is dependency-safe.
        console.log('[STEP 3+5/6] Building Android (Debug APK, Release APK, AAB) in parallel with OTA bundle...');
        const gradleProc = spawn('gradlew.bat', ['assembleDebug', 'assembleRelease', 'bundleRelease'], {
            cwd: path.join(rootDir, 'android'),
            stdio: 'inherit',
            shell: true
        });

        // Clean up any stale zip files in root or www/ before bundling to prevent nested zips
        const wwwDir = path.join(rootDir, 'www');
        fs.readdirSync(rootDir).filter(f => f.endsWith('.zip')).forEach(f => {
            try { fs.rmSync(path.join(rootDir, f), { force: true }); } catch (e) { }
        });
        if (fs.existsSync(wwwDir)) {
            fs.readdirSync(wwwDir).filter(f => f.endsWith('.zip')).forEach(f => {
                try { fs.rmSync(path.join(wwwDir, f), { force: true }); } catch (e) { }
            });
        }

        // OTA bundle (runs while gradle builds in the background)
        const bundleCmd = `${capgoCliCmd} bundle zip com.budgetassistant.app -b "1.0.${version}" -j --no-code-check --key-v2`;
        const jsonOutput = execSync(bundleCmd, { cwd: rootDir, encoding: 'utf8' });

        const startIndex = jsonOutput.indexOf('{');
        if (startIndex < 0) {
            console.error('[ERROR] Could not parse Capgo bundle output:', jsonOutput);
            await waitFor(gradleProc).catch(() => { });
            process.exit(1);
        }
        const zipData = JSON.parse(jsonOutput.substring(startIndex));
        const checksum = zipData.checksum;
        filename = zipData.filename;
        console.log(`  [PASS] OTA bundle generated: ${filename}`);

        // Copy the zip into www/ (so it is served from the CDN)
        const zipSrc = path.join(rootDir, filename);
        const zipDst = path.join(wwwDir, filename);
        fs.copyFileSync(zipSrc, zipDst);
        fs.rmSync(zipSrc, { force: true });
        console.log(`  [PASS] OTA bundle copied to www/${filename}`);

        // Rewrite www/version.json with Capgo bundle info (OTA manifest)
        const versionData = {
            version: `1.0.${version}`,
            url: `https://budget-assistant-pwa.pages.dev/${filename}`,
            checksum: checksum
        };
        fs.writeFileSync(path.join(wwwDir, 'version.json'), JSON.stringify(versionData, null, 4));
        console.log('  [PASS] www/version.json updated with OTA bundle info.\n');

        // Join the gradle build (started in parallel above)
        console.log('[STEP 3/6] Waiting for Android builds to complete...');
        await waitFor(gradleProc);
        console.log('  [PASS] Android builds completed.\n');

        // Step 4: Copy APKs & AAB to Desktop
        console.log('[STEP 4/6] Copying builds to Desktop...');
        const desktopDir = path.join(os.homedir(), 'Desktop');
        const apkReleaseSource = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
        const aabSource = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

        if (fs.existsSync(apkReleaseSource)) {
            fs.copyFileSync(apkReleaseSource, path.join(desktopDir, 'BudgetAssistant-Latest.apk'));
            console.log('  [PASS] Signed Release APK copied to Desktop as BudgetAssistant-Latest.apk');
        } else {
            console.error('[ERROR] Release APK not found at', apkReleaseSource);
            process.exit(1);
        }
        if (fs.existsSync(aabSource)) {
            fs.copyFileSync(aabSource, path.join(desktopDir, 'BudgetAssistant.aab'));
            console.log('  [PASS] Signed Play Store Bundle copied to Desktop as BudgetAssistant.aab');
        } else {
            console.error('[ERROR] Play Store Bundle (AAB) not found at', aabSource);
            process.exit(1);
        }
        console.log('');
    }

    // =====================================================================
    // WEB-ONLY PATH (shared OTA + deploy with full path)
    // =====================================================================
    if (mode === 'web') {
        // Web-only skips configure_signing, cap sync, gradle, and native
        // artifact generation. It STILL generates the OTA bundle so the native
        // app receives the new web build, and performs the SINGLE Cloudflare
        // Pages deploy. All safety gates (version-check, verify-health, live
        // verification) are enforced by release-all.js on this path too.
        console.log('[STEP 5/6] Generating Capgo OTA bundle (web-only)...');
        const bundleCmd = `${capgoCliCmd} bundle zip com.budgetassistant.app -b "1.0.${version}" -j --no-code-check --key-v2`;
        const jsonOutput = execSync(bundleCmd, { cwd: rootDir, encoding: 'utf8' });

        const startIndex = jsonOutput.indexOf('{');
        if (startIndex < 0) {
            console.error('[ERROR] Could not parse Capgo bundle output:', jsonOutput);
            process.exit(1);
        }
        const zipData = JSON.parse(jsonOutput.substring(startIndex));
        const checksum = zipData.checksum;
        filename = zipData.filename;
        console.log(`  [PASS] OTA bundle generated: ${filename}`);

        // Copy the zip into www/ (so it is served from the CDN)
        const wwwDir = path.join(rootDir, 'www');
        const zipSrc = path.join(rootDir, filename);
        const zipDst = path.join(wwwDir, filename);
        fs.copyFileSync(zipSrc, zipDst);
        fs.rmSync(zipSrc, { force: true });
        console.log(`  [PASS] OTA bundle copied to www/${filename}`);

        // Rewrite www/version.json with Capgo bundle info (OTA manifest)
        const versionData = {
            version: `1.0.${version}`,
            url: `https://budget-assistant-pwa.pages.dev/${filename}`,
            checksum: checksum
        };
        fs.writeFileSync(path.join(wwwDir, 'version.json'), JSON.stringify(versionData, null, 4));
        console.log('  [PASS] www/version.json updated with OTA bundle info.\n');
    }

    // =====================================================================
    // SHARED: Single Cloudflare Pages deploy (EXACTLY ONCE per release path)
    // =====================================================================
    console.log('[STEP 6/6] Deploying www/ to Cloudflare Pages (single deploy)...');
    const wranglerPath = process.platform === 'win32' ? 'cmd /c npx wrangler' : 'npx wrangler';
    execSync(`${wranglerPath} pages deploy www --project-name=budget-assistant-pwa --branch=main`, { cwd: rootDir, stdio: 'inherit' });
    console.log('  [PASS] Cloudflare Pages deployed with OTA bundle.\n');

    console.log('====================================================');
    console.log(`📱 SUCCESSFUL ${mode === 'full' ? 'NATIVE + OTA' : 'WEB-ONLY + OTA'} RELEASE: build v${version}`);
    console.log('====================================================');
    if (mode === 'full') {
        console.log('Artifacts:');
        console.log('  - Desktop/BudgetAssistant-Latest.apk');
        console.log('  - Desktop/BudgetAssistant.aab');
    }
    console.log(`  - OTA bundle: https://budget-assistant-pwa.pages.dev/${filename}`);
}

main().catch((err) => {
    console.error('[ERROR] Release stage failed:', err.message);
    process.exit(1);
});
