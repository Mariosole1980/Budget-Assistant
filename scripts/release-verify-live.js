const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');
const canonicalVersion = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;

const projects = [
  'https://budget-assistant-pwa.pages.dev',
  'https://money-manager-pwa.pages.dev'
];

function fetchLiveUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ReleaseVerifier/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', err => reject(err));
  });
}

async function verifyLive() {
  console.log(`[RELEASE-VERIFY-LIVE] Verifying live deployments for v${canonicalVersion}...`);
  let errors = [];
  const timestamp = Date.now();

  for (const baseUrl of projects) {
    console.log(`  Checking target: ${baseUrl}...`);
    try {
      // 1. Check version.json
      const vRes = await fetchLiveUrl(`${baseUrl}/version.json?_nocache=${timestamp}`);
      if (vRes.statusCode !== 200) {
        errors.push(`${baseUrl}/version.json HTTP ${vRes.statusCode}`);
      } else {
        const liveV = JSON.parse(vRes.data).version;
        if (liveV !== canonicalVersion) {
          errors.push(`${baseUrl}/version.json live version is ${liveV}, expected ${canonicalVersion}`);
        } else {
          console.log(`    [OK] version.json = ${liveV}`);
        }
      }

      // 2. Check sw.js
      const swRes = await fetchLiveUrl(`${baseUrl}/sw.js?_nocache=${timestamp}`);
      if (swRes.statusCode !== 200) {
        errors.push(`${baseUrl}/sw.js HTTP ${swRes.statusCode}`);
      } else if (!swRes.data.includes(`// SW Version ${canonicalVersion}`)) {
        errors.push(`${baseUrl}/sw.js does not contain // SW Version ${canonicalVersion}`);
      } else {
        console.log(`    [OK] sw.js = SW Version ${canonicalVersion}`);
      }

      // 3. Check index.html
      const indexRes = await fetchLiveUrl(`${baseUrl}/index.html?_nocache=${timestamp}`);
      if (indexRes.statusCode !== 200) {
        errors.push(`${baseUrl}/index.html HTTP ${indexRes.statusCode}`);
      } else if (!indexRes.data.includes(`const CURRENT_BUILD = ${canonicalVersion};`)) {
        errors.push(`${baseUrl}/index.html does not contain CURRENT_BUILD = ${canonicalVersion}`);
      } else {
        console.log(`    [OK] index.html CURRENT_BUILD = ${canonicalVersion}`);
      }

    } catch (err) {
      errors.push(`${baseUrl} network error: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Live Verification FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`[PASS] Live Verification PASSED 100% for both Cloudflare Pages projects!\n`);
}

verifyLive();
