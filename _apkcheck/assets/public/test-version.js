// ============================================================
// OTA PROOF - test-version.js
// This is a TEST file served from the server to prove the OTA
// loading mechanism works in the Capacitor WebView.
// It sets a global marker that ota-proof.html checks.
// ============================================================
window.OTA_TEST = {
    version: 1008,
    loaded: true,
    source: 'remote-server',
    timestamp: Date.now(),
    message: 'OTA proof: loaded from remote server via Blob URL'
};
