(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SettingsSubscreenManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _hexToRgb(hex) {
    if (typeof hexToRgb === 'function') return hexToRgb(hex);
    if (typeof window !== 'undefined' && typeof window.hexToRgb === 'function') return window.hexToRgb(hex);
    hex = (hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255);
  }

function openSettingsSubscreen(screenId, titleKey, skipHistory = false) {
  if (!window._settingsSubscreenHistory) {
    window._settingsSubscreenHistory = [];
  }
  if (!skipHistory && window._currentSettingsSubscreenId && window._currentSettingsSubscreenId !== screenId) {
    window._settingsSubscreenHistory.push({
      id: window._currentSettingsSubscreenId,
      titleKey: window._currentSettingsSubscreenTitleKey
    });
  }
  window._currentSettingsSubscreenId = screenId;
  window._currentSettingsSubscreenTitleKey = titleKey;

  const titleEl = document.getElementById('settings-subscreen-title');
  if (titleEl) {
    titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][titleKey]) || titleKey;
  }

  // Per-screen header metadata (icon, accent color, subtitle key) so the
  // dynamic header band reflects the section being viewed instead of always
  // showing the App Preferences palette/color/subtitle.
  const subscreenMeta = {
    preferences: { icon: 'fa-sliders', color: '#2196f3', subtitleKey: 'settings_pref_desc' },
    notifications: { icon: 'fa-bell', color: '#ef4444', subtitleKey: 'settings_notif_desc' },
    sync: { icon: 'fa-cloud-arrow-up', color: '#10b981', subtitleKey: 'settings_data_desc' },
    security: { icon: 'fa-shield-halved', color: '#ef4444', subtitleKey: 'settings_security_desc' },
    family: { icon: 'fa-users', color: '#6366f1', subtitleKey: 'settings_family_desc' },
    legal: { icon: 'fa-circle-info', color: '#94a3b8', subtitleKey: 'settings_legal_desc' },
    feedback: { icon: 'fa-heart', color: '#f43f5e', subtitleKey: 'settings_feedback_desc' }
  };
  const meta = subscreenMeta[screenId] || subscreenMeta.preferences;

  const headerBand = document.getElementById('settings-subscreen-header-band');
  if (headerBand) {
    headerBand.style.background = `rgba(${_hexToRgb(meta.color)},0.08)`;
    headerBand.style.borderBottom = `1px solid rgba(${_hexToRgb(meta.color)},0.25)`;
  }

  const iconBox = document.getElementById('settings-subscreen-icon-box');
  if (iconBox) {
    iconBox.style.background = meta.color;
    iconBox.style.boxShadow = `0 4px 12px rgba(${_hexToRgb(meta.color)},0.35)`;
  }

  const iconEl = document.getElementById('settings-subscreen-icon');
  if (iconEl) {
    iconEl.className = 'fa-solid ' + meta.icon;
  }

  const subtitleEl = document.getElementById('settings-subscreen-subtitle');
  if (subtitleEl) {
    const subText = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang][meta.subtitleKey]) || meta.subtitleKey;
    subtitleEl.textContent = subText;
  }

  document.querySelectorAll('.subscreen-section').forEach(section => {
    section.classList.remove('active');
    section.style.display = 'none';
  });

  const targetSection = document.getElementById('subscreen-' + screenId);
  if (targetSection) {
    targetSection.classList.add('active');
    targetSection.style.display = 'flex';
  } else {
    console.error(`Subscreen section "subscreen-${screenId}" not found.`);
    return;
  }

  // Trigger optional custom lifecycle init hooks
  if (typeof updateSettingsDisplay === 'function') {
    updateSettingsDisplay();
  }
  const initHook = window['onSubscreenShow_' + screenId];
  if (typeof initHook === 'function') {
    try {
      initHook();
    } catch (err) {
      console.error(`Error in onSubscreenShow_${screenId}:`, err);
    }
  }

  openModal('settings-subscreen-modal');
}

window.openSettingsSubscreen = openSettingsSubscreen;

function openNotesManager() {
  openModal('notes-manager-modal');
  renderNotesList();
  if (typeof updateNotesTrashBadge === 'function') {
    updateNotesTrashBadge();
  }
}
window.openNotesManager = openNotesManager;

window.onSubscreenShow_family = function () {
  renderPartnerSection();
};

window.onSubscreenShow_security = function () {
  const secEmailEl = document.getElementById('security-current-email-text');
  if (secEmailEl) {
    if (state.currentUser && state.currentUser.email && state.currentUser.id !== 'offline-user') {
      secEmailEl.textContent = state.currentUser.email;
    } else {
      secEmailEl.textContent = state.lang === 'el' ? 'Διαχείριση διεύθυνσης email' : 'Manage email address';
    }
  }

  const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) appLockCheckbox.checked = appLockEnabled;

  if (typeof checkBiometricsSupport === 'function') {
    checkBiometricsSupport();
  }

  const hideAmountsEnabled = localStorage.getItem('settings_hide_amounts') === 'true';
  const hideAmountsCheckbox = document.getElementById('settings-hide-amounts');
  if (hideAmountsCheckbox) hideAmountsCheckbox.checked = hideAmountsEnabled;

  const isAndroid = typeof Capacitor !== 'undefined' && Capacitor.getPlatform && Capacitor.getPlatform() === 'android';
  const screenshotRow = document.getElementById('settings-screenshot-block-row');
  if (!isAndroid) {
    if (screenshotRow) screenshotRow.style.display = 'none';
  } else {
    if (screenshotRow) screenshotRow.style.display = 'flex';
    const screenshotBlockEnabled = localStorage.getItem('settings_screenshot_block') === 'true';
    const screenshotBlockCheckbox = document.getElementById('settings-screenshot-block');
    if (screenshotBlockCheckbox) screenshotBlockCheckbox.checked = screenshotBlockEnabled;

    if (typeof applyNativeSecureMode === 'function') {
      applyNativeSecureMode(screenshotBlockEnabled);
    }
  }

  // NOTE: The auto-lock delay is configured through the settings picker and its
  // current value is rendered by updateSettingsDisplay() into the
  // settings-auto-lock-display span — there is no settings-auto-lock-delay
  // select element anymore, so no select binding is needed here.
};

// ============================================================
// NOTIFICATIONS ENGINE & HISTORY HUB
// Extracted to js/notificationHub.js (Phase 8B Architectural Domain Extraction)
// ============================================================

window.onSubscreenShow_preferences = function () {
  const appLockEnabled = localStorage.getItem('app_lock_enabled') === 'true';
  const appLockCheckbox = document.getElementById('settings-app-lock');
  if (appLockCheckbox) appLockCheckbox.checked = appLockEnabled;

  const autocompleteEnabled = localStorage.getItem('settings_autocomplete_enabled') !== 'false';
  const autocompleteCheckbox = document.getElementById('settings-autocomplete');
  if (autocompleteCheckbox) autocompleteCheckbox.checked = autocompleteEnabled;

  const noteShortcutEnabled = localStorage.getItem('settings_note_shortcut_enabled') === 'true';
  const noteShortcutCheckbox = document.getElementById('settings-note-shortcut');
  if (noteShortcutCheckbox) noteShortcutCheckbox.checked = noteShortcutEnabled;

  const quickAddEnabled = localStorage.getItem('quick_add_notification_enabled') === 'true';
  const quickAddCheckbox = document.getElementById('settings-quick-add-notification');
  if (quickAddCheckbox) quickAddCheckbox.checked = quickAddEnabled;

  const hapticCheckbox = document.getElementById('setting-haptic-toggle');
  if (hapticCheckbox) {
    const hs = (typeof HapticFeedbackService !== 'undefined') ? HapticFeedbackService : (typeof window !== 'undefined' ? window.HapticFeedbackService : null);
    hapticCheckbox.checked = hs ? hs.isEnabled() : (localStorage.getItem('haptic_feedback_enabled') !== 'false');
  }

  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) themeSelect.value = savedTheme;

  const savedCurrency = localStorage.getItem('app_currency') || 'EUR';
  const currencySelect = document.getElementById('settings-currency');
  if (currencySelect) currencySelect.value = savedCurrency;

  const weekStart = localStorage.getItem('settings_week_start') || '1';
  const weekStartSelect = document.getElementById('settings-week-start');
  if (weekStartSelect) weekStartSelect.value = weekStart;

  const dailyReminderEnabled = localStorage.getItem('settings_daily_reminder_enabled') === 'true';
  const dailyReminderCheckbox = document.getElementById('settings-daily-reminder');
  if (dailyReminderCheckbox) dailyReminderCheckbox.checked = dailyReminderEnabled;

  const dailyReminderTimeRow = document.getElementById('settings-daily-reminder-time-row');
  if (dailyReminderTimeRow) dailyReminderTimeRow.style.display = dailyReminderEnabled ? 'flex' : 'none';

  const recurringAlertsEnabled = localStorage.getItem('settings_recurring_alerts_enabled') !== 'false';
  const recurringAlertsCheckbox = document.getElementById('settings-recurring-alerts');
  if (recurringAlertsCheckbox) recurringAlertsCheckbox.checked = recurringAlertsEnabled;

  const langVal = document.getElementById('lang-setting-val');
  if (langVal) langVal.textContent = state.lang === 'en' ? '🇬🇧 English' : '🇬🇷 Ελληνικά';
};

// Lifecycle hooks for the subscreens that were missing one. The feedback form
// must start clean on every open — otherwise the rating/label/comment from a
// previous visit stay visible between openings.
window.onSubscreenShow_feedback = function () {
  if (typeof resetFeedbackForm === 'function') {
    resetFeedbackForm();
  }
};

window.onSubscreenShow_legal = function () {
  // Account & Legal has no stateful form of its own, but the Feedback & Rating
  // subscreen is reached from here, so keep its form clean as well.
  if (typeof resetFeedbackForm === 'function') {
    resetFeedbackForm();
  }
};

function changeOverviewYear(dir) {
  state.overviewYear = (state.overviewYear || new Date().getFullYear()) + dir;
  renderAccountsTab();
}

function saveCustomSavingsTarget() {
  const inputEl = document.getElementById('forecast-target-input');
  if (inputEl) {
    const val = parseFloat(inputEl.value);
    if (!isNaN(val) && val >= 0) {
      localStorage.setItem('overview_savings_target', val.toString());
      closeModal('forecast-details-modal');
      renderAccountsTab();
    }
  }
}

function openSavingsRunwayModal() {
  if (typeof openModal === 'function') {
    openModal('forecast-details-modal');
  }
}

window.openSavingsRunwayModal = openSavingsRunwayModal;
window.saveCustomSavingsTarget = saveCustomSavingsTarget;
window.changeOverviewYear = changeOverviewYear;

// ============================================================
// MODERN CLOCK & TIME PICKER CONTROLLER
// Extracted to js/timePicker.js (Phase 4 Architectural Domain Extraction)
// ============================================================


// FEATURE: TEXTAREA AUTO-GROW FOR DESCRIPTION/DETAILS
function initDescriptionAutoGrow() {
  const descInput = document.getElementById('trans-description');
  if (!descInput || descInput.tagName !== 'TEXTAREA') return;

  if (descInput.dataset.autogrowBound === 'true') {
    return;
  }
  descInput.dataset.autogrowBound = 'true';

  const updateHeight = () => {
    descInput.style.height = '24px';
    const newHeight = Math.max(24, descInput.scrollHeight);
    descInput.style.height = newHeight + 'px';
  };

  descInput.addEventListener('input', updateHeight);
  descInput.addEventListener('focus', updateHeight);

  window.updateDescriptionHeight = updateHeight;
}

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      initDescriptionAutoGrow();
      if (typeof initNoteAutocomplete === 'function') initNoteAutocomplete();
      else if (typeof window !== 'undefined' && typeof window.initNoteAutocomplete === 'function') window.initNoteAutocomplete();
    });
    if (document.readyState !== 'loading') {
      if (typeof initNoteAutocomplete === 'function') initNoteAutocomplete();
      else if (typeof window !== 'undefined' && typeof window.initNoteAutocomplete === 'function') window.initNoteAutocomplete();
    }
  }

window.initDescriptionAutoGrow = initDescriptionAutoGrow;

// ============================================================
// USER FEEDBACK SUBMISSION LOGIC
// Extracted to js/feedbackReviewService.js (Phase 13B Architectural Extraction)

function initSettingsSubscreenAndFhs() {
  // ── Robust collapsible helper ──────────────────────────────────────────
  // Uses explicit scrollHeight so the content is NEVER clipped regardless
  // of how tall the inner HTML grows (dynamic family / feedback content).
  function toggleCollapsible(content, icon) {
    if (!content || !icon) return;
    const isOpen = content.classList.contains('active');
    if (isOpen) {
      // Animate close: pin current height first, then transition to 0
      content.style.maxHeight = content.scrollHeight + 'px';
      // Force reflow so the browser registers the start value
      void content.offsetHeight;
      content.style.maxHeight = '0px';
      content.classList.remove('active');
      icon.classList.remove('active');
    } else {
      // Animate open: CSS class sets display; measure then expand
      content.classList.add('active');
      icon.classList.add('active');
      // Measure real height (CSS max-height:3000px is the ceiling)
      const targetH = content.scrollHeight;
      content.style.maxHeight = '0px';
      void content.offsetHeight; // force reflow
      content.style.maxHeight = targetH + 'px';
      // Once the transition ends, let height be 'auto' so dynamic
      // content (re-renders) never clips
      content.addEventListener('transitionend', function onEnd() {
        content.removeEventListener('transitionend', onEnd);
        if (content.classList.contains('active')) {
          content.style.maxHeight = 'none'; // fully open, no limit
        }
      }, { once: true });
    }
  }

  // Setup collapsible sections for Overview (income / expense)
  ['income', 'expense'].forEach(type => {
    const trigger = document.getElementById(`collapse-trigger-${type}`);
    if (trigger) {
      trigger.addEventListener('click', () => {
        const content = document.getElementById(type === 'income' ? 'accounts-assets-list' : 'accounts-liabilities-list');
        const icon = document.getElementById(`collapse-icon-${type}`);
        toggleCollapsible(content, icon);
        // Save preference
        const willBeOpen = content && content.classList.contains('active');
        localStorage.setItem(`overview_collapse_${type}`, willBeOpen ? 'expanded' : 'collapsed');
      });
    }
  });

  // Bind programmatic listeners for the new settings subscreens
  bindSettingsSubscreenListeners();

  // NOTE: No dedicated backdrop-tap handler for settings-subscreen-modal here.
  // It has class="modal-overlay" so the generic attachBackdropTap (above) already
  // attaches backdrop-tap-to-close to it. A separate handler would be a duplicate
  // and could cause a double closeModal call.

  function bindSettingsSubscreenListeners() {
    const preferencesLangRow = document.getElementById('preferences-lang-row');
    if (preferencesLangRow) {
      preferencesLangRow.onclick = function () {
        toggleLanguageSetting();
      };
    }

    const themeSelect = document.getElementById('settings-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        changeThemeSetting(e.target.value);
      });
    }

    const currencySelect = document.getElementById('settings-currency');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        changeCurrencySetting(e.target.value);
      });
    }

    const weekStartSelect = document.getElementById('settings-week-start');
    if (weekStartSelect) {
      weekStartSelect.addEventListener('change', (e) => {
        changeWeekStartSetting(e.target.value);
      });
    }

    const autocompleteCheckbox = document.getElementById('settings-autocomplete');
    if (autocompleteCheckbox) {
      autocompleteCheckbox.addEventListener('change', (e) => {
        toggleAutocompleteSetting(e.target.checked);
      });
    }

    const dailyReminderCheckbox = document.getElementById('settings-daily-reminder');
    if (dailyReminderCheckbox) {
      dailyReminderCheckbox.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('settings_daily_reminder_enabled', enabled ? 'true' : 'false');
        // The reminder time lives in localStorage (set via the modern time
        // picker); there is no settings-daily-reminder-time input element.
        const timeVal = localStorage.getItem('settings_daily_reminder_time') || '21:00';
        const timeRow = document.getElementById('settings-daily-reminder-time-row');
        if (timeRow) timeRow.style.display = enabled ? 'flex' : 'none';
        scheduleDailyReminder(enabled, timeVal);
      });
    }

    const recurringAlertsCheckbox = document.getElementById('settings-recurring-alerts');
    if (recurringAlertsCheckbox) {
      recurringAlertsCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('settings_recurring_alerts_enabled', e.target.checked ? 'true' : 'false');
      });
    }

    const syncSupabaseRow = document.getElementById('sync-supabase-row');
    if (syncSupabaseRow) {
      syncSupabaseRow.addEventListener('click', () => {
        openSupabaseSettings();
      });
    }

    const syncNowRow = document.getElementById('sync-now-row');
    if (syncNowRow) {
      syncNowRow.addEventListener('click', () => {
        forceSyncNow();
      });
    }

    const excelImportRow = document.getElementById('sync-excel-import-row');
    if (excelImportRow) {
      excelImportRow.addEventListener('click', () => {
        openModal('excel-modal');
      });
    }

    const excelExportRow = document.getElementById('sync-excel-export-row');
    if (excelExportRow) {
      excelExportRow.addEventListener('click', () => {
        openExportPeriodSheet();
      });
    }

    const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
    if (feedbackSubmitBtn) {
      feedbackSubmitBtn.addEventListener('click', () => {
        submitUserFeedback();
      });
    }

    // NOTE: The force update row (legal-force-update-row) is intentionally NOT
    // bound here. It already has an inline onclick="forceAppUpdate()" in
    // index.html. A previous duplicate addEventListener here caused forceAppUpdate()
    // to fire TWICE, stacking two confirmation dialogs on top of each other.
    // Removed to avoid the double-handler conflict.

    // NOTE: The privacy policy row (legal-privacy-row) is intentionally NOT
    // bound here. It already has an inline onclick="openModal('privacy-policy-modal')"
    // in index.html which opens the in-app privacy modal. A previous duplicate
    // addEventListener here called window.open('privacy.html', '_blank'), which
    // is broken in the Capacitor/Android WebView and fired on top of the modal,
    // making the option appear broken. Removed to avoid the double-handler conflict.

    const logoutRow = document.getElementById('legal-logout-row');
    if (logoutRow) {
      logoutRow.addEventListener('click', () => {
        handleLogout();
      });
    }

    const syncTrashRow = document.getElementById('sync-trash-row');
    if (syncTrashRow) {
      syncTrashRow.addEventListener('click', () => {
        openTrashBinModal();
      });
    }

    const legalFeedbackRow = document.getElementById('legal-feedback-row');
    if (legalFeedbackRow) {
      legalFeedbackRow.addEventListener('click', () => {
        openSettingsSubscreen('feedback', 'settings_feedback_title');
      });
    }

    const backBtn = document.getElementById('settings-subscreen-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window._settingsSubscreenHistory && window._settingsSubscreenHistory.length > 0) {
          const prev = window._settingsSubscreenHistory.pop();
          openSettingsSubscreen(prev.id, prev.titleKey, true);
        } else {
          // Mark as a deliberate user action so the resume anti-ghost-click guard
          // NEVER blocks this close — the back arrow must respond instantly.
          window.__userInitiatedClose = true;
          closeModal('settings-subscreen-modal');
          // Hard fallback: if closeModal was blocked by any guard (e.g. resume
          // transition), force-remove the active class so the card always closes.
          const modalEl = document.getElementById('settings-subscreen-modal');
          if (modalEl && modalEl.classList.contains('active')) {
            setTimeout(() => {
              if (modalEl.classList.contains('active')) {
                modalEl.classList.remove('active');
                document.body.classList.remove('modal-open');
              }
            }, 60);
          }
        }
      });
    }
  }

  // Click handler for FHS card & "?" help icon
  const fhsCard = document.querySelector('.fhs-card');
  const fhsHelpTrigger = document.getElementById('fhs-help-trigger');

  if (fhsHelpTrigger) {
    fhsHelpTrigger.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevents the card click from firing
      openFinancialHealthModal('methodology');
    });
  }

  if (fhsCard) {
    fhsCard.addEventListener('click', (e) => {
      if (!e.target.closest('#fhs-help-trigger')) {
        openFinancialHealthModal('breakdown');
      }
    });
  }

  // FHS Modal tab switching
  const breakdownTabBtn = document.getElementById('fhs-tab-breakdown');
  const methodologyTabBtn = document.getElementById('fhs-tab-methodology');
  if (breakdownTabBtn) {
    breakdownTabBtn.addEventListener('click', () => showFhsTab('breakdown'));
  }
  if (methodologyTabBtn) {
    methodologyTabBtn.addEventListener('click', () => showFhsTab('methodology'));
  }
}
// The OTA boot loader injects app.js asynchronously via Blob URL AFTER
// DOMContentLoaded has fired. Use the same readyState fallback as initApp so
// the settings-subscreen back-arrow handler and FHS listeners are ALWAYS
// installed regardless of load timing.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettingsSubscreenAndFhs);
} else {
  setTimeout(initSettingsSubscreenAndFhs, 0);
}

function openFinancialHealthModal(tab = 'breakdown') {
  showFhsTab(tab);
  openModal('fhs-details-modal');
}
window.openFinancialHealthModal = openFinancialHealthModal;

function toggleFhsExplain() {
  const fhsExplainContent = document.getElementById('fhs-explain-content');
  const fhsExplainChevron = document.getElementById('fhs-explain-chevron');
  if (!fhsExplainContent) return;
  const isHidden = fhsExplainContent.style.display === 'none' || !fhsExplainContent.style.display;
  if (isHidden) {
    fhsExplainContent.style.display = 'block';
    if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(180deg)';
  } else {
    fhsExplainContent.style.display = 'none';
    if (fhsExplainChevron) fhsExplainChevron.style.transform = 'rotate(0deg)';
  }
}
window.toggleFhsExplain = toggleFhsExplain;

// Helper for FHS Tab switching
function showFhsTab(tabName) {
  const breakdownBtn = document.getElementById('fhs-tab-breakdown');
  const methodologyBtn = document.getElementById('fhs-tab-methodology');
  const breakdownContent = document.getElementById('fhs-content-breakdown');
  const methodologyContent = document.getElementById('fhs-content-methodology');

  if (tabName === 'breakdown') {
    if (breakdownBtn) {
      breakdownBtn.style.color = 'var(--text-primary)';
      breakdownBtn.style.borderBottom = '2px solid var(--accent)';
      breakdownBtn.classList.add('active');
    }
    if (methodologyBtn) {
      methodologyBtn.style.color = 'var(--text-secondary)';
      methodologyBtn.style.borderBottom = 'none';
      methodologyBtn.classList.remove('active');
    }
    if (breakdownContent) breakdownContent.style.display = 'block';
    if (methodologyContent) methodologyContent.style.display = 'none';
  } else {
    if (breakdownBtn) {
      breakdownBtn.style.color = 'var(--text-secondary)';
      breakdownBtn.style.borderBottom = 'none';
      breakdownBtn.classList.remove('active');
    }
    if (methodologyBtn) {
      methodologyBtn.style.color = 'var(--text-primary)';
      methodologyBtn.style.borderBottom = '2px solid var(--accent)';
      methodologyBtn.classList.add('active');
    }
    if (breakdownContent) breakdownContent.style.display = 'none';
    if (methodologyContent) methodologyContent.style.display = 'block';
  }
}


  // Window attachments for backward compatibility and inline HTML calls
  if (typeof window !== 'undefined') {
    window.openSettingsSubscreen = openSettingsSubscreen;
    window.openNotesManager = openNotesManager;
    window.changeOverviewYear = changeOverviewYear;
    window.openSavingsRunwayModal = openSavingsRunwayModal;
    window.saveCustomSavingsTarget = saveCustomSavingsTarget;
    window.initDescriptionAutoGrow = initDescriptionAutoGrow;
    window.initSettingsSubscreenAndFhs = initSettingsSubscreenAndFhs;
    window.openFinancialHealthModal = openFinancialHealthModal;
    window.toggleFhsExplain = toggleFhsExplain;
    window.showFhsTab = showFhsTab;
  }

  return {
    openSettingsSubscreen,
    openNotesManager,
    changeOverviewYear,
    openSavingsRunwayModal,
    saveCustomSavingsTarget,
    initDescriptionAutoGrow,
    initSettingsSubscreenAndFhs,
    openFinancialHealthModal,
    toggleFhsExplain,
    showFhsTab
  };
}));
