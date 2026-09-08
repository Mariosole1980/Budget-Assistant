/**
 * js/hapticFeedbackService.js
 *
 * Universal Haptic Feedback Subsystem for Budget Assistant.
 *
 * Provides tactile haptic feedback for mobile app interactions:
 * - Capacitor Haptics plugin on native iOS & Android (Taptic Engine)
 * - Web Vibration API (navigator.vibrate) on mobile browsers / Android PWA
 * - Graceful silent fallback on desktop / unsupported environments
 *
 * Semantic trigger types:
 * - 'selection': Light subtle tick for calendar dates, picker wheels, chips
 * - 'light': Minor impact for buttons, tab switching, filters
 * - 'medium': Primary action for FAB (+), modal open/close
 * - 'heavy': Significant action (pull to refresh, long press)
 * - 'success': Completed transaction save, sync complete, bill quick-paid
 * - 'warning': Budget threshold approached, unsaved changes alert
 * - 'error': Transaction deleted, form validation error
 *
 * User configuration:
 * Persisted in localStorage key 'haptic_feedback_enabled' ('true'/'false', default 'true').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    var exports = factory();
    Object.assign(root, exports);
    root.HapticFeedbackService = exports;
    if (typeof globalThis !== 'undefined') globalThis.HapticFeedbackService = exports;
    if (typeof window !== 'undefined') {
      window.HapticFeedbackService = exports;
      window.triggerHaptic = exports.trigger;
      window.isHapticEnabled = exports.isEnabled;
      window.setHapticEnabled = exports.setEnabled;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'haptic_feedback_enabled';

  function isEnabled() {
    try {
      if (typeof localStorage === 'undefined') return true;
      var val = localStorage.getItem(STORAGE_KEY);
      return val !== 'false';
    } catch (e) {
      return true;
    }
  }

  function setEnabled(enabled) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
      return enabled;
    } catch (e) {
      return enabled;
    }
  }

  function getCapacitorHaptics() {
    try {
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        return window.Capacitor.Plugins.Haptics;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function hasWebVibration() {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    } catch (e) {
      return false;
    }
  }

  /**
   * Main trigger function
   * @param {string} type - 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
   */
  function trigger(type) {
    if (!isEnabled()) return false;

    var normalizedType = String(type || 'light').toLowerCase();
    var capHaptics = getCapacitorHaptics();

    // 1. Try Native Capacitor Haptics (iOS / Android Native)
    if (capHaptics) {
      try {
        switch (normalizedType) {
          case 'selection':
            if (typeof capHaptics.selectionStart === 'function') {
              capHaptics.selectionStart().catch(function () {});
            } else if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'LIGHT' }).catch(function () {});
            }
            return true;
          case 'light':
            if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'LIGHT' }).catch(function () {});
            }
            return true;
          case 'medium':
            if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'MEDIUM' }).catch(function () {});
            }
            return true;
          case 'heavy':
            if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'HEAVY' }).catch(function () {});
            }
            return true;
          case 'success':
            if (typeof capHaptics.notification === 'function') {
              capHaptics.notification({ type: 'SUCCESS' }).catch(function () {});
            } else if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'LIGHT' }).catch(function () {});
            }
            return true;
          case 'warning':
            if (typeof capHaptics.notification === 'function') {
              capHaptics.notification({ type: 'WARNING' }).catch(function () {});
            } else if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'MEDIUM' }).catch(function () {});
            }
            return true;
          case 'error':
            if (typeof capHaptics.notification === 'function') {
              capHaptics.notification({ type: 'ERROR' }).catch(function () {});
            } else if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'HEAVY' }).catch(function () {});
            }
            return true;
          default:
            if (typeof capHaptics.impact === 'function') {
              capHaptics.impact({ style: 'LIGHT' }).catch(function () {});
            }
            return true;
        }
      } catch (err) {
        // Fallback to Web Vibration if Capacitor fails
      }
    }

    // 2. Web Vibration API Fallback (Android Chrome / Installed PWA)
    if (hasWebVibration()) {
      try {
        switch (normalizedType) {
          case 'selection':
            navigator.vibrate(8);
            return true;
          case 'light':
            navigator.vibrate(12);
            return true;
          case 'medium':
            navigator.vibrate(22);
            return true;
          case 'heavy':
            navigator.vibrate(38);
            return true;
          case 'success':
            navigator.vibrate([15, 40, 20]);
            return true;
          case 'warning':
            navigator.vibrate([25, 40, 25]);
            return true;
          case 'error':
            navigator.vibrate([40, 50, 40, 50]);
            return true;
          default:
            navigator.vibrate(15);
            return true;
        }
      } catch (err) {
        return false;
      }
    }

    // 3. Graceful no-op on desktop / unsupported devices
    return false;
  }

  return {
    trigger: trigger,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    selection: function () { return trigger('selection'); },
    light: function () { return trigger('light'); },
    medium: function () { return trigger('medium'); },
    heavy: function () { return trigger('heavy'); },
    success: function () { return trigger('success'); },
    warning: function () { return trigger('warning'); },
    error: function () { return trigger('error'); }
  };
});
