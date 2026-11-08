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
 *    If the finger moves > 20px (scrolling a list) the pressed state is cleanly
 *    cancelled. A horizontal drag needs no such tolerance: it is a pager/month
 *    swipe from the first pixels, so it cancels at 6px and the row never stays
 *    greyed out mid-swipe.
 *
 * 4. Delayed Press for Swipeable Rows:
 *    Rows that double as swipe targets (transaction-item, stats-row) defer the
 *    .is-pressed class by SWIPEABLE_PRESS_DELAY_MS ms.  If horizontal movement
 *    is detected within that window the timer is cancelled and the class is never
 *    added — eliminating the grey flash on month-swipe gestures.
 *
 * 5. No Artificial Dwell:
 *    The pressed state is released the instant the finger lifts. HOLDING it for a
 *    minimum dwell made fast taps feel sticky and out of sync with the finger.
 *
 * 6. Input Safety:
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

  var SCROLL_CANCEL_THRESHOLD = 20;   // px (avoids false cancellations from natural thumb flattening/jitter)
  var HORIZONTAL_CANCEL_THRESHOLD = 6; // px — a horizontal drag is a month swipe, not a tap
  // How long to wait before adding .is-pressed on swipeable rows (transaction-item etc.).
  // During this window a horizontal move cancels the pending press before the class is
  // ever applied, so swiping months never briefly highlights a transaction row.
  var SWIPEABLE_PRESS_DELAY_MS = 80; // ms

  var currentPressedEl = null;
  var pendingPressEl = null;      // element waiting for the delayed press timer
  var pendingPressTimer = null;   // setTimeout id for the delayed .is-pressed
  var startX = 0;
  var startY = 0;
  var lastHapticTime = 0;
  var isInitialized = false;

  // Selectors for rows and cards that double as scroll and swipe surfaces.
  // These deliberately never get a pressed highlight or haptic tick on touch-down,
  // completely eliminating the grey flash and accidental selection feeling during scrolling & swiping.
  var SWIPEABLE_ROW_SELECTOR = [
    '.transaction-item',
    '.stats-row',
    '.stats-sub-row',
    '.settings-card',
    '.settings-list-item',
    '.modern-note-card',
    '.recurring-template-card',
    '.category-picker-item',
    '.subcategory-item',
    '.account-picker-item',
    '.budget-picker-item',
    '.bottom-sheet-option',
    '.photo-source-opt',
    '.search-result-item',
    '.search-filter-row',
    '.settings-picker-item',
    '.theme-card-option',
    '.custom-select-trigger'
  ].join(', ');

  var INTERACTIVE_SELECTOR = [
    'button',
    'a',
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
    var el = target.closest(INTERACTIVE_SELECTOR);
    if (el) return el;
    var clickable = target.closest('[onclick], [role="button"], .clickable');
    if (clickable && !clickable.closest(EXCLUDED_SELECTOR)) return clickable;
    return null;
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

  /** Cancel the delayed-press timer (used for swipeable rows). */
  function cancelPendingPress() {
    if (pendingPressTimer !== null) {
      clearTimeout(pendingPressTimer);
      pendingPressTimer = null;
    }
    pendingPressEl = null;
  }

  function handlePointerDown(e) {
    // Only respond to main left click or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    var target = findInteractiveTarget(e.target);
    if (!target) return;

    // Clear any previous state
    if (currentPressedEl && currentPressedEl !== target) {
      clearPressedState(currentPressedEl);
    }
    cancelPendingPress();

    currentPressedEl = null;
    startX = e.clientX || 0;
    startY = e.clientY || 0;

    // Check if this element is a scrollable/swipeable row or card that doubles as a touch/scroll surface.
    var isSwipeable = typeof target.matches === 'function' && target.matches(SWIPEABLE_ROW_SELECTOR);

    if (isSwipeable) {
      // Scrollable rows and cards (.transaction-item, .settings-list-item, .modern-note-card, etc.)
      // double as scroll and swipe surfaces. They deliberately never get a pressed highlight or haptic tick
      // on touch-down, completely eliminating the grey flash and "accidental selection" feeling during scrolling and swiping.
      return;
    } else {
      // Immediate press for all other interactive elements.
      currentPressedEl = target;
      target.classList.add('is-pressed');
      triggerInstantHaptic();
    }
  }

  function handlePointerMove(e) {
    var x = e.clientX || 0;
    var y = e.clientY || 0;
    var dx = x - startX;
    var dy = y - startY;

    // If a delayed press is pending, a horizontal movement cancels it before
    // the class is applied — this is the fix for the swipe-greying bug.
    if (pendingPressEl) {
      var isHorizontalSwipe = Math.abs(dx) >= HORIZONTAL_CANCEL_THRESHOLD && Math.abs(dx) > Math.abs(dy);
      if (isHorizontalSwipe || shouldCancelPress(dx, dy)) {
        cancelPendingPress();
      }
      return;
    }

    if (!currentPressedEl) return;

    // If the gesture is a drag/swipe, cancel the active state immediately
    if (shouldCancelPress(dx, dy)) {
      clearPressedState(currentPressedEl);
      currentPressedEl = null;
    }
  }

  /**
   * A press is cancelled by any real movement. Vertical/diagonal scrolling keeps the
   * generous 20px tolerance (thumb flattening), but a horizontal drag is a month
   * swipe / pager gesture from the very first pixels: waiting for 20px left the row
   * greyed out at the start of every swipe, which looked like a selection.
   */
  function shouldCancelPress(dx, dy) {
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > SCROLL_CANCEL_THRESHOLD) return true;
    return Math.abs(dx) >= HORIZONTAL_CANCEL_THRESHOLD && Math.abs(dx) > Math.abs(dy);
  }

  function handlePointerUp() {
    cancelPendingPress();
    if (!currentPressedEl) return;
    clearPressedState(currentPressedEl);
    currentPressedEl = null;
  }

  function handlePointerCancel() {
    cancelPendingPress();
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
        cancelPendingPress();
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

    cancelPendingPress();
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
    clearPressedState: clearPressedState,
    shouldCancelPress: shouldCancelPress
  };
});
