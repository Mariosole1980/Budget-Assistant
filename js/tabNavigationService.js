/**
 * Tab Navigation & Screen Transition Subsystem
 * Extracted from app.js (Phase 24B Architectural Modularization)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TabNavigationService = factory();
    // Expose on root/window for seamless global accessibility
    root.resetAllTabScreenStyles = root.TabNavigationService.resetAllTabScreenStyles;
    root.switchTab = root.TabNavigationService.switchTab;
    root.toggleStatsType = root.TabNavigationService.toggleStatsType;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    if (typeof state !== 'undefined') return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof global !== 'undefined' && global.state) return global.state;
    return {};
  }

  function callSafe(fnName, ...args) {
    if (typeof window !== 'undefined' && typeof window[fnName] === 'function') {
      return window[fnName](...args);
    }
    if (typeof global !== 'undefined' && typeof global[fnName] === 'function') {
      return global[fnName](...args);
    }
    return null;
  }

  function resetAllTabScreenStyles() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('.tab-screen').forEach(screen => {
      screen.style.position = '';
      screen.style.top = '';
      screen.style.left = '';
      screen.style.width = '';
      screen.style.zIndex = '';
      screen.style.transform = '';
      screen.style.opacity = '';
      screen.style.transition = '';
      screen.style.willChange = '';
      screen.style.display = '';
      screen.style.visibility = '';
    });
    // Clear any leftover inline transforms/opacities on month titles and transaction lists
    ['current-period-title', 'stats-period-title', 'transactions-list', 'stats-breakdown-list'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      }
    });
  }

  function switchTab(tab, instant = false) {
    const appState = getState();
    resetAllTabScreenStyles();
    callSafe('ensureHistoryPushed');

    // Allow re-tapping 'trans' or 'stats' tab to reset month even if already active
    if (appState.activeTab === tab) {
      if (tab === 'trans') {
        const today = new Date();
        appState.selectedMonth = today.getMonth();
        appState.selectedYear = today.getFullYear();
        callSafe('syncStatsDate');
        callSafe('updateUI');
        setTimeout(() => callSafe('scrollToToday', 'smooth'), 50);
      } else if (tab === 'stats') {
        const today = new Date();
        const isAlreadyCurrent = (appState.selectedMonth === today.getMonth() && appState.selectedYear === today.getFullYear());
        if (!isAlreadyCurrent) {
          appState.selectedMonth = today.getMonth();
          appState.selectedYear = today.getFullYear();
          appState.statsDate = new Date();
          appState.statsDate.setDate(15);
          if (appState.expandedStatsCategories && typeof appState.expandedStatsCategories.clear === 'function') {
            appState.expandedStatsCategories.clear();
          }
          callSafe('renderStatsTab');
        } else {
          if (typeof document !== 'undefined') {
            const scrollContainer = document.querySelector('.stats-scroll-content');
            if (scrollContainer && typeof scrollContainer.scrollTo === 'function') {
              scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        }
      } else if (tab === 'accounts') {
        // Re-tapping the Overview tab returns to the current year.
        const currentYear = new Date().getFullYear();
        if ((appState.overviewYear || currentYear) !== currentYear) {
          appState.overviewYear = currentYear;
          callSafe('renderAccountsTab');
        }
        if (typeof document !== 'undefined') {
          const accountsScroll = document.querySelector('.accounts-scroll-content');
          if (accountsScroll && typeof accountsScroll.scrollTo === 'function') {
            accountsScroll.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }
      return;
    }

    const prevTabName = appState.activeTab;
    appState.activeTab = tab;
    try {
      if (typeof history !== 'undefined' && history.pushState && typeof window !== 'undefined') {
        history.pushState({ appState: 'active', tab: tab }, '', window.location.pathname + window.location.search);
        appState.historyPushed = true;
      }
    } catch (e) { }

    // Clear expanded categories on active tab change
    if (appState.expandedStatsCategories && typeof appState.expandedStatsCategories.clear === 'function') {
      appState.expandedStatsCategories.clear();
    }

    if (tab === 'stats') {
      appState.statsSubtab = 'breakdown';
      callSafe('switchStatsSubtab', 'breakdown');
    }

    // Cancel any pending deferred UI rendering for a previous tab switch
    if (appState.tabRenderTimeoutId) {
      clearTimeout(appState.tabRenderTimeoutId);
      appState.tabRenderTimeoutId = null;
    }

    // If there is an active transition in progress, force-complete it immediately to prevent race conditions & jitter
    if (typeof appState.activeTransitionCleanup === 'function') {
      try {
        if (appState.activeTransitionTimeoutId) {
          clearTimeout(appState.activeTransitionTimeoutId);
          appState.activeTransitionTimeoutId = null;
        }
        if (appState.activeTransitionAnimEndTarget && appState.activeTransitionAnimEndListener) {
          appState.activeTransitionAnimEndTarget.removeEventListener('animationend', appState.activeTransitionAnimEndListener);
        }
        appState.activeTransitionCleanup();
      } catch (err) {
        console.error("Error cleaning up active tab transition:", err);
      }
      appState.activeTransitionCleanup = null;
      appState.activeTransitionAnimEndTarget = null;
      appState.activeTransitionAnimEndListener = null;
    }

    if (appState.selectionMode) {
      appState.selectionMode = false;
      if (appState.selectedIds && typeof appState.selectedIds.clear === 'function') {
        appState.selectedIds.clear();
      }
      if (typeof document !== 'undefined') {
        const bar = document.getElementById('selection-bar');
        if (bar) bar.classList.remove('active');
        const fab = document.getElementById('fab-btn');
        if (fab) fab.classList.remove('hidden');
      }
      callSafe('updateNoteShortcutVisibility');
    }

    if (typeof document !== 'undefined') {
      // Fail-safe: Hide back-swipe indicator on tab switch
      const bsInd = document.getElementById('back-swipe-indicator');
      if (bsInd) bsInd.style.display = 'none';
    }

    const oldTab = prevTabName;
    appState.activeTab = tab;
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        localStorage.setItem('active_tab', tab);
      }
    } catch (_) { }

    if (typeof document !== 'undefined') {
      // Toggle body class for scroll isolation on mobile
      document.body.classList.toggle('trans-tab-active', tab === 'trans');
      document.body.classList.toggle('stats-tab-active', tab === 'stats');
      document.body.classList.toggle('accounts-tab-active', tab === 'accounts');
      document.body.classList.toggle('more-tab-active', tab === 'more');

      const oldScreen = document.getElementById(oldTab + '-screen');
      const newScreen = document.getElementById(tab + '-screen');

      // Manage FAB visibility based on active tab
      const fab = document.getElementById('fab-btn');
      if (fab) {
        if (tab === 'trans') {
          fab.style.display = 'flex';
        } else {
          fab.style.display = 'none';
        }
      }
      callSafe('updateNoteShortcutVisibility');

      if (oldScreen && newScreen) {
        // Hide old screen instantly, remove fade-in class from all screens
        document.querySelectorAll('.tab-screen').forEach(s => {
          s.classList.remove('fade-in-premium');
          if (s.id !== (tab + '-screen')) {
            s.classList.remove('active');
            s.style.display = 'none';
            s.style.visibility = 'hidden';
            s.style.opacity = '0';
          }
        });

        if (instant) {
          newScreen.style.display = '';
          newScreen.style.visibility = '';
          newScreen.style.opacity = '';
          newScreen.classList.add('active');
        } else {
          // Display and trigger animation on new screen
          newScreen.style.display = '';
          newScreen.style.visibility = '';
          newScreen.style.opacity = '';
          newScreen.classList.add('active', 'fade-in-premium');

          const cleanupHandler = () => {
            newScreen.classList.remove('fade-in-premium');
            appState.activeTransitionCleanup = null;
            appState.activeTransitionAnimEndTarget = null;
            appState.activeTransitionAnimEndListener = null;
            appState.activeTransitionTimeoutId = null;
          };

          appState.activeTransitionCleanup = cleanupHandler;
          appState.activeTransitionAnimEndTarget = newScreen;

          const onAnimEnd = (e) => {
            if (e.target === newScreen) {
              newScreen.removeEventListener('animationend', onAnimEnd);
              cleanupHandler();
            }
          };
          appState.activeTransitionAnimEndListener = onAnimEnd;
          newScreen.addEventListener('animationend', onAnimEnd);

          appState.activeTransitionTimeoutId = setTimeout(() => {
            newScreen.removeEventListener('animationend', onAnimEnd);
            cleanupHandler();
          }, 200);
        }
      } else {
        document.querySelectorAll('.tab-screen').forEach(s => s.classList.toggle('active', s.id === (tab + '-screen')));
      }

      document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tab));
    }

    if (tab !== 'trans') {
      callSafe('ensureHistoryPushed');
    }

    if (tab === 'trans') {
      const today = new Date();
      appState.selectedMonth = today.getMonth();
      appState.selectedYear = today.getFullYear();
      callSafe('syncStatsDate');
      callSafe('flushUI');
      setTimeout(() => callSafe('scrollToToday', 'smooth'), 50);
    } else {
      callSafe('flushUI');
    }

    if (tab === 'more') {
      callSafe('updateHeaderProfileBadge');
      if (appState.currentUser && typeof document !== 'undefined') {
        const emailDisplay = document.getElementById('settings-user-email-value');
        if (emailDisplay) {
          emailDisplay.textContent = appState.currentUser.email;
          emailDisplay.title = appState.currentUser.email;
        }
      }
      callSafe('renderNotesList');
    }
  }

  function toggleStatsType(type) {
    const appState = getState();
    if (appState.expandedStatsCategories && typeof appState.expandedStatsCategories.clear === 'function') {
      appState.expandedStatsCategories.clear();
    }
    appState.statsType = type;
    if (typeof document !== 'undefined') {
      const expEl = document.getElementById('stats-tab-expense');
      if (expEl) expEl.classList.toggle('active', type === 'expense');
      const incEl = document.getElementById('stats-tab-income');
      if (incEl) incEl.classList.toggle('active', type === 'income');
    }
    callSafe('renderStatsTab');
  }

  return {
    resetAllTabScreenStyles: resetAllTabScreenStyles,
    switchTab: switchTab,
    toggleStatsType: toggleStatsType
  };
}));
