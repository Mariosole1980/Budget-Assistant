/**
 * SECURITY LOCK MODULE (PIN / Face ID)
 * Cold Start Detection & Background Mode Handling
 * v140+
 */

const SECURITY_CONFIG = {
  PIN_LENGTH: 4,
  LOCK_ENABLED_KEY: 'app_lock_enabled',
  PIN_HASH_KEY: 'app_pin_hash',
  BIOMETRIC_ENABLED_KEY: 'app_biometric_enabled',
  LAST_LOCK_TIME_KEY: 'app_last_lock_time',
  SESSION_ACTIVE_KEY: 'app_session_active',
  BACKGROUND_TIMEOUT_MS: 5000 // 5 sec before lock on background
};

let lockScreenShown = false;
let sessionActive = false;
let lastActivityTime = Date.now();
let backgroundTimeout = null;

/**
 * INITIALIZATION: Check if lock screen should show on app start
 * Called once on DOMContentLoaded
 */
function initializeSecurityLock() {
  const lockEnabled = localStorage.getItem(SECURITY_CONFIG.LOCK_ENABLED_KEY) === 'true';
  
  if (!lockEnabled) {
    console.log('🔓 App lock disabled');
    sessionActive = true;
    hideAppLockScreen();
    return;
  }

  // Check if this is a Cold Start (app was completely closed)
  const wasSessionActive = sessionStorage.getItem(SECURITY_CONFIG.SESSION_ACTIVE_KEY) === 'true';
  
  if (!wasSessionActive) {
    // ✅ COLD START: Show lock screen
    console.log('🔒 COLD START detected - showing lock screen');
    lockScreenShown = true;
    sessionActive = false;
    showAppLockScreen();
  } else {
    // ✅ APP RESUMED from background: NO lock screen
    console.log('✅ App resumed from background - unlocked');
    sessionActive = true;
    sessionStorage.setItem(SECURITY_CONFIG.SESSION_ACTIVE_KEY, 'true');
    hideAppLockScreen();
  }

  setupActivityListeners();
}

/**
 * Show the lock screen overlay
 */
function showAppLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    lockScreen.style.display = 'flex';
    lockScreen.style.zIndex = '10001';
  }
}

/**
 * Hide the lock screen overlay
 */
function hideAppLockScreen() {
  const lockScreen = document.getElementById('lock-screen');
  if (lockScreen) {
    lockScreen.style.display = 'none';
  }
}

/**
 * Mark session as active after successful unlock
 */
function markSessionActive() {
  sessionActive = true;
  sessionStorage.setItem(SECURITY_CONFIG.SESSION_ACTIVE_KEY, 'true');
  lastActivityTime = Date.now();
  localStorage.setItem(SECURITY_CONFIG.LAST_LOCK_TIME_KEY, lastActivityTime.toString());
  console.log('✅ Session marked active');
}

/**
 * Setup listeners for background/foreground transitions
 */
function setupActivityListeners() {
  // Detect when app goes to background (visibility change)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // App went to BACKGROUND
      console.log('📱 App went to background');
      clearTimeout(backgroundTimeout);
      // Don't lock immediately; wait for timeout
      backgroundTimeout = setTimeout(() => {
        if (document.hidden) {
          // Still in background after timeout
          sessionActive = false;
          sessionStorage.removeItem(SECURITY_CONFIG.SESSION_ACTIVE_KEY);
          console.log('⏰ Background timeout - will require lock on resume');
        }
      }, SECURITY_CONFIG.BACKGROUND_TIMEOUT_MS);
    } else {
      // App came to FOREGROUND
      console.log('✅ App came to foreground');
      clearTimeout(backgroundTimeout);
      
      if (!sessionActive && localStorage.getItem(SECURITY_CONFIG.LOCK_ENABLED_KEY) === 'true') {
        // Show lock screen
        console.log('🔒 Showing lock screen after background resume');
        lockScreenShown = true;
        showAppLockScreen();
      } else {
        hideAppLockScreen();
      }
    }
  });

  // Detect before unload (app closing)
  window.addEventListener('beforeunload', () => {
    console.log('🔚 App closing - clearing session');
    sessionStorage.removeItem(SECURITY_CONFIG.SESSION_ACTIVE_KEY);
  });
}

/**
 * Hash PIN using simple SHA-256 (use crypto API if available)
 */
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify PIN on lock screen
 */
async function verifyPinOnLockScreen(enteredPin) {
  const storedHash = localStorage.getItem(SECURITY_CONFIG.PIN_HASH_KEY);
  if (!storedHash) {
    console.error('❌ No PIN hash found');
    return false;
  }

  const enteredHash = await hashPin(enteredPin);
  if (enteredHash === storedHash) {
    console.log('✅ PIN verified');
    markSessionActive();
    hideAppLockScreen();
    return true;
  }

  console.error('❌ PIN incorrect');
  return false;
}

/**
 * Save PIN hash (on first setup)
 */
async function savePinHash(pin) {
  const hash = await hashPin(pin);
  localStorage.setItem(SECURITY_CONFIG.PIN_HASH_KEY, hash);
  console.log('✅ PIN hash saved');
}

/**
 * Enable app lock
 */
function enableAppLock(pin) {
  localStorage.setItem(SECURITY_CONFIG.LOCK_ENABLED_KEY, 'true');
  savePinHash(pin);
  console.log('🔒 App lock enabled');
}

/**
 * Disable app lock
 */
function disableAppLock() {
  localStorage.removeItem(SECURITY_CONFIG.LOCK_ENABLED_KEY);
  localStorage.removeItem(SECURITY_CONFIG.PIN_HASH_KEY);
  sessionActive = true;
  console.log('🔓 App lock disabled');
}
