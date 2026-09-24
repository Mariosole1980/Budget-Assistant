/**
 * js/instantTouchService.js
 *
 * Messenger-Grade Instant Tactile Touch & Tap Feedback System.
 * Eliminates mobile touch latency and mimics native app (Messenger/iOS) responsiveness:
 *
 * 1. 0ms Immediate Feedback:
 *    On pointerdown/touchstart, immediately applies .is-pressed class, scaling and dimming
 *    the button in <40ms without waiting for WebView's delayed :active state.
 *
 * 2. Instant Micro-Haptic Tick:
 *    Fires a subtle tactile tick (native linear motor / Web Vibration) on down.
 *
 * 3. 0ms Scroll Cancellation:
 *    If the finger moves > 8px (scrolling a list), the pressed state is cleanly cancelled.
 *
 * 4. Human-Eye Dwell Guarantee:
 *    Even on ultra-rapid 20ms taps, holds .is-pressed for a minimum of 70ms so the user's
 *    eye visibly registers the mechanical compression, then rebounds smoothly.
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
  var MIN_PRESS_DWELL_MS = 70; // ms

  var currentPressedEl = null;
  var pressStartTime = 0;
  var startX = 0;
  var startY = 0;
  var releaseTimer = null;
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
      if (typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') {
        window.triggerHaptic('selection');
      } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
      }
    } catch (e) {
      // Best-effort haptic
    }
  }

  function clearPressedState(el, immediate) {
    if (!el) return;
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }

    if (immediate) {
      el.classList.remove('is-pressed');
    } else {
      var elapsed = Date.now() - pressStartTime;
      if (elapsed < MIN_PRESS_DWELL_MS) {
        releaseTimer = setTimeout(function () {
          el.classList.remove('is-pressed');
          releaseTimer = null;
        }, MIN_PRESS_DWELL_MS - elapsed);
      } else {
        el.classList.remove('is-pressed');
      }
    }
  }

  function handlePointerDown(e) {
    // Only respond to main left click or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    var target = findInteractiveTarget(e.target);
    if (!target) return;

    if (currentPressedEl && currentPressedEl !== target) {
      clearPressedState(currentPressedEl, true);
    }

    currentPressedEl = target;
    pressStartTime = Date.now();
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
      clearPressedState(currentPressedEl, true);
      currentPressedEl = null;
    }
  }

  function handlePointerUp() {
    if (!currentPressedEl) return;
    clearPressedState(currentPressedEl, false);
    currentPressedEl = null;
  }

  function handlePointerCancel() {
    if (!currentPressedEl) return;
    clearPressedState(currentPressedEl, true);
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
          clearPressedState(currentPressedEl, true);
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
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
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
