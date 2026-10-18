/**
 * js/instantTouchService.js
 *
 * Messenger-Grade Instant Tactile Touch & Tap Feedback System.
 * Eliminates mobile touch latency and mimics native app (Messenger/iOS) responsiveness:
 *
 * 1. 0ms Immediate Feedback:
 *    On pointerdown/touchstart, immediately applies .is-pressed — a subtle press
 *    compression with NO opacity dimming — instead of waiting for the WebView's
 *    delayed :active state.
 *
 * 2. Native-Only Haptic Tick:
 *    Native engines tick through the Capacitor Haptics plugin. In a plain WebView we
 *    deliberately stay silent: a raw vibration-motor "bzz" on every tap is the single
 *    most obvious "cheap Android wrapper" tell (Messenger never vibrates on a tap).
 *
 * 3. 0ms Scroll Cancellation:
 *    If the finger moves > 8px (scrolling a list), the pressed state is cleanly cancelled.
 *
 * 4. No Artificial Dwell:
 *    The pressed state is released the instant the finger lifts. HOLDING it for a
 *    minimum dwell made fast taps feel sticky and out of sync with the finger.
 *
 * 5. Input Safety:
 *    Excludes text inputs, textareas, selects, sliders, and form editing controls.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser global / UMD
    var exports = factory();
    root.InstantTouchService = exports;
    if (typeof window !== 'undefined') {
      window.InstantTouchService = exports;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCROLL_CANCEL_THRESHOLD = 8; // px

  var currentPressedEl = null;
  var startX = 0;
  var startY = 0;
  var lastHapticTime = 0;
  var isInitialized = false;

  var INTERACTIVE_SELECTOR = [
    'button',
    '.btn',
    '.icon-btn',
    '.nav-item',
    '.fab',
    '.fab-note',
    '.calc-key-btn',
    '.keypad-btn',
    '.period-btn',
    '.type-tab-btn',
    '.stats-tab-btn',
    '.stats-period-btn',
    '.stats-dropdown-item',
    '.category-picker-item',
    '.subcategory-item',
    '.account-picker-item',
    '.budget-picker-item',
    '.filter-chip',
    '.search-chip',
    '.time-preset-chip',
    '.advisor-suggestion-chip',
    '.custom-select-trigger',
    '.bottom-sheet-option',
    '.photo-source-opt',
    '.transaction-item',
    '.stats-row',
    '.stats-sub-row',
    '.settings-card',
    '.settings-list-item',
    '.modern-note-card',
    '.recurring-template-card',
    '.clickable',
    '[role="button"]'
  ].join(', ');

  var EXCLUDED_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '.slider-thumb',
    '.range-slider',
    '[data-no-press]'
  ].join(', ');

  function findInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;
    if (target.closest(EXCLUDED_SELECTOR)) return null;
    return target.closest(INTERACTIVE_SELECTOR);
  }

  function triggerInstantHaptic() {
    var now = Date.now();
    if (now - lastHapticTime < 40) return; // Prevent duplicate vibrations on rapid multi-touch
    lastHapticTime = now;

    try {
      // Native haptics only — never fall back to navigator.vibrate() on touch-down.
      if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
        window.triggerHaptic('selection');
      }
    } catch (e) {
      // Best-effort haptic
    }
  }

  function clearPressedState(el) {
    if (!el) return;

    // Release immediately: the CSS rebound transition already provides the visible
    // "spring back", so an artificial minimum dwell only adds lag and desync.
    el.classList.remove('is-pressed');
  }

  function handlePointerDown(e) {
    // Only respond to main left click or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    var target = findInteractiveTarget(e.target);
    if (!target) return;

    if (currentPressedEl && currentPressedEl !== target) {
      clearPressedState(currentPressedEl);
    }

    currentPressedEl = target;
    startX = e.clientX || 0;
    startY = e.clientY || 0;

    target.classList.add('is-pressed');
    triggerInstantHaptic();
  }

  function handlePointerMove(e) {
    if (!currentPressedEl) return;
    var x = e.clientX || 0;
    var y = e.clientY || 0;
    var dx = x - startX;
    var dy = y - startY;

    // If movement exceeds threshold, user is scrolling or dragging: cancel active state immediately
    if (Math.sqrt(dx * dx + dy * dy) > SCROLL_CANCEL_THRESHOLD) {
      clearPressedState(currentPressedEl);
      currentPressedEl = null;
    }
  }

  function handlePointerUp() {
    if (!currentPressedEl) return;
    clearPressedState(currentPressedEl);
    currentPressedEl = null;
  }

  function handlePointerCancel() {
    if (!currentPressedEl) return;
    clearPressedState(currentPressedEl);
    currentPressedEl = null;
  }

  function init() {
    if (isInitialized || typeof document === 'undefined') return;
    isInitialized = true;

    var supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;

    if (supportsPointer) {
      document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
      document.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true });
      document.addEventListener('pointerup', handlePointerUp, { capture: true, passive: true });
      document.addEventListener('pointercancel', handlePointerCancel, { capture: true, passive: true });
    } else {
      // Touch fallback for older engines
      document.addEventListener('touchstart', function (e) {
        if (e.touches && e.touches[0]) handlePointerDown(e.touches[0]);
      }, { capture: true, passive: true });
      document.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches[0]) handlePointerMove(e.touches[0]);
      }, { capture: true, passive: true });
      document.addEventListener('touchend', handlePointerUp, { capture: true, passive: true });
      document.addEventListener('touchcancel', handlePointerCancel, { capture: true, passive: true });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', function () {
        if (currentPressedEl) {
          clearPressedState(currentPressedEl);
          currentPressedEl = null;
        }
      });
    }
  }

  function destroy() {
    if (!isInitialized || typeof document === 'undefined') return;
    isInitialized = false;

    document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    document.removeEventListener('pointermove', handlePointerMove, { capture: true });
    document.removeEventListener('pointerup', handlePointerUp, { capture: true });
    document.removeEventListener('pointercancel', handlePointerCancel, { capture: true });

    if (currentPressedEl) {
      currentPressedEl.classList.remove('is-pressed');
      currentPressedEl = null;
    }
  }

  // Auto-initialize when running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init: init,
    destroy: destroy,
    findInteractiveTarget: findInteractiveTarget,
    triggerInstantHaptic: triggerInstantHaptic,
    clearPressedState: clearPressedState
  };
});
