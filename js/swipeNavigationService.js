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

    const edgeThreshold = 40; // Avoid edge gesture conflicts with system back gesture
    const triggerThreshold = 18; // Instant 18px threshold
    const flingVelocity = 0.22; // Very responsive flick velocity

    appContent.addEventListener('touchstart', (e) => {
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
        return;
      }

      if (e.target && e.target.closest && e.target.closest('.category-quick-filters, .quick-filter-chips, .filters-panel-header, #statsChart, canvas, .stats-subcategories-container')) {
        touchActive = false;
        return;
      }

      const touch = (e.touches && e.touches[0]) ? e.touches[0] : { clientX: 0, clientY: 0 };
      startX = touch.clientX;
      startY = touch.clientY;
      lastMoveX = startX;
      lastMoveTime = Date.now();
      velocity = 0;
      startTime = lastMoveTime;

      const windowWidth = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 360;
      if (startX <= edgeThreshold || startX >= windowWidth - edgeThreshold) {
        touchActive = false;
        return;
      }

      touchActive = true;
      isSwipingHorizontal = null;
    }, { passive: true });

    appContent.addEventListener('touchmove', (e) => {
      if (!touchActive || state.isSwipingMonth) return;
      const touch = (e.touches && e.touches[0]) ? e.touches[0] : { clientX: 0, clientY: 0 };
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (isSwipingHorizontal === null) {
        if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
          if (Math.abs(deltaX) > Math.abs(deltaY) * 0.7) {
            if (state.activeTab === 'trans' || state.activeTab === 'stats') {
              isSwipingHorizontal = true;
              state.touchDidMove = true;
            } else {
              isSwipingHorizontal = false;
              touchActive = false;
            }
          } else {
            isSwipingHorizontal = false;
          }
        }
      }

      if (isSwipingHorizontal === true) {
        if (e.cancelable && e.preventDefault) e.preventDefault();
        const now = Date.now();
        const dt = now - lastMoveTime;
        if (dt > 0) {
          velocity = (touch.clientX - lastMoveX) / dt;
        }
        lastMoveX = touch.clientX;
        lastMoveTime = now;
      }
    }, { passive: false });

    appContent.addEventListener('touchend', (e) => {
      if (!touchActive) return;
      touchActive = false;

      if (isSwipingHorizontal === true && !state.isSwipingMonth) {
        if (e.cancelable && e.preventDefault) e.preventDefault();
        state.lastSwipeTime = Date.now();
        const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || { clientX: 0, clientY: 0 };
        const deltaX = touch.clientX - startX;
        const absDelta = Math.abs(deltaX);
        const absVelocity = Math.abs(velocity);

        const shouldTrigger = absDelta >= triggerThreshold || absVelocity >= flingVelocity;

        if (shouldTrigger) {
          const direction = deltaX < 0 ? 1 : -1; // 1 = next month, -1 = prev month
          if (state.activeTab === 'trans') {
            navigateMonth(direction);
          } else if (state.activeTab === 'stats') {
            if (typeof window !== 'undefined' && typeof window.adjustStatsPeriod === 'function') {
              window.adjustStatsPeriod(direction, 0);
            }
          }
        }
      }

      isSwipingHorizontal = null;
      setTimeout(() => { state.touchDidMove = false; }, 200);
    }, { passive: false });

    appContent.addEventListener('touchcancel', () => {
      touchActive = false;
      isSwipingHorizontal = null;
      setTimeout(() => { state.touchDidMove = false; }, 100);
    }, { passive: true });
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
    currentListEl.style.opacity = '0.75';

    const rAF = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : (cb) => setTimeout(cb, 16);

    // Instant snap into place (60ms GPU transition)
    rAF(() => {
      currentListEl.style.transition = 'transform 65ms cubic-bezier(0.1, 0.9, 0.2, 1), opacity 65ms ease';
      currentListEl.style.transform = 'translateX(0)';
      currentListEl.style.opacity = '1';

      setTimeout(() => {
        clearTimeout(watchdogTimer);
        currentListEl.style.transition = '';
        currentListEl.style.transform = '';
        currentListEl.style.opacity = '';

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
    renderTransactionsForSwipe,
    animateSwipeTransition,
    navigateMonth,
    initRippleEffects
  };
}));
