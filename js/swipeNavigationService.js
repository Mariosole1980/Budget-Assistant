/**
 * ============================================================
 * SWIPE & MONTH NAVIGATION SUBSYSTEM
 * ------------------------------------------------------------
 * Handles touch swipe gestures for adjacent month navigation,
 * snap animations with GPU acceleration, and lightweight swipe renders.
 *
 * Extracted from app.js (Phase 27A Architectural Modularization)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SwipeNavigationService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    return (typeof window !== 'undefined' && window.state) ? window.state : {};
  }

  function initTabSwipeNavigation() {
    if (typeof document === 'undefined') return;
    const appContent = document.querySelector('.app-content');
    if (!appContent) return;

    const state = getState();
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastMoveX = 0;
    let lastMoveTime = 0;
    let velocity = 0;
    let touchActive = false;
    let isSwipingHorizontal = null;

    const edgeThreshold = 24; // Thin strip reserved for the system back gesture
    const triggerThreshold = 18; // Snappy but deliberate: 18px of travel commits
    const flingVelocity = 0.25; // A quick flick (px/ms) commits instantly
    const HORIZONTAL_DOMINANCE = 1.05; // |dx| must clearly beat |dy| before we claim a swipe

    // POINTER EVENTS (instead of touchmove + preventDefault):
    // A non-passive touchmove listener forces the WebView to run scrolling on the
    // main thread, which is what made scrolling stutter. Pointer events keep the
    // compositor fast-path intact, and the browser tells us "this became a scroll"
    // through pointercancel — which is exactly how vertical scrolls stay untouched.
    let activePointerId = null;
    let suppressClickUntil = 0;

    // Drag-phase guard: the moment the gesture turns horizontal the rows under the
    // finger must stop looking pressed — a month swipe is not a tap. The class only
    // neutralises the press visuals (style.css), never pointer-events, so the
    // gesture keeps flowing to this handler.
    let dragGuardTimer = null;

    const setDragVisuals = (active) => {
      clearTimeout(dragGuardTimer);
      if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
      if (active) {
        document.body.classList.add('month-swipe-dragging');
        // Safety net: never leave the guard on if pointerup/cancel is lost.
        dragGuardTimer = setTimeout(() => {
          if (document.body && document.body.classList) {
            document.body.classList.remove('month-swipe-dragging');
          }
        }, 1500);
      } else {
        document.body.classList.remove('month-swipe-dragging');
      }
    };

    // A horizontal drag must not synthesize a tap on the row/element underneath.
    appContent.addEventListener('click', (e) => {
      if (Date.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        e.stopPropagation();
        if (e.cancelable && e.preventDefault) e.preventDefault();
      }
    }, true);

    appContent.addEventListener('pointerdown', (e) => {
      // Desktop pointers use the chevron buttons; a drag-to-select must never switch month
      if (e.pointerType === 'mouse') return;

      // A new touch means a new intent: never let a previous swipe's ghost-click
      // guard swallow the tap the user is making right now.
      suppressClickUntil = 0;

      const activeModals = document.querySelectorAll('.modal-overlay.active, .tx-modal-overlay.active');
      const searchOverlay = document.getElementById('search-overlay');
      const isSearchActive = searchOverlay && searchOverlay.classList.contains('active');
      if (state.isSwipingMonth && (Date.now() - (state.lastSwipeTime || 0) > 350)) {
        state.isSwipingMonth = false;
        if (document.body && document.body.classList) {
          document.body.classList.remove('is-swiping-month');
        }
      }
      if (activeModals.length > 0 || isSearchActive || state.selectionMode || state.isSwipingMonth) {
        touchActive = false;
        activePointerId = null;
        return;
      }

      if (e.target && e.target.closest && e.target.closest('.category-quick-filters, .quick-filter-chips, .filters-panel-header, #statsChart, canvas, .stats-subcategories-container')) {
        touchActive = false;
        activePointerId = null;
        return;
      }

      const x = typeof e.clientX === 'number' ? e.clientX : 0;
      const y = typeof e.clientY === 'number' ? e.clientY : 0;
      startX = x;
      startY = y;
      lastMoveX = x;
      lastMoveTime = Date.now();
      velocity = 0;
      startTime = lastMoveTime;

      const windowWidth = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 360;
      if (x <= edgeThreshold || x >= windowWidth - edgeThreshold) {
        touchActive = false;
        activePointerId = null;
        return;
      }

      touchActive = true;
      isSwipingHorizontal = null;
      activePointerId = e.pointerId;
    }, { passive: true });

    appContent.addEventListener('pointerup', (e) => {
      if (!touchActive || e.pointerId !== activePointerId) return;
      const wasHorizontal = isSwipingHorizontal === true;
      touchActive = false;
      activePointerId = null;
      isSwipingHorizontal = null;
      setDragVisuals(false);

      if (wasHorizontal) commitSwipe(e.clientX);

      setTimeout(() => { state.touchDidMove = false; }, 120);
    }, { passive: true });

    appContent.addEventListener('pointercancel', () => {
      const wasHorizontal = touchActive && isSwipingHorizontal === true;
      touchActive = false;
      activePointerId = null;
      isSwipingHorizontal = null;
      setDragVisuals(false);

      if (wasHorizontal) commitSwipe(lastMoveX);

      setTimeout(() => { state.touchDidMove = false; }, 100);
    }, { passive: true });

    appContent.addEventListener('pointermove', (e) => {
      if (!touchActive || e.pointerId !== activePointerId || state.isSwipingMonth) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (isSwipingHorizontal === null) {
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
          // Horizontal dominance is required: a vertical (or diagonal) scroll is
          // NEVER converted into a month change.
          if (Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_DOMINANCE) {
            if (state.activeTab === 'trans' || state.activeTab === 'stats') {
              isSwipingHorizontal = true;
              state.touchDidMove = true;
              setDragVisuals(true);
            } else {
              isSwipingHorizontal = false;
              touchActive = false;
              activePointerId = null;
            }
          } else {
            // Vertical intent: hand the gesture back to the native scroller
            isSwipingHorizontal = false;
            touchActive = false;
            activePointerId = null;
          }
        }
      }

      if (isSwipingHorizontal === true) {
        const now = Date.now();
        const dt = now - lastMoveTime;
        if (dt > 0) {
          velocity = (e.clientX - lastMoveX) / dt;
        }
        lastMoveX = e.clientX;
        lastMoveTime = now;
      }
    }, { passive: true });

    // Commit a horizontal gesture. Shared by pointerup and pointercancel so a
    // WebView that steals the gesture right before release cannot silently drop
    // an otherwise valid month swipe.
    function commitSwipe(endX) {
      if (state.isSwipingMonth) return;
      const deltaX = (typeof endX === 'number' ? endX : lastMoveX) - startX;
      const absDelta = Math.abs(deltaX);
      const absVelocity = Math.abs(velocity);

      if (absDelta < triggerThreshold && absVelocity < flingVelocity) return;

      state.lastSwipeTime = Date.now();
      // Only the synthetic click of THIS gesture must be swallowed. A new tap
      // resets this guard in pointerdown, so the next real tap is never eaten.
      suppressClickUntil = Date.now() + 160;
      const direction = deltaX < 0 ? 1 : -1; // 1 = next month, -1 = prev month
      if (state.activeTab === 'trans') {
        navigateMonth(direction);
      } else if (state.activeTab === 'stats') {
        if (typeof window !== 'undefined' && typeof window.adjustStatsPeriod === 'function') {
          window.adjustStatsPeriod(direction, 0);
        }
      }
    }

    initStatsTransactionsModalSwipe();
  }

  /**
   * Month-swipe for the stats "Κινήσεις" modal (#stats-transactions-modal).
   * Overlays are promoted to <body>, so they live outside .app-content and never
   * reach the tab swipe handler. The modal body only scrolls vertically, so a
   * horizontal drag is unambiguously a period change: it moves the stats period
   * (exactly like swiping the stats screen) and the list re-renders in place.
   */
  function initStatsTransactionsModalSwipe() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('stats-transactions-modal');
    if (!modal || modal._hasMonthSwipeAttached) return;
    if (typeof modal.addEventListener !== 'function') return;
    var surface = (typeof modal.querySelector === 'function')
      ? (modal.querySelector('.modal-body') || modal)
      : modal;
    if (!surface || typeof surface.addEventListener !== 'function') return;
    modal._hasMonthSwipeAttached = true;

    var SWIPE_THRESHOLD = 18; // px of horizontal travel that commits
    var FLING_VELOCITY = 0.25; // px/ms quick flick
    var DOMINANCE = 1.05; // |dx| must clearly beat |dy|

    var startX = 0;
    var startY = 0;
    var lastX = 0;
    var lastTime = 0;
    var velocity = 0;
    var pointerId = null;
    var tracking = false;
    var horizontal = null;
    var suppressClickUntil = 0;
    var dragGuardTimer = null;

    // Same guard as the tab pager: swiping the list for a period change must not
    // flash the row's press state. On release any leftover highlight is stripped
    // by hand, because the row's own touchend can be swallowed once the drag owns
    // the gesture.
    function setDragVisuals(active) {
      clearTimeout(dragGuardTimer);
      var body = (typeof document !== 'undefined') ? document.body : null;
      if (!body || !body.classList) return;
      if (active) {
        body.classList.add('month-swipe-dragging');
        var appState = getState();
        if (appState) appState.isSwipingMonth = true;
        var pressedRows = (typeof modal.querySelectorAll === 'function')
          ? modal.querySelectorAll('.transaction-item.pressed, .transaction-item.is-pressed')
          : null;
        if (pressedRows && pressedRows.length) {
          for (var i = 0; i < pressedRows.length; i++) {
            var pr = pressedRows[i];
            if (!pr || !pr.classList) continue;
            pr.classList.remove('pressed');
            pr.classList.remove('is-pressed');
          }
        }
        dragGuardTimer = setTimeout(function () { setDragVisuals(false); }, 1500);
        return;
      }
      body.classList.remove('month-swipe-dragging');
      var appState = getState();
      if (appState) {
        setTimeout(function () { appState.isSwipingMonth = false; }, 100);
      }
      var pressedRows = (typeof modal.querySelectorAll === 'function')
        ? modal.querySelectorAll('.transaction-item.pressed, .transaction-item.is-pressed')
        : null;
      if (!pressedRows || !pressedRows.length) return;
      for (var i = 0; i < pressedRows.length; i++) {
        var pressedRow = pressedRows[i];
        if (!pressedRow || !pressedRow.classList) continue;
        pressedRow.classList.remove('pressed');
        pressedRow.classList.remove('is-pressed');
      }
    }

    // A period swipe must not leave a ghost tap on the transaction underneath.
    modal.addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        e.stopPropagation();
        if (e.cancelable && e.preventDefault) e.preventDefault();
      }
    }, true);

    surface.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      // A fresh touch is a fresh intent: never swallow its tap.
      suppressClickUntil = 0;
      startX = lastX = e.clientX;
      startY = e.clientY;
      lastTime = Date.now();
      velocity = 0;
      tracking = true;
      horizontal = null;
      pointerId = e.pointerId;
    }, { passive: true });

    surface.addEventListener('pointermove', function (e) {
      if (!tracking || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;

      if (horizontal === null) {
        // Snappy horizontal detection: 4px threshold
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        horizontal = Math.abs(dx) > Math.abs(dy) * DOMINANCE;
        if (!horizontal) {
          // Vertical scroll: hand the gesture back to the native scroller.
          tracking = false;
          pointerId = null;
          return;
        }
        setDragVisuals(true);
      }

      var now = Date.now();
      if (now > lastTime) velocity = (e.clientX - lastX) / (now - lastTime);
      lastX = e.clientX;
      lastTime = now;
    }, { passive: true });

    surface.addEventListener('pointerup', function (e) {
      if (!tracking || e.pointerId !== pointerId) return;
      tracking = false;
      pointerId = null;
      if (horizontal !== true) return;
      setDragVisuals(false);

      var dx = e.clientX - startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(velocity) < FLING_VELOCITY) return;

      suppressClickUntil = Date.now() + 120;
      swipeStatsTransactionsModal(dx < 0 ? 1 : -1);
    }, { passive: true });

    surface.addEventListener('pointercancel', function () {
      tracking = false;
      pointerId = null;
      horizontal = null;
      setDragVisuals(false);
    }, { passive: true });
  }

  /**
   * Move the stats period forward/backward from inside the "Κινήσεις" modal.
   * adjustStatsPeriod re-renders the stats tab, which also refreshes the open
   * modal list (renderStatsTab → renderSubcategoryTransactions).
   */
  function swipeStatsTransactionsModal(direction) {
    var appState = getState();
    if (!appState.activeSubcategoryTransactions) return;
    if (typeof window !== 'undefined' && typeof window.adjustStatsPeriod === 'function') {
      window.adjustStatsPeriod(direction, 0);
    }
  }

  // Lightweight render for swipe navigation — only updates list + header, skips dropdowns/currency/etc.
  function renderTransactionsForSwipe() {
    if (typeof window !== 'undefined') {
      if (typeof window.processRecurringTemplates === 'function') {
        window.processRecurringTemplates();
      }
      if (typeof window.updateHeaderAndSync === 'function') {
        window.updateHeaderAndSync();
      }
      if (typeof window.renderTransactionsTab === 'function') {
        window.renderTransactionsTab();
      }
      window.lastRenderedCategoryType = null;
    }
  }

  // High-performance ultra-snappy GPU transition for month navigation (used by both swipe gestures & chevron buttons)
  function animateSwipeTransition(direction, callback) {
    const state = getState();
    const listEl = typeof document !== 'undefined'
      ? (state.activeTab === 'trans'
        ? document.getElementById('transactions-list')
        : state.activeTab === 'stats'
          ? document.getElementById('stats-breakdown-list')
          : null)
      : null;

    state.isSwipingMonth = true;
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.add('is-swiping-month');
    }

    const cleanup = () => {
      state.isSwipingMonth = false;
      state.touchDidMove = false;
      state.lastSwipeTime = Date.now();
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.remove('is-swiping-month');
      }
    };

    // Safety watchdog: ensure swipe lock is always cleared within 300ms even if an error occurs
    const watchdogTimer = setTimeout(cleanup, 300);

    // Immediately execute the state change & render (0ms pre-delay)
    try {
      if (typeof callback === 'function') {
        callback();
      }
    } catch (err) {
      console.error('[animateSwipeTransition] callback failed:', err);
      clearTimeout(watchdogTimer);
      cleanup();
      return;
    }

    const currentListEl = typeof document !== 'undefined'
      ? (state.activeTab === 'trans'
        ? document.getElementById('transactions-list')
        : document.getElementById('stats-breakdown-list'))
      : null;

    if (!currentListEl || !currentListEl.style) {
      clearTimeout(watchdogTimer);
      cleanup();
      return;
    }

    // Crisp micro-offset on the incoming side
    const inX = direction > 0 ? 36 : -36;

    currentListEl.style.transition = 'none';
    currentListEl.style.transform = 'translateX(' + inX + 'px)';

    const rAF = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 16);

    // Instant snap into place (60ms GPU transition)
    rAF(() => {
      currentListEl.style.transition = 'transform 65ms cubic-bezier(0.1, 0.9, 0.2, 1)';
      currentListEl.style.transform = 'translateX(0)';

      setTimeout(() => {
        clearTimeout(watchdogTimer);
        currentListEl.style.transition = '';
        currentListEl.style.transform = '';

        cleanup();

        if (state.activeTab === 'stats' && typeof window !== 'undefined' && typeof window.renderStatsTab === 'function') {
          window.renderStatsTab(false);
        }
      }, 70);
    });
  }

  // Navigate to an adjacent month (used by the period-prev/next chevron buttons).
  function navigateMonth(direction, startingDeltaX = 0) {
    const state = getState();
    animateSwipeTransition(direction, () => {
      state.selectedMonth += direction;
      if (state.selectedMonth < 0) {
        state.selectedMonth = 11;
        state.selectedYear--;
      } else if (state.selectedMonth > 11) {
        state.selectedMonth = 0;
        state.selectedYear++;
      }
      if (typeof window !== 'undefined') {
        if (typeof window.syncStatsDate === 'function') {
          window.syncStatsDate();
        }
        renderTransactionsForSwipe();
        if (typeof window.scrollToToday === 'function') {
          setTimeout(() => window.scrollToToday('auto'), 50);
        }
      }
    });
  }

  function initRippleEffects() {
    // Pure hardware-accelerated CSS-driven tap feedback for 0ms lag and smooth 60/120 FPS
  }

  return {
    initTabSwipeNavigation,
    initStatsTransactionsModalSwipe,
    renderTransactionsForSwipe,
    animateSwipeTransition,
    navigateMonth,
    initRippleEffects
  };
}));
