// ============================================================
// SECURITY PIN & APP LOCK SERVICE
// Autonomous UMD Module (Phase 16B Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.SecurityPinService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// Security App Lock Logic
let enteredPin = [];
let pinSetupStep = 0; // 1 = enter pin, 2 = confirm pin
let tempSetupPin = "";

function showLockScreen() {
  const savedPin = localStorage.getItem('app_pin');
  const validPin = savedPin && savedPin.length === 4;
  const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
  const biometricsEnabled = localStorage.getItem('app_biometrics_enabled') === 'true';
  const autoLockDelay = localStorage.getItem('settings_auto_lock_delay') || 'disabled';

  if (!validPin || (!appLockEnabled && !biometricsEnabled && autoLockDelay === 'disabled')) {
    hideLockScreen();
    return;
  }

  // Never show lock screen OVER the active auth modal/overlay
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay && (authOverlay.classList.contains('active') || authOverlay.style.display === 'flex')) {
    hideLockScreen();
    return;
  }

  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    ensureOverlayInBody(lockScreen);
    const isAlreadyActive = lockScreen.classList.contains('active');
    lockScreen.classList.add('active');
    if (!isAlreadyActive) {
      enteredPin = [];
      resetLockDots();
    }

    // Show/hide biometric button based on settings
    const biometricBtn = document.getElementById('btn-biometric');
    const isBioActive = localStorage.getItem('app_biometrics_enabled') === 'true';
    if (biometricBtn) {
      biometricBtn.style.display = isBioActive ? 'flex' : 'none';
    }

    // Auto-trigger biometric auth if enabled
    if (isBioActive && !isAlreadyActive) {
      setTimeout(() => {
        triggerBiometricAuth();
      }, 300);
    }
  }
}

function hideLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    lockScreen.classList.remove('active');
  }
  enteredPin = [];
  resetLockDots();
  if (typeof _resetAutoLockTimer === 'function') {
    _resetAutoLockTimer();
  }
}

function resetLockDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.classList.remove('active');
  }
}

function pressKey(num) {
  if (enteredPin.length < 4) {
    enteredPin.push(num);
    const dot = document.getElementById(`dot-${enteredPin.length - 1}`);
    if (dot) dot.classList.add('active');

    if (enteredPin.length === 4) {
      setTimeout(() => {
        verifyEnteredPin();
      }, 100);
    }
  }
}

function pressBackspace() {
  if (enteredPin.length > 0) {
    const dot = document.getElementById(`dot-${enteredPin.length - 1}`);
    if (dot) dot.classList.remove('active');
    enteredPin.pop();
  }
}

function verifyEnteredPin() {
  const pin = enteredPin.join('');
  const savedPin = localStorage.getItem('app_pin');

  if (pin === savedPin) {
    hideLockScreen();
  } else {
    const subtitle = document.getElementById('lock-subtitle');
    const oldText = subtitle.textContent;
    subtitle.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['pin_wrong']) || "Λάθος PIN! Προσπαθήστε ξανά.";
    subtitle.style.color = "var(--accent)";

    const dotsContainer = document.querySelector('.lock-dots');
    dotsContainer.style.transform = 'translateX(10px)';
    setTimeout(() => { dotsContainer.style.transform = 'translateX(-10px)'; }, 70);
    setTimeout(() => { dotsContainer.style.transform = 'translateX(10px)'; }, 140);
    setTimeout(() => { dotsContainer.style.transform = 'translateX(0)'; }, 210);

    setTimeout(() => {
      enteredPin = [];
      resetLockDots();
      subtitle.textContent = oldText;
      subtitle.style.color = "";
    }, 1000);
  }
}

// Biometrics (AndroidX Native Biometrics Prompt, Capgo NativeBiometric & WebAuthn Fallback)
async function checkBiometricsSupport() {
  const container = document.getElementById('settings-biometrics-container');
  const toggle = document.getElementById('settings-biometrics');
  if (!container || !toggle) return;

  // Always display biometrics row in Security & Privacy subscreen
  container.style.display = 'flex';

  const enabled = localStorage.getItem('app_biometrics_enabled') === 'true';
  toggle.checked = enabled;

  const platformInfo = document.getElementById('biometrics-platform-info');
  if (platformInfo) {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      platformInfo.textContent = state.lang === 'el' ? 'Δακτυλικό αποτύπωμα / Face ID (Android)' : 'Fingerprint / Face ID (Android)';
    } else {
      platformInfo.textContent = state.lang === 'el' ? 'Δακτυλικό αποτύπωμα / Face ID / WebAuthn' : 'Fingerprint / Face ID / WebAuthn';
    }
  }
}

async function authenticateBiometricsNativeOrWeb() {
  // 1. Try Custom SecurityPlugin (Direct AndroidX BiometricPrompt)
  try {
    const secPlugin = getSecurityPlugin();
    if (secPlugin && typeof secPlugin.authenticateBiometrics === 'function') {
      const res = await secPlugin.authenticateBiometrics({
        title: state.lang === 'el' ? 'Βιομετρικό Ξεκλείδωμα' : 'Biometric Unlock',
        subtitle: state.lang === 'el' ? 'Χρησιμοποιήστε το δακτυλικό αποτύπωμα ή Face ID' : 'Use fingerprint or Face ID',
        cancelButtonText: state.lang === 'el' ? 'Ακύρωση' : 'Cancel'
      });
      if (res && res.success) {
        return true;
      }
      if (res && res.error) {
        return res.error;
      }
    }
  } catch (e) {
    console.warn('[SecurityPlugin] authenticate error:', e);
  }

  // 2. Try Capgo NativeBiometric Plugin
  try {
    const nativeBio = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric;
    if (nativeBio && typeof nativeBio.verifyIdentity === 'function') {
      await nativeBio.verifyIdentity({
        reason: state.lang === 'el' ? 'Ξεκλείδωμα Budget Assistant' : 'Unlock Budget Assistant',
        title: state.lang === 'el' ? 'Βιομετρικό Ξεκλείδωμα' : 'Biometric Unlock',
        subtitle: state.lang === 'el' ? 'Επιβεβαιώστε την ταυτότητά σας' : 'Confirm your identity',
        description: state.lang === 'el' ? 'Σαρώστε το δακτυλικό αποτύπωμα ή Face ID' : 'Scan fingerprint or Face ID'
      });
      return true;
    }
  } catch (e) {
    console.warn('[NativeBiometric] verifyIdentity error:', e);
    return (e && (e.message || e.name)) || String(e);
  }

  // 3. Fallback for Web/Desktop Browser (WebAuthn Platform Authenticator)
  if (window.PublicKeyCredential && typeof navigator.credentials !== 'undefined' && window.isSecureContext) {
    try {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isAvailable) {
        return state.lang === 'el' ? 'Μη διαθέσιμα βιομετρικά' : 'Biometrics not available';
      }
      return await verifyWebAuthnBiometrics();
    } catch (e) {
      return (e && (e.message || e.name)) || String(e);
    }
  }

  return state.lang === 'el' ? 'Μη υποστηριζόμενη συσκευή' : 'Unsupported device';
}

async function verifyWebAuthnBiometrics() {
  try {
    let credIdBase64 = localStorage.getItem('biometric_cred_id');
    if (!credIdBase64) {
      const randomChallenge = new Uint8Array(16);
      window.crypto.getRandomValues(randomChallenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credentialOptions = {
        publicKey: {
          challenge: randomChallenge,
          rp: { name: "Budget Assistant", id: window.location.hostname },
          user: { id: userId, name: "user@moneymanager.local", displayName: "Local User" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { userVerification: "preferred", authenticatorAttachment: "platform" },
          timeout: 60000
        }
      };
      const credential = await navigator.credentials.create(credentialOptions);
      if (credential) {
        credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem('biometric_cred_id', credIdBase64);
        return true;
      }
      return false;
    }

    const rawId = new Uint8Array(atob(credIdBase64).split("").map(c => c.charCodeAt(0)));
    const randomChallenge = new Uint8Array(16);
    window.crypto.getRandomValues(randomChallenge);

    const assertionOptions = {
      publicKey: {
        challenge: randomChallenge,
        allowCredentials: [{ id: rawId, type: "public-key" }],
        userVerification: "preferred",
        timeout: 60000
      }
    };
    const assertion = await navigator.credentials.get(assertionOptions);
    return !!assertion;
  } catch (err) {
    console.error("WebAuthn verification failed:", err);
    return false;
  }
}

async function triggerBiometricAuth() {
  if (localStorage.getItem('app_biometrics_enabled') !== 'true') return;
  const verified = await authenticateBiometricsNativeOrWeb();
  if (verified === true) {
    hideLockScreen();
  }
}

// PIN Setup Modal Methods
function openPinModal() {
  const modal = document.getElementById('pin-modal');
  if (modal) {
    modal.classList.add('active');
    document.getElementById('pin-modal-title').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_pin_title']) || "Ορισμός PIN";
    document.getElementById('pin-modal-desc').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_pin_desc']) || "Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.";
    const pinField = document.getElementById('pin-input-field');
    if (pinField) {
      pinField.value = "";
      setTimeout(() => pinField.focus(), 100);
    }
    pinSetupStep = 1;
    tempSetupPin = "";
  }
}

function closePinModal() {
  const modal = document.getElementById('pin-modal');
  if (modal) modal.classList.remove('active');

  const savedPin = localStorage.getItem('app_pin');
  const validPin = savedPin && savedPin.length === 4;
  if (!validPin) {
    localStorage.removeItem('app_lock_enabled');
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = false;
  }
}

function submitPinSetup() {
  const pinField = document.getElementById('pin-input-field');
  const pin = pinField ? pinField.value : '';

  if (pin.length !== 4 || isNaN(pin)) {
    showSyncToast("❌ " + (state.lang === 'el' ? "Το PIN πρέπει να είναι ακριβώς 4 ψηφία!" : "PIN must be exactly 4 digits!"), 3000);
    return;
  }

  if (pinSetupStep === 1) {
    tempSetupPin = pin;
    pinField.value = "";
    document.getElementById('pin-modal-title').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['pin_confirm_title']) || "Επιβεβαίωση PIN";
    document.getElementById('pin-modal-desc').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['pin_confirm_desc']) || "Πληκτρολογήστε ξανά το PIN για επιβεβαίωση.";
    pinSetupStep = 2;
    setTimeout(() => pinField.focus(), 100);
  } else if (pinSetupStep === 2) {
    if (pin === tempSetupPin) {
      localStorage.setItem('app_pin', pin);
      localStorage.setItem('app_lock_enabled', 'true');
      const lockCheckbox = document.getElementById('settings-app-lock');
      if (lockCheckbox) lockCheckbox.checked = true;
      closePinModal();
      if (window._pendingAutoLockVal) {
        localStorage.setItem('settings_auto_lock_delay', window._pendingAutoLockVal);
        window._pendingAutoLockVal = null;
      }
      showSyncToast("✅ " + (state.lang === 'el' ? "Το κλείδωμα ενεργοποιήθηκε επιτυχώς!" : "App lock activated successfully!"), 3000);
      checkBiometricsSupport();
      updateSettingsDisplay();
      if (typeof _resetAutoLockTimer === 'function') {
        _resetAutoLockTimer();
      }
    } else {
      showSyncToast("❌ " + (state.lang === 'el' ? "Τα PIN δεν ταιριάζουν! Προσπαθήστε ξανά." : "PINs do not match! Try again."), 3000);
      pinSetupStep = 1;
      tempSetupPin = "";
      pinField.value = "";
      document.getElementById('pin-modal-title').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_pin_title']) || "Ορισμός PIN";
      document.getElementById('pin-modal-desc').textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['modal_pin_desc']) || "Εισάγετε ένα 4ψήφιο PIN για το κλείδωμα της εφαρμογής.";
      setTimeout(() => pinField.focus(), 100);
    }
  }
}

function openPinVerifyModal() {
  const modal = document.getElementById('pin-verify-modal');
  if (modal) {
    modal.classList.add('active');
    const input = document.getElementById('pin-verify-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
  }
}

function closePinVerifyModal() {
  const modal = document.getElementById('pin-verify-modal');
  if (modal) modal.classList.remove('active');

  const savedPin = localStorage.getItem('app_pin');
  const validPin = savedPin && savedPin.length === 4;
  const lockEnabled = localStorage.getItem('app_lock_enabled') === 'true';

  const lockCheckbox = document.getElementById('settings-app-lock');
  if (lockCheckbox) {
    lockCheckbox.checked = !!(validPin && lockEnabled);
  }
}

let suppressLockToggle = false;

function submitPinVerification() {
  const input = document.getElementById('pin-verify-input');
  const entered = input ? input.value : '';
  const currentPin = localStorage.getItem('app_pin');

  if (!currentPin || currentPin.length !== 4) {
    localStorage.removeItem('app_lock_enabled');
    localStorage.removeItem('app_pin');
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    localStorage.setItem('settings_auto_lock_delay', 'disabled');

    suppressLockToggle = true;
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = false;
    const bioCheckbox = document.getElementById('settings-biometrics');
    if (bioCheckbox) bioCheckbox.checked = false;
    suppressLockToggle = false;

    updateSettingsDisplay();
    closePinVerifyModal();
    showSyncToast("🔓 " + (state.lang === 'el' ? "Το κλείδωμα απενεργοποιήθηκε." : "App lock disabled."), 3000);
    return;
  }

  if (entered === currentPin) {
    localStorage.removeItem('app_lock_enabled');
    localStorage.removeItem('app_pin');
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    localStorage.setItem('settings_auto_lock_delay', 'disabled');

    // Keep biometric settings container VISIBLE, just unchecked
    const bioContainer = document.getElementById('settings-biometrics-container');
    if (bioContainer) bioContainer.style.display = 'flex';

    const bioCheckbox = document.getElementById('settings-biometrics');
    if (bioCheckbox) bioCheckbox.checked = false;

    // Uncheck app lock checkbox
    suppressLockToggle = true;
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = false;
    suppressLockToggle = false;

    updateSettingsDisplay();
    closePinVerifyModal();
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.classList.remove('active');
    showSyncToast("🔓 " + (state.lang === 'el' ? "Το κλείδωμα απενεργοποιήθηκε." : "App lock disabled."), 3000);
  } else {
    showSyncToast("❌ " + (state.lang === 'el' ? "Λάθος PIN!" : "Incorrect PIN!"), 3000);
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function toggleAppLock(checked) {
  if (suppressLockToggle) return;
  const savedPin = localStorage.getItem('app_pin');
  const validPin = savedPin && savedPin.length === 4;
  const lockEnabled = localStorage.getItem('app_lock_enabled') === 'true';

  if (checked) {
    openPinModal();
  } else {
    if (!validPin || !lockEnabled) {
      localStorage.removeItem('app_lock_enabled');
      localStorage.removeItem('app_pin');
      localStorage.removeItem('app_biometrics_enabled');
      localStorage.removeItem('biometric_cred_id');
      const lockCheckbox = document.getElementById('settings-app-lock');
      if (lockCheckbox) lockCheckbox.checked = false;
      const bioCheckbox = document.getElementById('settings-biometrics');
      if (bioCheckbox) bioCheckbox.checked = false;
      showSyncToast("🔓 " + (state.lang === 'el' ? "Το κλείδωμα απενεργοποιήθηκε." : "App lock disabled."), 3000);
      return;
    }
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = true;
    openPinVerifyModal();
  }
}

function openBiometricsPinModal() {
  const modal = document.getElementById('biometrics-pin-modal');
  if (modal) modal.classList.add('active');
}

function closeBiometricsPinModal() {
  const modal = document.getElementById('biometrics-pin-modal');
  if (modal) modal.classList.remove('active');
}

function proceedToPinSetup() {
  closeBiometricsPinModal();
  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) {
    appLockCheckbox.checked = true;
  }
  openPinModal();
}

function getSecurityPlugin() {
  if (!window.Capacitor) return null;
  if (window.Capacitor.Plugins && window.Capacitor.Plugins.Security) {
    return window.Capacitor.Plugins.Security;
  }
  if (typeof window.Capacitor.registerPlugin === 'function') {
    try {
      return window.Capacitor.registerPlugin('Security');
    } catch (e) {
      console.warn('[SecurityPlugin] Failed to register plugin:', e);
    }
  }
  return null;
}
window.getSecurityPlugin = getSecurityPlugin;

function getPrivacyScreenPlugin() {
  if (!window.Capacitor) return null;
  if (window.Capacitor.Plugins && window.Capacitor.Plugins.PrivacyScreen) {
    return window.Capacitor.Plugins.PrivacyScreen;
  }
  if (typeof window.Capacitor.registerPlugin === 'function') {
    try {
      return window.Capacitor.registerPlugin('PrivacyScreen');
    } catch (e) {
      console.warn('[PrivacyScreen] Failed to register plugin:', e);
    }
  }
  return null;
}
window.getPrivacyScreenPlugin = getPrivacyScreenPlugin;

function applyNativeSecureMode(enabled) {
  try {
    // 1. Apply via custom SecurityPlugin
    const secPlugin = getSecurityPlugin();
    if (secPlugin && typeof secPlugin.setSecureMode === 'function') {
      secPlugin.setSecureMode({ enabled: enabled }).catch(e => console.warn('[SecurityPlugin] setSecureMode error:', e));
    }

    // 2. Apply via official PrivacyScreen plugin
    const privPlugin = getPrivacyScreenPlugin();
    if (privPlugin) {
      if (enabled && typeof privPlugin.enable === 'function') {
        privPlugin.enable().catch(e => console.warn('[PrivacyScreen] enable error:', e));
      } else if (!enabled && typeof privPlugin.disable === 'function') {
        privPlugin.disable().catch(e => console.warn('[PrivacyScreen] disable error:', e));
      }
    }
  } catch (err) {
    console.error('[NativeSecureMode] Failed to apply secure mode:', err);
  }
}
window.applyNativeSecureMode = applyNativeSecureMode;

function toggleHideAmountsSetting(checked) {
  try {
    localStorage.setItem('settings_hide_amounts', checked ? 'true' : 'false');
    const msg = checked
      ? (state.lang === 'el' ? 'Η απόκρυψη ποσών ενεργοποιήθηκε.' : 'Amounts privacy enabled.')
      : (state.lang === 'el' ? 'Η απόκρυψη ποσών απενεργοποιήθηκε.' : 'Amounts privacy disabled.');
    showSyncToast((checked ? "👁️ " : "👁️‍🗨️ ") + msg, 3000);

    if (typeof updateUI === 'function') {
      updateUI();
    } else if (typeof renderCurrentScreen === 'function') {
      renderCurrentScreen();
    }
  } catch (err) {
    console.error('[HideAmounts] Error in toggleHideAmountsSetting:', err);
  }
}
window.toggleHideAmountsSetting = toggleHideAmountsSetting;

function toggleScreenshotBlockSetting(checked) {
  try {
    const isAndroid = typeof Capacitor !== 'undefined' && Capacitor.getPlatform && Capacitor.getPlatform() === 'android';
    if (!isAndroid) {
      const row = document.getElementById('settings-screenshot-block-row');
      if (row) row.style.display = 'none';
      return;
    }

    localStorage.setItem('settings_screenshot_block', checked ? 'true' : 'false');
    applyNativeSecureMode(checked);

    const msg = checked
      ? (state.lang === 'el' ? 'Ο αποκλεισμός στιγμιότυπων ενεργοποιήθηκε.' : 'Screenshot blocking enabled.')
      : (state.lang === 'el' ? 'Ο αποκλεισμός στιγμιότυπων απενεργοποιήθηκε.' : 'Screenshot blocking disabled.');
    showSyncToast((checked ? "🔒 " : "🔓 ") + msg, 3000);
  } catch (err) {
    console.error("[ScreenshotBlock] Error in toggleScreenshotBlockSetting:", err);
  }
}
window.toggleScreenshotBlockSetting = toggleScreenshotBlockSetting;

async function toggleBiometrics(checked) {
  const bioCheckbox = document.getElementById('settings-biometrics');
  if (checked) {
    const savedPin = localStorage.getItem('app_pin');
    const validPin = savedPin && savedPin.length === 4;
    const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';

    if (!validPin || !appLockEnabled) {
      if (bioCheckbox) bioCheckbox.checked = false;
      showSyncToast("⚠️ " + (state.lang === 'el' ? "Πρέπει πρώτα να ενεργοποιήσετε το Κλείδωμα PIN!" : "Please enable PIN lock first!"), 3500);
      openPinModal();
      return;
    }
    const result = await authenticateBiometricsNativeOrWeb();
    if (result === true) {
      localStorage.setItem('app_biometrics_enabled', 'true');
      if (bioCheckbox) bioCheckbox.checked = true;
      const msg = state.lang === 'el' ? 'Το Face ID / Αποτύπωμα ενεργοποιήθηκε επιτυχώς!' : 'Face ID / Fingerprint activated successfully!';
      showSyncToast("✅ " + msg, 3000);
    } else {
      localStorage.removeItem('app_biometrics_enabled');
      if (bioCheckbox) bioCheckbox.checked = false;
      const errorStr = String(result || '');
      const msg = state.lang === 'el' ? 'Αποτυχία σύνδεσης βιομετρικών: ' : 'Biometrics failed: ';
      showSyncToast("❌ " + msg + errorStr, 4000);
    }
  } else {
    localStorage.removeItem('app_biometrics_enabled');
    localStorage.removeItem('biometric_cred_id');
    if (bioCheckbox) bioCheckbox.checked = false;
    const msg = state.lang === 'el' ? 'Τα βιομετρικά απενεργοποιήθηκαν.' : 'Biometrics deactivated.';
    showSyncToast("🔓 " + msg, 3000);
  }
}

  // Window Bindings
  window.showLockScreen = showLockScreen;
  window.hideLockScreen = hideLockScreen;
  window.resetLockDots = resetLockDots;
  window.pressKey = pressKey;
  window.pressBackspace = pressBackspace;
  window.verifyEnteredPin = verifyEnteredPin;
  window.checkBiometricsSupport = checkBiometricsSupport;
  window.authenticateBiometricsNativeOrWeb = authenticateBiometricsNativeOrWeb;
  window.verifyWebAuthnBiometrics = verifyWebAuthnBiometrics;
  window.triggerBiometricAuth = triggerBiometricAuth;
  window.openPinModal = openPinModal;
  window.closePinModal = closePinModal;
  window.submitPinSetup = submitPinSetup;
  window.openPinVerifyModal = openPinVerifyModal;
  window.closePinVerifyModal = closePinVerifyModal;
  window.submitPinVerification = submitPinVerification;
  window.toggleAppLock = toggleAppLock;
  window.openBiometricsPinModal = openBiometricsPinModal;
  window.closeBiometricsPinModal = closeBiometricsPinModal;
  window.proceedToPinSetup = proceedToPinSetup;
  window.getSecurityPlugin = getSecurityPlugin;
  window.getPrivacyScreenPlugin = getPrivacyScreenPlugin;
  window.applyNativeSecureMode = applyNativeSecureMode;
  window.toggleHideAmountsSetting = toggleHideAmountsSetting;
  window.toggleScreenshotBlockSetting = toggleScreenshotBlockSetting;
  window.toggleBiometrics = toggleBiometrics;

  return {
    showLockScreen: showLockScreen,
    hideLockScreen: hideLockScreen,
    resetLockDots: resetLockDots,
    pressKey: pressKey,
    pressBackspace: pressBackspace,
    verifyEnteredPin: verifyEnteredPin,
    checkBiometricsSupport: checkBiometricsSupport,
    authenticateBiometricsNativeOrWeb: authenticateBiometricsNativeOrWeb,
    verifyWebAuthnBiometrics: verifyWebAuthnBiometrics,
    triggerBiometricAuth: triggerBiometricAuth,
    openPinModal: openPinModal,
    closePinModal: closePinModal,
    submitPinSetup: submitPinSetup,
    openPinVerifyModal: openPinVerifyModal,
    closePinVerifyModal: closePinVerifyModal,
    submitPinVerification: submitPinVerification,
    toggleAppLock: toggleAppLock,
    openBiometricsPinModal: openBiometricsPinModal,
    closeBiometricsPinModal: closeBiometricsPinModal,
    proceedToPinSetup: proceedToPinSetup,
    getSecurityPlugin: getSecurityPlugin,
    getPrivacyScreenPlugin: getPrivacyScreenPlugin,
    applyNativeSecureMode: applyNativeSecureMode,
    toggleHideAmountsSetting: toggleHideAmountsSetting,
    toggleScreenshotBlockSetting: toggleScreenshotBlockSetting,
    toggleBiometrics: toggleBiometrics
  };
}));
