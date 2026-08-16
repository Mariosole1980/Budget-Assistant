const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Read Canonical Version
const versionJsonPath = path.join(rootDir, 'version.json');
if (!fs.existsSync(versionJsonPath)) {
  console.error('[ERROR] version.json not found at:', versionJsonPath);
  process.exit(1);
}

const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const version = versionData.version;
if (!version || typeof version !== 'number') {
  console.error('[ERROR] Invalid version in version.json:', versionData);
  process.exit(1);
}

console.log(`[VERSION-SYNC] Canonical Version: ${version}`);

// 2. Sync index.html
const indexPath = path.join(rootDir, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(/const CURRENT_BUILD = \d+;/g, `const CURRENT_BUILD = ${version};`);
indexContent = indexContent.replace(/build v\d+/gi, `build v${version}`);
indexContent = indexContent.replace(/<span id="user-guide-version-badge"[^>]*>v\d+<\/span>/gi,
  `<span id="user-guide-version-badge" style="font-size:10px; background:rgba(99,102,241,0.15); color:var(--primary); padding:2px 8px; border-radius:10px; font-weight:700; border:1px solid rgba(99,102,241,0.3);">v${version}</span>`);
indexContent = indexContent.replace(/(\.js|\.css|\.json)\?v=\d+/g, `$1?v=${version}`);

fs.writeFileSync(indexPath, indexContent);
console.log('  [OK] index.html updated');

// 3. Sync sw.js
const swPath = path.join(rootDir, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

swContent = swContent.replace(/\/\/ SW Version \d+/g, `// SW Version ${version}`);
swContent = swContent.replace(/const CACHE_NAME = 'money-manager-v\d+-'/g, `const CACHE_NAME = 'money-manager-v${version}-'`);

fs.writeFileSync(swPath, swContent);
console.log('  [OK] sw.js updated');

// 4. Sync app.js
const appPath = path.join(rootDir, 'app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(/build v\d+/g, `build v${version}`);
// NOTE: The Greek guide title/version strings are now DYNAMIC (read CURRENT_BUILD
// at runtime via template literals), so they self-sync and need no static replace.
// Only the English guide strings remain static and require sync below.
appContent = appContent.replace(/title: '1\. Version & What\\'s New \(v\d+\)'/g, `title: '1. Version & What\\'s New (v${version})'`);
appContent = appContent.replace(/<strong>Guide Version:<\/strong> v\d+/g, `<strong>Guide Version:</strong> v${version}`);
appContent = appContent.replace(/<strong>Synchronized App Version:<\/strong> v\d+/g, `<strong>Synchronized App Version:</strong> v${version}`);

fs.writeFileSync(appPath, appContent);
console.log('  [OK] app.js updated');

// 4b. Sync js/translations.js (the app_version translation string carries the
// "(build vN)" marker that was extracted from app.js in Phase 3).
const translationsPath = path.join(rootDir, 'js', 'translations.js');
if (fs.existsSync(translationsPath)) {
  let translationsContent = fs.readFileSync(translationsPath, 'utf8');
  translationsContent = translationsContent.replace(/build v\d+/g, `build v${version}`);
  fs.writeFileSync(translationsPath, translationsContent);
  console.log('  [OK] js/translations.js updated');
}

// 5. Sync android/app/build.gradle
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');
  gradleContent = gradleContent.replace(/versionCode \d+/g, `versionCode ${version}`);
  gradleContent = gradleContent.replace(/versionName "[^"]+"/g, `versionName "1.0.0-v${version}"`);
  fs.writeFileSync(gradlePath, gradleContent);
  console.log('  [OK] android/app/build.gradle updated');
}

// 5b. Sync OTA constants (packaging/versioning only — does NOT touch boot path or IndexedDB fallback)
const otaBootPath = path.join(rootDir, 'ota-boot-loader.js');
if (fs.existsSync(otaBootPath)) {
  let otaBootContent = fs.readFileSync(otaBootPath, 'utf8');
  otaBootContent = otaBootContent.replace(/var BUNDLED_APP_JS = 'app\.js\?v=\d+';/g, `var BUNDLED_APP_JS = 'app.js?v=${version}';`);
  otaBootContent = otaBootContent.replace(/var BUNDLED_STYLE_CSS = 'style\.css\?v=\d+';/g, `var BUNDLED_STYLE_CSS = 'style.css?v=${version}';`);
  fs.writeFileSync(otaBootPath, otaBootContent);
  console.log('  [OK] ota-boot-loader.js OTA constants updated');
}

const otaEnginePath = path.join(rootDir, 'js', 'OTAEngine.js');
if (fs.existsSync(otaEnginePath)) {
  let otaEngineContent = fs.readFileSync(otaEnginePath, 'utf8');
  otaEngineContent = otaEngineContent.replace(/var BUNDLED_NATIVE_VERSION = \d+;/g, `var BUNDLED_NATIVE_VERSION = ${version};`);
  fs.writeFileSync(otaEnginePath, otaEngineContent);
  console.log('  [OK] js/OTAEngine.js BUNDLED_NATIVE_VERSION updated');
}

// 6. Mirror to www/ folder
const wwwDir = path.join(rootDir, 'www');
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

const filesToMirror = [
  'app.js',
  'index.html',
  'style.css',
  'desktop.css',
  'web-ui.js',
  'sw.js',
  'manifest.json',
  'version.json',
  '_headers',
  'privacy.html',
  'clear.html',
  'nuke.html',
  'debug.html',
  'xlsx.full.min.js',
  'ota-boot-loader.js',
  'logo-mark.png',
  'icon.png',
  'icon-192.png'
];

filesToMirror.forEach(file => {
  const src = path.join(rootDir, file);
  const dst = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  }
});

const dirsToMirror = ['js', 'assets', 'webfonts', 'functions'];
dirsToMirror.forEach(dir => {
  const src = path.join(rootDir, dir);
  const dst = path.join(wwwDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true });
  }
});

console.log('  [OK] Mirrored all root assets cleanly to www/');
console.log('[VERSION-SYNC] Synchronization complete.\n');
