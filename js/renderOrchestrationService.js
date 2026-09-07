/**
 * renderOrchestrationService.js - Central UI Render Scheduler & Anti-Flicker Transitions
 * Coalesces rapid UI update calls into a single animation-frame render pass,
 * provides reference-counted CSS transition suppression to eliminate flicker on resume,
 * and coordinates active tab rendering, scroll preservation, and sync headers.
 *
 * Extracted in Phase 30A Architectural Modularization
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RenderOrchestrationService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let _updateUITimer = null;
  let _updateUIRAF = null;
  let _updateUIDirty = false;
  let _noTransitionCount = 0;

  function getState() {
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof state !== 'undefined') return state;
    return { activeTab: 'trans', selectedMonth: 0, selectedYear: 2026 };
  }

  function pushNoTransition() {
    _noTransitionCount++;
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.add('no-transition');
    }
  }

  function popNoTransition() {
    _noTransitionCount = Math.max(0, _noTransitionCount - 1);
    if (_noTransitionCount === 0) {
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.classList) {
        document.documentElement.classList.remove('no-transition');
      }
    }
  }

  function _isWithinResumeWindow(ms) {
    const t = (typeof window !== 'undefined' && window._lastResumeTimestamp) || 0;
    return t > 0 && (Date.now() - t) < ms;
  }

  function _runScheduledRender() {
    _updateUITimer = null;
    _updateUIRAF = null;
    _updateUIDirty = false;

    const suppress = !!(typeof window !== 'undefined' && window._suppressTransitions);
    if (suppress) pushNoTransition();
    try {
      _updateUIImpl();
    } finally {
      if (suppress) {
        setTimeout(() => {
          popNoTransition();
        }, 1000);
      }
    }
  }

  function updateUI() {
    if (_updateUITimer || _updateUIRAF) {
      _updateUIDirty = true;
      return;
    }
    _updateUIDirty = true;

    if (_updateUIRAF && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(_updateUIRAF);
    }
    if (typeof requestAnimationFrame === 'function') {
      _updateUIRAF = requestAnimationFrame(_runScheduledRender);
    } else {
      _runScheduledRender();
    }
  }

  function flushUI() {
    if (_updateUITimer) {
      clearTimeout(_updateUITimer);
      _updateUITimer = null;
    }
    if (_updateUIRAF && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(_updateUIRAF);
      _updateUIRAF = null;
    }
    _updateUIDirty = false;
    _runScheduledRender();
  }

  function getActiveScrollContainer() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null;
    const appState = getState();
    if (appState.activeTab === 'trans') return document.querySelector('.trans-scroll-content');
    if (appState.activeTab === 'stats') return document.querySelector('.stats-scroll-content');
    if (appState.activeTab === 'accounts') return document.querySelector('.accounts-scroll-content');
    if (appState.activeTab === 'more') return document.querySelector('.more-scroll-content');
    return null;
  }

  function _isAuthenticated() {
    const appState = getState();
    const isAuthConfirmed = (typeof window !== 'undefined' && !!window._authConfirmed);
    const guestMode = !!appState.guestMode;
    const storageGuest = (typeof localStorage !== 'undefined' && localStorage.getItem('auth_guest_mode') === 'true');
    return isAuthConfirmed || guestMode || storageGuest;
  }

  function _updateUIImpl() {
    updateHeaderAndSync();
    if (typeof updateHeaderDemoBadge === 'function') {
      updateHeaderDemoBadge();
    } else if (typeof window !== 'undefined' && typeof window.updateHeaderDemoBadge === 'function') {
      window.updateHeaderDemoBadge();
    }

    if (!_isAuthenticated()) {
      return;
    }

    const appState = getState();

    if (typeof processRecurringTemplates === 'function') {
      processRecurringTemplates();
    } else if (typeof window !== 'undefined' && typeof window.processRecurringTemplates === 'function') {
      window.processRecurringTemplates();
    }

    if (typeof cleanCrossLanguageRecurringDuplicates === 'function') {
      cleanCrossLanguageRecurringDuplicates();
    } else if (typeof window !== 'undefined' && typeof window.cleanCrossLanguageRecurringDuplicates === 'function') {
      window.cleanCrossLanguageRecurringDuplicates();
    }

    if (typeof document !== 'undefined') {
      const countEl = document.getElementById('recurring-templates-count-val');
      if (countEl) {
        countEl.textContent = appState.recurringTemplates ? appState.recurringTemplates.length : 0;
      }
      const trashCount = appState.trashTransactions ? appState.trashTransactions.length : 0;
      const hubTrashCountEl = document.getElementById('hub-trash-count');
      if (hubTrashCountEl) {
        hubTrashCountEl.textContent = trashCount;
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('selected_month', appState.selectedMonth);
        localStorage.setItem('selected_year', appState.selectedYear);
      }

      const anyModalOpen = !!(typeof document.querySelector === 'function' && document.querySelector(
        '.modal-overlay.active, .tx-modal-overlay.active, .profile-sheet-overlay.active'
      ));

      if (!anyModalOpen) {
        const scrollContainer = getActiveScrollContainer();
        const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

        if (appState.activeTab === 'trans') {
          if (typeof renderTransactionsTab === 'function') renderTransactionsTab();
          else if (typeof window !== 'undefined' && typeof window.renderTransactionsTab === 'function') window.renderTransactionsTab();
        } else if (appState.activeTab === 'stats') {
          if (typeof renderStatsTab === 'function') renderStatsTab();
          else if (typeof window !== 'undefined' && typeof window.renderStatsTab === 'function') window.renderStatsTab();
        } else if (appState.activeTab === 'accounts') {
          if (typeof renderAccountsTab === 'function') renderAccountsTab();
          else if (typeof window !== 'undefined' && typeof window.renderAccountsTab === 'function') window.renderAccountsTab();
        } else if (appState.activeTab === 'more') {
          if (typeof renderPartnerSection === 'function') renderPartnerSection();
          else if (typeof window !== 'undefined' && typeof window.renderPartnerSection === 'function') window.renderPartnerSection();
          if (typeof renderNotesList === 'function') renderNotesList();
          else if (typeof window !== 'undefined' && typeof window.renderNotesList === 'function') window.renderNotesList();
          if (typeof updateOfflineImportSettingsRow === 'function') updateOfflineImportSettingsRow();
          else if (typeof window !== 'undefined' && typeof window.updateOfflineImportSettingsRow === 'function') window.updateOfflineImportSettingsRow();
        }

        const restoredScrollContainer = getActiveScrollContainer();
        if (restoredScrollContainer && typeof localStorage !== 'undefined') {
          const bgScrollTop = localStorage.getItem('bg_scroll_top');
          if (bgScrollTop !== null) {
            restoredScrollContainer.scrollTop = parseInt(bgScrollTop, 10);
            localStorage.removeItem('bg_scroll_top');
          } else {
            restoredScrollContainer.scrollTop = currentScrollTop;
          }
        }
      }

      if (typeof window !== 'undefined') {
        window.lastRenderedCategoryType = null;
      }

      const activeTypeBtn = typeof document.querySelector === 'function' ? document.querySelector('.type-tab-btn.active') : null;
      const currentType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'expense';

      const txModal = document.getElementById('transaction-modal');
      const txModalOpen = txModal && txModal.classList && txModal.classList.contains('active');
      if (!txModalOpen) {
        if (typeof updateCategoryDropdowns === 'function') updateCategoryDropdowns(currentType);
        else if (typeof window !== 'undefined' && typeof window.updateCategoryDropdowns === 'function') window.updateCategoryDropdowns(currentType);
        if (typeof updateAccountDropdowns === 'function') updateAccountDropdowns();
        else if (typeof window !== 'undefined' && typeof window.updateAccountDropdowns === 'function') window.updateAccountDropdowns();
      }

      if (typeof updateCurrencySymbols === 'function') updateCurrencySymbols();
      else if (typeof window !== 'undefined' && typeof window.updateCurrencySymbols === 'function') window.updateCurrencySymbols();

      const list = document.getElementById('transactions-list');
      if (!appState.hasInitialScrollDone && list && list.children && list.children.length > 0) {
        appState.hasInitialScrollDone = true;
        setTimeout(() => {
          if (typeof scrollToToday === 'function') scrollToToday('auto');
          else if (typeof window !== 'undefined' && typeof window.scrollToToday === 'function') window.scrollToToday('auto');
        }, 300);
      }

      const authOverlay = document.getElementById('auth-overlay');
      const isAuthVisible = authOverlay && authOverlay.style && authOverlay.style.display !== 'none';
      if (!isAuthVisible && (!appState.transactions || appState.transactions.length === 0) && typeof localStorage !== 'undefined' && !localStorage.getItem('ba_ftux_status')) {
        setTimeout(() => {
          if (!localStorage.getItem('ba_ftux_status') && (!appState.transactions || appState.transactions.length === 0)) {
            if (typeof openQuickStartModal === 'function') openQuickStartModal(0);
            else if (typeof window !== 'undefined' && typeof window.openQuickStartModal === 'function') window.openQuickStartModal(0);
          }
        }, 800);
      }
    }

    if (typeof window !== 'undefined' && typeof window._notifyNativeContentPainted === 'function') {
      window._notifyNativeContentPainted();
    }
  }

  function updateHeaderAndSync() {
    const appState = getState();
    const getMoName = (typeof getMonthName === 'function')
      ? getMonthName
      : (typeof window !== 'undefined' && typeof window.getMonthName === 'function' ? window.getMonthName : (m) => String(m));

    const rawText = `${getMoName(appState.selectedMonth, true)} ${appState.selectedYear}`;

    if (typeof document !== 'undefined') {
      const periodEl = document.getElementById('current-period-title');
      if (periodEl) {
        const wrapFn = (typeof wrapPeriodTitleWithSpans === 'function')
          ? wrapPeriodTitleWithSpans
          : (typeof window !== 'undefined' && typeof window.wrapPeriodTitleWithSpans === 'function' ? window.wrapPeriodTitleWithSpans : (t) => t);
        periodEl.innerHTML = wrapFn(rawText);
      }
    }

    if (typeof updateHeaderProfileBadge === 'function') updateHeaderProfileBadge();
    else if (typeof window !== 'undefined' && typeof window.updateHeaderProfileBadge === 'function') window.updateHeaderProfileBadge();

    if (typeof updateSyncStatusIndicator === 'function') updateSyncStatusIndicator();
    else if (typeof window !== 'undefined' && typeof window.updateSyncStatusIndicator === 'function') window.updateSyncStatusIndicator();

    if (typeof window !== 'undefined' && typeof window.updateDesktopSidebarUser === 'function') {
      window.updateDesktopSidebarUser();
    }
  }

  // Attach to window for global runtime access
  if (typeof window !== 'undefined') {
    window.pushNoTransition = pushNoTransition;
    window.popNoTransition = popNoTransition;
    window._isWithinResumeWindow = _isWithinResumeWindow;
    window._runScheduledRender = _runScheduledRender;
    window.updateUI = updateUI;
    window.flushUI = flushUI;
    window.getActiveScrollContainer = getActiveScrollContainer;
    window._isAuthenticated = _isAuthenticated;
    window._updateUIImpl = _updateUIImpl;
    window.updateHeaderAndSync = updateHeaderAndSync;
  }

  return {
    pushNoTransition,
    popNoTransition,
    _isWithinResumeWindow,
    _runScheduledRender,
    updateUI,
    flushUI,
    getActiveScrollContainer,
    _isAuthenticated,
    _updateUIImpl,
    updateHeaderAndSync,
    getNoTransitionCount: () => _noTransitionCount,
    isDirty: () => _updateUIDirty
  };
}));
