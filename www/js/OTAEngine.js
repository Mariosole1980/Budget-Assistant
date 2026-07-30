window.OTAEngine = (function() {
  const SERVER_VERSION_URL = 'https://budget-assistant-pwa.pages.dev/version.json';

  function getCurrentBuildNumber() {
    const stagedBuild = localStorage.getItem('ota_staged_build');
    if (stagedBuild) {
      const parsed = parseInt(stagedBuild, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (typeof CURRENT_BUILD !== 'undefined') {
      const parsed = parseInt(CURRENT_BUILD, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 1;
  }

  async function checkBackgroundOTAUpdate() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const currentBuild = getCurrentBuildNumber();
      const manifestRes = await fetch(`${SERVER_VERSION_URL}?_t=${Date.now()}`, { cache: 'no-store' });
      if (!manifestRes.ok) return;

      const remoteManifest = await manifestRes.json();
      const remoteBuild = parseInt(remoteManifest.version || remoteManifest.build, 10);

      if (isNaN(remoteBuild) || remoteBuild <= currentBuild) return;

      console.log(`[OTAEngine] Background OTA staging new build v${remoteBuild}...`);
      const appRes = await fetch(`https://budget-assistant-pwa.pages.dev/app.js?v=${remoteBuild}&_t=${Date.now()}`, { cache: 'no-store' });
      if (appRes.ok) {
        const appCode = await appRes.text();
        if (appCode && appCode.length > 1000) {
          localStorage.setItem('ota_staged_app_js', appCode);
          localStorage.setItem('ota_staged_build', String(remoteBuild));
          console.log(`[OTAEngine] Successfully staged v${remoteBuild}! Will load on next app start.`);
          // Immediately update version display element (no restart needed for the badge)
          const buildEl = document.getElementById('about-build-val');
          if (buildEl) buildEl.textContent = `v${remoteBuild}`;
        }
      }
    } catch (e) {
      console.warn('[OTAEngine] Background OTA staging error:', e);
    }
  }

  function initOTACheck() {
    // Run 4 seconds after boot so startup is 100% instant with zero flickering
    setTimeout(() => {
      checkBackgroundOTAUpdate();
    }, 4000);
  }

  return {
    initOTACheck,
    checkBackgroundOTAUpdate,
    getCurrentBuildNumber
  };
})();

// Auto-run on boot
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  window.OTAEngine.initOTACheck();
} else {
  document.addEventListener('DOMContentLoaded', () => window.OTAEngine.initOTACheck());
}
