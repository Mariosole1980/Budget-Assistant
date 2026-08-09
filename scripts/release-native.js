const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');

console.log('====================================================');
console.log('📱 AUTOMATED NATIVE + OTA RELEASE STAGE');
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
console.log(`[INFO] Native release for build v${version}\n`);

// Step 1: Configure signing + versionCode/versionName in build.gradle
console.log('[STEP 1/6] Configuring Android signing + version...');
execSync('node scratch/configure_signing.js', { cwd: rootDir, stdio: 'inherit' });

// Step 2: Capacitor sync
console.log('[STEP 2/6] Running npx cap sync android...');
execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Capacitor sync complete.\n');

// Step 3: Gradle Android builds (Debug APK, Release APK, AAB)
console.log('[STEP 3/6] Building Android Debug APK, Release APK, and AAB...');
execSync('gradlew.bat assembleDebug assembleRelease bundleRelease', {
    cwd: path.join(rootDir, 'android'),
    stdio: 'inherit'
});
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

// Step 5: Generate Capgo OTA bundle and write www/version.json
console.log('[STEP 5/6] Generating Capgo OTA bundle...');
const bundleCmd = `npx @capgo/cli bundle zip com.budgetassistant.app -b "1.0.${version}" -j --no-code-check --key-v2`;
const jsonOutput = execSync(bundleCmd, { cwd: rootDir, encoding: 'utf8' });

const startIndex = jsonOutput.indexOf('{');
if (startIndex < 0) {
    console.error('[ERROR] Could not parse Capgo bundle output:', jsonOutput);
    process.exit(1);
}
const zipData = JSON.parse(jsonOutput.substring(startIndex));
const checksum = zipData.checksum;
const filename = zipData.filename;
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

// Step 6: Re-deploy www to Cloudflare Pages (so OTA zip + version.json reach the CDN)
console.log('[STEP 6/6] Re-deploying www/ to Cloudflare Pages (OTA bundle)...');
const wranglerPath = process.platform === 'win32' ? 'cmd /c npx wrangler' : 'npx wrangler';
execSync(`${wranglerPath} pages deploy www --project-name=budget-assistant-pwa --branch=main`, { cwd: rootDir, stdio: 'inherit' });
console.log('  [PASS] Cloudflare Pages re-deployed with OTA bundle.\n');

console.log('====================================================');
console.log(`📱 SUCCESSFUL NATIVE + OTA RELEASE: build v${version}`);
console.log('====================================================');
console.log('Artifacts:');
console.log('  - Desktop/BudgetAssistant-Latest.apk');
console.log('  - Desktop/BudgetAssistant.aab');
console.log(`  - OTA bundle: https://budget-assistant-pwa.pages.dev/${filename}`);
