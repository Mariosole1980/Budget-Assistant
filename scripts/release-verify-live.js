const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'version.json');
const canonicalVersion = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).version;

const projects = [
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

    // Retry up to 4 attempts with 2.5s delay to allow Cloudflare Edge propagation
    for (let attempt = 1; attempt <= 4; attempt++) {
      attemptErrors = [];
      const timestamp = Date.now() + '_' + attempt;

      try {
        // 1. Check version.json
        const vRes = await fetchLiveUrl(`${baseUrl}/version.json?_nocache=${timestamp}`);
        if (vRes.statusCode !== 200) {
          attemptErrors.push(`${baseUrl}/version.json HTTP ${vRes.statusCode}`);
        } else {
          const liveV = JSON.parse(vRes.data).version;
          if (liveV !== canonicalVersion) {
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

        // 3. Check root / (index.html)
        const indexRes = await fetchLiveUrl(`${baseUrl}/?_nocache=${timestamp}`);
        if (indexRes.statusCode !== 200) {
          attemptErrors.push(`${baseUrl}/ HTTP ${indexRes.statusCode}`);
        } else if (!indexRes.data.includes(`const CURRENT_BUILD = ${canonicalVersion};`)) {
          attemptErrors.push(`${baseUrl}/ does not contain CURRENT_BUILD = ${canonicalVersion}`);
        }

        if (attemptErrors.length === 0) {
          targetPassed = true;
          console.log(`    [OK] ${baseUrl} 100% verified live for v${canonicalVersion}`);
          break;
        }
      } catch (err) {
        attemptErrors.push(`${baseUrl} network error: ${err.message}`);
      }

      if (attempt < 4) {
        console.log(`    [RETRY] Edge propagation pending, retrying in 2.5s (attempt ${attempt}/4)...`);
        await sleep(2500);
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
