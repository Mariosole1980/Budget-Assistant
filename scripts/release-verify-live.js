const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');
const canonicalVersion = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;

const projects = [
  'https://www.budgetassistant.org',
  'https://budget-assistant-pwa.pages.dev'
];

function fetchLiveUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Cache-Control': 'no-cache, no-store', 'User-Agent': 'ReleaseVerifier/1.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const origin = new URL(url).origin;
          redirectUrl = origin + redirectUrl;
        }
        return resolve(fetchLiveUrl(redirectUrl, maxRedirects - 1));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', err => reject(err));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function verifyLive() {
  console.log(`[RELEASE-VERIFY-LIVE] Verifying live deployments for v${canonicalVersion}...`);
  let errors = [];

  for (const baseUrl of projects) {
    console.log(`  Checking target: ${baseUrl}...`);
    let targetPassed = false;
    let attemptErrors = [];

    // Retry up to 6 attempts with 3s delay to allow Cloudflare Edge propagation
    for (let attempt = 1; attempt <= 6; attempt++) {
      attemptErrors = [];
      const timestamp = Date.now() + '_' + attempt;

      try {
        // 1. Check version.json
        const vRes = await fetchLiveUrl(`${baseUrl}/version.json?_nocache=${timestamp}`);
        if (vRes.statusCode !== 200) {
          attemptErrors.push(`${baseUrl}/version.json HTTP ${vRes.statusCode}`);
        } else {
          const liveV = JSON.parse(vRes.data).version;
          // Accept both the canonical numeric format (e.g. 1229) and the
          // Capgo OTA format (e.g. "1.0.1229") which the OTA step writes to
          // www/version.json after every release.
          const liveVStr = String(liveV);
          const canonicalStr = String(canonicalVersion);
          const isMatch = liveVStr === canonicalStr || liveVStr === `1.0.${canonicalStr}`;
          if (!isMatch) {
            attemptErrors.push(`${baseUrl}/version.json live version is ${liveV}, expected ${canonicalVersion}`);
          }
        }

        // 2. Check sw.js
        const swRes = await fetchLiveUrl(`${baseUrl}/sw.js?_nocache=${timestamp}`);
        if (swRes.statusCode !== 200) {
          attemptErrors.push(`${baseUrl}/sw.js HTTP ${swRes.statusCode}`);
        } else if (!swRes.data.includes(`// SW Version ${canonicalVersion}`)) {
          attemptErrors.push(`${baseUrl}/sw.js does not contain // SW Version ${canonicalVersion}`);
        }

        // 3. Check /app (or /index.html) for web app build version
        const appRes = await fetchLiveUrl(`${baseUrl}/app?_nocache=${timestamp}`);
        if (appRes.statusCode !== 200) {
          // Fallback check on /index.html
          const indexRes = await fetchLiveUrl(`${baseUrl}/index.html?_nocache=${timestamp}`);
          if (indexRes.statusCode !== 200 || !indexRes.data.includes(`const CURRENT_BUILD = ${canonicalVersion};`)) {
            attemptErrors.push(`${baseUrl}/app HTTP ${appRes.statusCode}, /index.html check failed for build ${canonicalVersion}`);
          }
        } else if (!appRes.data.includes(`const CURRENT_BUILD = ${canonicalVersion};`)) {
          attemptErrors.push(`${baseUrl}/app does not contain CURRENT_BUILD = ${canonicalVersion}`);
        }

        // 4. Check root / (landing.html) for live landing page
        const rootRes = await fetchLiveUrl(`${baseUrl}/?_nocache=${timestamp}`);
        if (rootRes.statusCode !== 200) {
          attemptErrors.push(`${baseUrl}/ HTTP ${rootRes.statusCode}`);
        } else if (!rootRes.data.includes(`Budget Assistant`)) {
          attemptErrors.push(`${baseUrl}/ does not contain Budget Assistant branding`);
        }

        if (attemptErrors.length === 0) {
          targetPassed = true;
          console.log(`    [OK] ${baseUrl} 100% verified live for v${canonicalVersion}`);
          break;
        }
      } catch (err) {
        attemptErrors.push(`${baseUrl} network error: ${err.message}`);
      }

      if (attempt < 6) {
        console.log(`    [RETRY] Edge propagation pending, retrying in 3s (attempt ${attempt}/6)...`);
        await sleep(3000);
      }
    }

    if (!targetPassed) {
      errors.push(...attemptErrors);
    }
  }

  if (errors.length > 0) {
    console.error('[FAIL] Live Verification FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`[PASS] Live Verification PASSED 100% for the canonical Cloudflare Pages project!\n`);
}

verifyLive();
