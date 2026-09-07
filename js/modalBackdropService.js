/**
 * ModalBackdropService - Modular Modal, Backdrop Tap & Visual Viewport Subsystem
 *
 * Handles:
 * - Overlay positioning & DOM self-healing (ensureOverlayInBody, initOverlayPlacement)
 * - Modal opening and closing lifecycle (openModal, closeModal)
 * - Backdrop tap-to-close with anti-ghost-tap guards (initBackdropTapHandlers)
 * - iOS Safari / Android WebView visual viewport height & virtual keyboard adjustment
 * - Viewport panning reset (forceViewportReset)
 * - Android safe-area bottom fallback
 *
 * UMD pattern: Browser global + Node.js module.exports
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ModalBackdropService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  // Registry of all full-screen overlays that must be direct children of <body>.
  var FULLSCREEN_OVERLAY_IDS = [
    'auth-overlay',
    'app-redirect-overlay',
    'lock-screen',
    'transaction-modal',
    'search-overlay',
    'fhs-details-modal',
    'forecast-details-modal',
    'advisor-chat-modal',
    'profile-settings-modal',
    'settings-subscreen-modal'
  ];

  /**
   * Helper to ensure every full-screen overlay is a direct child of document.body
   */
  function ensureOverlayInBody(el) {
    if (!el || !el.id || typeof document === 'undefined') return;
    var isOverlay = el.classList.contains('modal-overlay') ||
      el.classList.contains('auth-overlay') ||
      el.classList.contains('tx-modal-overlay') ||
      el.id === 'lock-screen' ||
      el.id === 'search-overlay';
    if (!isOverlay) return;

    try {
      if (el.parentElement !== document.body) {
        document.body.appendChild(el);
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[OVERLAY] Moved #' + el.id + ' to <body> (was nested inside a positioned/overflow container).');
        }
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[OVERLAY] Failed to reposition #' + el.id + ':', e);
      }
    }
  }

  /**
   * Self-healing startup check: move any top-level overlay directly under <body>.
   */
  function initOverlayPlacement() {
    if (typeof document === 'undefined') return;
    try {
      document.querySelectorAll('.modal-overlay, .auth-overlay, .tx-modal-overlay, #lock-screen, #search-overlay').forEach(function (el) {
        ensureOverlayInBody(el);
      });
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[OVERLAY] initOverlayPlacement failed:', e);
      }
    }
  }

  /**
   * Open modal with optional instant transition.
   */
  function openModal(id, opts) {
    var instant = opts && opts.instant;
    if (typeof window !== 'undefined' && typeof window.ensureHistoryPushed === 'function') {
      window.ensureHistoryPushed();
    } else if (typeof ensureHistoryPushed === 'function') {
      ensureHistoryPushed();
    }

    if (typeof document === 'undefined') return;
    var el = document.getElementById(id);
    if (!el) return;

    ensureOverlayInBody(el);
    el._openedAt = Date.now();

    if (id === 'transaction-modal') {
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.top = '0px';
    }
    if (id === 'fhs-details-modal') {
      var fhsExplainContent = document.getElementById('fhs-explain-content');
      var fhsExplainChevron = document.getElementById('fhs-explain-chevron');
      if (fhsExplainContent) fhsExplainContent.style.display = 'none';
      if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(0deg)';
    }

    var activate = function () {
      el.classList.add('active');
      document.body.classList.add('modal-open');
    };

    if (instant) {
      activate();
    } else {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(activate);
      } else {
        activate();
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('bg_active_modal_id', id);
      } catch (e) {}
    }
  }

  /**
   * Snap scroll position back to 0 on iOS to reset visualViewport panning
   */
  function forceViewportReset(syncOnly) {
    if (!isIOS || typeof window === 'undefined' || typeof document === 'undefined') return;

    window.scrollTo(0, 0);
    document.body.scrollTop = 0;

    if (syncOnly) {
      return;
    }

    var hasOffset = window.scrollY > 0 || (window.visualViewport && window.visualViewport.offsetTop > 0);
    if (hasOffset) {
      var originalHeight = document.body.style.height;
      document.body.style.setProperty('height', (window.innerHeight + 150) + 'px', 'important');
      window.scrollTo(0, 10);
      setTimeout(function () {
        window.scrollTo(0, 0);
        document.body.style.height = originalHeight || '';
        if (!originalHeight) {
          document.body.style.removeProperty('height');
        }
        document.body.scrollTop = 0;
      }, 100);
    }
  }

  /**
   * Close modal by ID with anti-ghost guards and state reset
   */
  function closeModal(id, opts) {
    var userInitiated = !!(opts && opts.userInitiated) || !!(typeof window !== 'undefined' && window.__userInitiatedClose);
    if (typeof window !== 'undefined' && window.__userInitiatedClose) {
      window.__userInitiatedClose = false;
    }

    if (typeof window !== 'undefined' && window._appJustResumed && !userInitiated) {
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    if (typeof document !== 'undefined') {
      setTimeout(function () {
        document.body.style.pointerEvents = '';
      }, 100);

      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
      }
    }

    var el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[closeModal] Element not found:', id);
      }
      return;
    }

    if (id === 'settings-subscreen-modal' && typeof window !== 'undefined') {
      window._currentSettingsSubscreenTitleKey = null;
      window._currentSettingsSubscreenId = null;
      window._settingsSubscreenHistory = [];
    }

    el.classList.remove('active');
    if (id === 'transaction-modal' && el.style) {
      el.style.cssText = '';
    }

    var activeModals = typeof document !== 'undefined'
      ? document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active')
      : [];

    if (activeModals.length === 0) {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('modal-open');
      }

      setTimeout(function () {
        forceViewportReset();
      }, 50);
      setTimeout(function () {
        forceViewportReset();
      }, 450);

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('bg_active_modal_id');
          localStorage.removeItem('bg_modal_scroll_top');
          localStorage.removeItem('bg_active_modal_tx_id');
          localStorage.removeItem('bg_active_subcat_txs');
        } catch (e) {}
      }

      if (typeof updateUI === 'function') {
        updateUI();
      } else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') {
        window.updateUI();
      }
    } else {
      var topModal = activeModals[activeModals.length - 1];
      if (topModal && topModal.id && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('bg_active_modal_id', topModal.id);
        } catch (e) {}
      }
    }

    if (id === 'transaction-modal') {
      if (typeof window !== 'undefined' && typeof window.closeCalculatorKeypad === 'function') {
        window.closeCalculatorKeypad();
      }
      if (typeof state !== 'undefined') {
        state.lastOpenedTransactionId = null;
      } else if (typeof window !== 'undefined' && window.state) {
        window.state.lastOpenedTransactionId = null;
      }
      if (typeof clearRecurringSettings === 'function') {
        clearRecurringSettings(false);
      } else if (typeof window !== 'undefined' && typeof window.clearRecurringSettings === 'function') {
        window.clearRecurringSettings(false);
      }
    }

    if (id === 'category-picker-modal') {
      var settingsTabs = typeof document !== 'undefined' ? document.getElementById('category-picker-settings-tabs') : null;
      if (settingsTabs) settingsTabs.style.display = 'none';
      if (typeof window !== 'undefined') {
        window._openedCategoryPickerFromSettings = false;
        window.categoryPickerEditMode = false;
      }
      if (typeof categoryPickerEditMode !== 'undefined') {
        categoryPickerEditMode = false;
      }
    }
  }

  /**
   * Attach backdrop tap-to-close on modal overlays
   */
  function initBackdropTapHandlers() {
    var fullScreenModals = ['transaction-modal', 'profile-settings-modal'];

    function markUserInitiated() {
      if (typeof window !== 'undefined') {
        window.__userInitiatedClose = true;
      }
    }

    function attachBackdropTap(modal) {
      if (!modal || modal._hasBackdropTapAttached) return;
      modal._hasBackdropTapAttached = true;
      var touchStartTarget = null;

      modal.addEventListener('touchstart', function (e) {
        touchStartTarget = e.target;
      }, { passive: true });

      modal.addEventListener('touchend', function (e) {
        if (touchStartTarget === modal && e.target === modal) {
          if (fullScreenModals.indexOf(modal.id) !== -1) return;
          if (modal._openedAt && (Date.now() - modal._openedAt < 350)) return;
          if (e.cancelable) e.preventDefault();
          markUserInitiated();
          closeModal(modal.id);
        }
        touchStartTarget = null;
      }, { passive: false });

      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          if (fullScreenModals.indexOf(modal.id) !== -1) return;
          if (modal._openedAt && (Date.now() - modal._openedAt < 350)) return;
          markUserInitiated();
          closeModal(modal.id);
        }
      });
    }

    if (typeof document !== 'undefined') {
      document.querySelectorAll('.modal-overlay, .tx-modal-overlay, .profile-sheet-overlay').forEach(function (modal) {
        if (modal.id === 'profile-settings-modal' || modal.id === 'custom-dialog-modal' || modal.id === 'offline-import-modal') return;
        attachBackdropTap(modal);
      });

      if (typeof window !== 'undefined' && !window._closeControlClickListenerAttached) {
        window._closeControlClickListenerAttached = true;
        document.addEventListener('click', function (e) {
          var t = e.target;
          var isCloseControl =
            (t && t.closest && (
              t.closest('.icon-btn') ||
              t.closest('.modal-close') ||
              t.closest('[onclick*="closeModal"]') ||
              t.closest('[onclick*="closeProfileSheet"]') ||
              t.closest('[onclick*="closeSearchOverlay"]')
            ));
          if (isCloseControl) {
            markUserInitiated();
          }
        }, true);
      }
    }
  }

  /**
   * Android safe-area bottom fallback in standalone mode
   */
  function initAndroidSafeAreaFallback() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (!isAndroid || !isStandalone) return;

    var testEl = document.createElement('div');
    testEl.style.position = 'fixed';
    testEl.style.bottom = '0';
    testEl.style.height = 'env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(testEl);
    var safeBottom = testEl.offsetHeight;
    document.body.removeChild(testEl);

    if (safeBottom === 0) {
      document.documentElement.style.setProperty('--safe-area-bottom', '12px');
    }
  }

  /**
   * Dynamic Visual Viewport Height Adjustment (for virtual keyboard support)
   */
  function initVisualViewportAdjustment() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window._vpAdjustmentInitialized) return;
    window._vpAdjustmentInitialized = true;

    var maxViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    if (window.visualViewport) {
      var updateViewportHeight = function (force) {
        if (window._appJustResumed && !force) return;

        if (force) {
          document.documentElement.style.setProperty('--viewport-height', window.innerHeight + 'px');
          document.documentElement.style.setProperty('--viewport-offset-top', '0px');
          document.documentElement.style.setProperty('--keyboard-height', '0px');
          return;
        }

        var vvHeight = window.visualViewport.height;
        var offsetTop = window.visualViewport.offsetTop;

        if (vvHeight > maxViewportHeight) {
          maxViewportHeight = vvHeight;
        }

        var rawKeyboardHeight = isIOS ? (window.innerHeight - vvHeight) : (window.innerHeight - vvHeight - offsetTop);
        var scale = isIOS ? 1.0 : 0.93;
        var keyboardHeight = Math.max(0, rawKeyboardHeight) / scale;

        document.documentElement.style.setProperty('--viewport-height', window.innerHeight + 'px');
        document.documentElement.style.setProperty('--viewport-offset-top', offsetTop + 'px');
        document.documentElement.style.setProperty('--keyboard-height', keyboardHeight + 'px');
      };

      window._updateViewportHeight = updateViewportHeight;

      var _vpRafId = null;
      var debouncedUpdateViewport = isIOS
        ? function () {
          if (_vpRafId) return;
          _vpRafId = requestAnimationFrame(function () {
            _vpRafId = null;
            updateViewportHeight();
          });
        }
        : updateViewportHeight;

      window.visualViewport.addEventListener('resize', debouncedUpdateViewport);
      window.visualViewport.addEventListener('scroll', debouncedUpdateViewport);

      window.addEventListener('resize', function () {
        var isInputFocused = document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA');
        if (!isInputFocused && window.visualViewport) {
          maxViewportHeight = window.visualViewport.height;
        }
        updateViewportHeight();
      });

      updateViewportHeight();
    } else {
      document.documentElement.style.setProperty('--viewport-height', '100vh');
      document.documentElement.style.setProperty('--viewport-offset-top', '0px');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }

    window.addEventListener('scroll', function () {
      if (isIOS) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      }
    });
  }

  // Auto-initialize when running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        initAndroidSafeAreaFallback();
        initBackdropTapHandlers();
        initVisualViewportAdjustment();
        initOverlayPlacement();
      });
    } else {
      initAndroidSafeAreaFallback();
      setTimeout(initBackdropTapHandlers, 0);
      initVisualViewportAdjustment();
      setTimeout(initOverlayPlacement, 0);
    }
  }

  var service = {
    FULLSCREEN_OVERLAY_IDS: FULLSCREEN_OVERLAY_IDS,
    ensureOverlayInBody: ensureOverlayInBody,
    initOverlayPlacement: initOverlayPlacement,
    openModal: openModal,
    closeModal: closeModal,
    forceViewportReset: forceViewportReset,
    initBackdropTapHandlers: initBackdropTapHandlers,
    initAndroidSafeAreaFallback: initAndroidSafeAreaFallback,
    initVisualViewportAdjustment: initVisualViewportAdjustment
  };

  if (typeof window !== 'undefined') {
    window.ModalBackdropService = service;
    window.ensureOverlayInBody = ensureOverlayInBody;
    window.initOverlayPlacement = initOverlayPlacement;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.forceViewportReset = forceViewportReset;
    window.initBackdropTapHandlers = initBackdropTapHandlers;
  }

  return service;
}));
