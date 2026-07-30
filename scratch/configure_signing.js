const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');
const versionPath = 'version.json';

if (!fs.existsSync(versionPath)) {
  console.error('version.json not found!');
  process.exit(1);
}

const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const buildNum = versionData.version;

let content = fs.readFileSync(gradlePath, 'utf8');

// 1. Update versionCode and versionName
content = content.replace(/versionCode \d+/, `versionCode ${buildNum}`);
content = content.replace(/versionName "[^"]+"/, `versionName "1.0.${buildNum}"`);

// 2. Add signingConfigs if not present
const signingConfigBlock = `    signingConfigs {
        release {
            storeFile file("../release.keystore")
            storePassword "mariobudget123"
            keyAlias "budgetassistant"
            keyPassword "mariobudget123"
        }
    }`;

if (!content.includes('signingConfigs {')) {
  // Insert signingConfigs before buildTypes
  content = content.replace(/buildTypes {/, `${signingConfigBlock}\n    buildTypes {`);
}

// 3. Add signingConfig to release build type
if (!content.includes('signingConfig signingConfigs.release')) {
  content = content.replace(
    /release {\s*minifyEnabled/,
    `release {\n            signingConfig signingConfigs.release\n            minifyEnabled`
  );
}

fs.writeFileSync(gradlePath, content, 'utf8');
console.log(`Successfully configured android/app/build.gradle for build ${buildNum}`);
