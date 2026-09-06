// ============================================================
// APP SECURITY & AUTO-LOCK SUBSYSTEM
// Autonomous UMD Module (Phase 12A Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SecurityLockService = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

function changeAutoLockSetting(val) {
  if (val !== 'disabled') {
    const savedPin = localStorage.getItem('app_pin');
    const validPin = savedPin && savedPin.length === 4;
    if (!validPin) {
      const pinMsg = (typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auto_lock_requires_pin']) || (state.lang === 'el' ? 'Πρέπει πρώτα να ορίσετε ένα 4ψήφιο PIN!' : 'Please set a 4-digit PIN first!');
      showSyncToast('⚠️ ' + pinMsg, 3500);
      window._pendingAutoLockVal = val;
      openPinModal();
      return;
    }
    // PIN is valid: ensure app_lock_enabled is active
    localStorage.setItem('app_lock_enabled', 'true');
    const lockCheckbox = document.getElementById('settings-app-lock');
    if (lockCheckbox) lockCheckbox.checked = true;
  }

  localStorage.setItem('settings_auto_lock_delay', val);
  updateSettingsDisplay();
  // Restart the inactivity timer with the new delay (or stop if disabled).
  if (typeof _resetAutoLockTimer === 'function') {
    _resetAutoLockTimer();
  }

  const toastText = (val === 'disabled')
    ? ((typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auto_lock_toast_disabled']) || (state.lang === 'el' ? 'Το αυτόματο κλείδωμα απενεργοποιήθηκε' : 'Auto-lock disabled'))
    : ((typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auto_lock_toast_enabled']) || (state.lang === 'el' ? 'Το αυτόματο κλείδωμα ενεργοποιήθηκε' : 'Auto-lock activated'));
  showSyncToast((val === 'disabled' ? '🔓 ' : '⏱️ ') + toastText, 2500);
}

// ============================================================
// AUTO-LOCK (inactivity timer & lifecycle security)
// ============================================================
let _autoLockTimer = null;
let _lastUserActivity = Date.now();
window._lastUserActivity = _lastUserActivity;

function _getAutoLockDelayMs() {
  const val = localStorage.getItem('settings_auto_lock_delay') || 'disabled';
  switch (val) {
    case 'immediate':
    case '0': return 0;                // Immediate on exit / switch
    case '1': return 60 * 1000;        // 1 minute
    case '5': return 5 * 60 * 1000;    // 5 minutes
    case '10': return 10 * 60 * 1000;  // 10 minutes
    default: return -1;                // disabled
  }
}

function _recordUserActivity() {
  const now = Date.now();
  _lastUserActivity = now;
  window._lastUserActivity = now;
  try {
    localStorage.setItem('last_user_activity_timestamp', String(now));
  } catch (e) {}
}

function _resetAutoLockTimer() {
  _recordUserActivity();
  if (_autoLockTimer) { clearTimeout(_autoLockTimer); _autoLockTimer = null; }
  const delay = _getAutoLockDelayMs();
  if (delay < 0) return; // disabled
  
  // For foreground inactivity timer while app is actively on screen:
  // If set to immediate (0ms), use a 60s foreground idle safety threshold
  // so reading/viewing doesn't lock mid-glance, while app switch locks instantly.
  const foregroundDelay = (delay === 0) ? 60 * 1000 : delay;
  _autoLockTimer = setTimeout(() => {
    _autoLockTimer = null;
    _triggerAutoLock();
  }, foregroundDelay);
}

function _triggerAutoLock() {
  // Only lock while the app is in the foreground. If it is hidden, the
  // background/resume path handles the lock (see _handleAppResumed).
  if (document.visibilityState === 'hidden') return;
  const savedPin = localStorage.getItem('app_pin');
  if (!savedPin || savedPin.length !== 4) return;
  if (typeof showLockScreen === 'function') {
    showLockScreen();
  }
}

function _initAutoLock() {
  // Reset the inactivity timer on any user interaction.
  const events = ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown', 'mousemove', 'scroll', 'wheel'];
  const handler = () => _resetAutoLockTimer();
  events.forEach(ev => {
    document.addEventListener(ev, handler, { passive: true, capture: true });
  });
  _recordUserActivity();
  _resetAutoLockTimer();
}

// Expose for the background/resume path.
window._resetAutoLockTimer = _resetAutoLockTimer;
window._getAutoLockDelayMs = _getAutoLockDelayMs;
window._recordUserActivity = _recordUserActivity;
window._lastUserActivity = _lastUserActivity;

  // UMD Exports & Window Binding
  window.changeAutoLockSetting = changeAutoLockSetting;
  window._getAutoLockDelayMs = _getAutoLockDelayMs;
  window._recordUserActivity = _recordUserActivity;
  window._resetAutoLockTimer = _resetAutoLockTimer;
  window._triggerAutoLock = _triggerAutoLock;
  window._initAutoLock = _initAutoLock;

  return {
    changeAutoLockSetting: changeAutoLockSetting,
    _getAutoLockDelayMs: _getAutoLockDelayMs,
    _recordUserActivity: _recordUserActivity,
    _resetAutoLockTimer: _resetAutoLockTimer,
    _triggerAutoLock: _triggerAutoLock,
    _initAutoLock: _initAutoLock
  };
}));
