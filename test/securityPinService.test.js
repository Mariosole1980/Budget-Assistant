const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el'
};

global.TRANSLATIONS = {
  el: {
    pin_wrong: 'Λάθος PIN. Δοκιμάστε ξανά.',
    pin_enter_current: 'Εισάγετε το τρέχον PIN'
  }
};

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classes.add(c);
            else classes.delete(c);
            return force;
          }
          if (classes.has(c)) { classes.delete(c); return false; }
          else { classes.add(c); return true; }
        }
      },
      textContent: '',
      value: '',
      checked: false,
      focus() {},
      appendChild() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return getMockElement(sel.slice(1));
    if (sel.startsWith('.')) return getMockElement(sel.slice(1));
    return null;
  },
  querySelectorAll() {
    return [];
  },
  body: {
    appendChild() {}
  }
};

global.ensureOverlayInBody = () => {};
global.showSyncToast = () => {};
global.updateSettingsDisplay = () => {};
global.updateUI = () => {};

global.Capacitor = {
  getPlatform: () => 'android',
  Plugins: {}
};

const SecurityPinService = require('../js/securityPinService.js');

test('SecurityPinService: exports all expected functions', () => {
  const expectedFns = [
    'showLockScreen', 'hideLockScreen', 'resetLockDots', 'pressKey', 'pressBackspace',
    'verifyEnteredPin', 'checkBiometricsSupport', 'authenticateBiometricsNativeOrWeb',
    'verifyWebAuthnBiometrics', 'triggerBiometricAuth', 'openPinModal', 'closePinModal',
    'submitPinSetup', 'openPinVerifyModal', 'closePinVerifyModal', 'submitPinVerification',
    'toggleAppLock', 'openBiometricsPinModal', 'closeBiometricsPinModal', 'proceedToPinSetup',
    'getSecurityPlugin', 'getPrivacyScreenPlugin', 'applyNativeSecureMode',
    'toggleHideAmountsSetting', 'toggleScreenshotBlockSetting', 'toggleBiometrics'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof SecurityPinService[fn], 'function', `${fn} must be a function`);
  });
});

test('SecurityPinService: showLockScreen and hideLockScreen toggle lock screen properly', () => {
  const lockScreen = getMockElement('lock-screen');
  
  // Without PIN, showLockScreen should hide lock screen
  localStorage.removeItem('app_pin');
  SecurityPinService.showLockScreen();
  assert.strictEqual(lockScreen.classList.contains('active'), false);

  // Set PIN and enable app lock
  localStorage.setItem('app_pin', '1234');
  localStorage.setItem('app_lock_enabled', 'true');
  SecurityPinService.showLockScreen();
  assert.strictEqual(lockScreen.classList.contains('active'), true);

  // Calling hideLockScreen
  SecurityPinService.hideLockScreen();
  assert.strictEqual(lockScreen.classList.contains('active'), false);
});

test('SecurityPinService: pressKey, pressBackspace, and resetLockDots manipulate PIN dots', () => {
  const dot0 = getMockElement('dot-0');
  const dot1 = getMockElement('dot-1');

  SecurityPinService.resetLockDots();
  assert.strictEqual(dot0.classList.contains('active'), false);

  SecurityPinService.pressKey('5');
  assert.strictEqual(dot0.classList.contains('active'), true);

  SecurityPinService.pressKey('7');
  assert.strictEqual(dot1.classList.contains('active'), true);

  SecurityPinService.pressBackspace();
  assert.strictEqual(dot1.classList.contains('active'), false);

  SecurityPinService.resetLockDots();
  assert.strictEqual(dot0.classList.contains('active'), false);
});

test('SecurityPinService: toggleHideAmountsSetting toggles local storage', () => {
  SecurityPinService.toggleHideAmountsSetting(true);
  assert.strictEqual(localStorage.getItem('settings_hide_amounts'), 'true');

  SecurityPinService.toggleHideAmountsSetting(false);
  assert.strictEqual(localStorage.getItem('settings_hide_amounts'), 'false');
});

test('SecurityPinService: toggleScreenshotBlockSetting toggles local storage', () => {
  SecurityPinService.toggleScreenshotBlockSetting(true);
  assert.strictEqual(localStorage.getItem('settings_screenshot_block'), 'true');

  SecurityPinService.toggleScreenshotBlockSetting(false);
  assert.strictEqual(localStorage.getItem('settings_screenshot_block'), 'false');
});
