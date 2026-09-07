/**
 * recurringModalService.js - Recurring Settings Modal Service
 * Handles frequency preset selection, specific months picker,
 * recurring expiration (end date/perpetual), summary calculations,
 * and button state styling in transaction editor.
 *
 * Extracted in Phase 29A Architectural Modularization
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RecurringModalService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let _customSelectedEndYear = null;

  const GREEK_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.GREEK_MONTHS_SHORT) ||
    (typeof window !== 'undefined' && window.GREEK_MONTHS_SHORT) ||
    ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];

  const ENGLISH_MONTHS_SHORT = (typeof I18nService !== 'undefined' && I18nService.ENGLISH_MONTHS_SHORT) ||
    (typeof window !== 'undefined' && window.ENGLISH_MONTHS_SHORT) ||
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getState() {
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof state !== 'undefined') return state;
    return { lang: 'el' };
  }

  function getTranslations() {
    if (typeof TRANSLATIONS !== 'undefined') return TRANSLATIONS;
    if (typeof window !== 'undefined' && window.TRANSLATIONS) return window.TRANSLATIONS;
    return { el: {}, en: {} };
  }

  function getPendingSettings() {
    if (typeof window !== 'undefined' && window._pendingRecurringSettings) {
      return window._pendingRecurringSettings;
    }
    if (typeof _pendingRecurringSettings !== 'undefined') {
      return _pendingRecurringSettings;
    }
    const defaultSettings = { isActive: false, days: [], months: [], years: [], preset: 'monthly', endType: 'perpetual', endDate: null, endYear: null };
    if (typeof window !== 'undefined') {
      window._pendingRecurringSettings = defaultSettings;
    }
    return defaultSettings;
  }

  function setPendingSettings(settings) {
    if (typeof window !== 'undefined') {
      window._pendingRecurringSettings = settings;
    }
    return settings;
  }

  function openRecurringModal(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (typeof document === 'undefined') return;
    const monthsGrid = document.getElementById('recurring-specific-months-grid');
    if (!monthsGrid) return;

    monthsGrid.innerHTML = '';

    const appState = getState();
    const pending = getPendingSettings();

    // Generate 1-12 months grid inside the Specific Months container
    const monthNames = appState.lang === 'en' ? ENGLISH_MONTHS_SHORT : GREEK_MONTHS_SHORT;
    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'google-picker-btn';
      btn.textContent = monthNames[m - 1];
      if (pending.months && pending.months.includes(m)) {
        btn.classList.add('active');
      }
      btn.onclick = () => {
        toggleRecurringSpecificMonth(m, btn);
      };
      monthsGrid.appendChild(btn);
    }

    // Sync frequency preset and dropdown UI
    const currentPreset = pending.preset || 'monthly';
    const presetInput = document.getElementById('recurring-simple-preset');
    if (presetInput) {
      presetInput.value = currentPreset;
    }

    const lang = appState.lang || 'el';
    const freqLabel = document.getElementById('recurring-frequency-label');
    const icon = document.getElementById('recurring-frequency-icon');
    const meta = {
      daily: { icon: '☀️', el: 'Daily (Καθημερινά)', en: 'Daily' },
      weekly: { icon: '📆', el: 'Weekly (Εβδομαδιαία)', en: 'Weekly' },
      monthly: { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' },
      yearly: { icon: '🎆', el: 'Yearly (Ετήσια)', en: 'Yearly' },
      specific_months: { icon: '📌', el: 'Specific Months (Συγκεκριμένοι Μήνες)', en: 'Specific Months' }
    }[currentPreset] || { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' };

    if (icon) icon.textContent = meta.icon;
    if (freqLabel) freqLabel.textContent = lang === 'el' ? meta.el : meta.en;

    const options = document.querySelectorAll('#recurring-frequency-options-list .freq-option-item');
    options.forEach(opt => {
      const isSelected = opt.getAttribute('data-value') === currentPreset;
      opt.classList.toggle('selected', isSelected);
      opt.style.background = isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
      opt.style.border = isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : 'none';
      const check = opt.querySelector('.freq-check-icon');
      if (check) check.style.display = isSelected ? 'block' : 'none';
    });

    const list = document.getElementById('recurring-frequency-options-list');
    const chevron = document.getElementById('recurring-frequency-chevron');
    if (list) list.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';

    // Show or hide Specific Months container
    const monthsContainer = document.getElementById('recurring-specific-months-container');
    if (monthsContainer) {
      if (currentPreset === 'specific_months') {
        monthsContainer.style.display = 'flex';
      } else {
        monthsContainer.style.display = 'none';
      }
    }

    // Set Expiration UI state
    const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
    const btnDate = document.getElementById('recurring-end-type-date');
    const dateContainer = document.getElementById('recurring-custom-end-date-container');
    const hiddenInput = document.getElementById('recurring-end-date');
    const dateLabel = document.getElementById('recurring-end-date-label');
    const translations = getTranslations();

    if (!pending.endType || pending.endType === 'perpetual') {
      if (btnPerpetual) btnPerpetual.classList.add('active');
      if (btnDate) btnDate.classList.remove('active');
      if (dateContainer) dateContainer.style.display = 'none';
      if (hiddenInput) hiddenInput.value = '';
      if (dateLabel) dateLabel.textContent = (translations[appState.lang] && translations[appState.lang]['select_date']) || 'Επιλογή ημερομηνίας...';
    } else {
      if (btnPerpetual) btnPerpetual.classList.remove('active');
      if (btnDate) btnDate.classList.add('active');
      if (dateContainer) dateContainer.style.display = 'flex';

      if (pending.endDate) {
        if (hiddenInput) hiddenInput.value = pending.endDate;
        if (dateLabel) {
          const parts = pending.endDate.split('-');
          if (parts.length === 3) {
            dateLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
      }
    }

    updateRecurringSummary();
    if (typeof openModal === 'function') {
      openModal('recurring-picker-modal');
    } else if (typeof window !== 'undefined' && typeof window.openModal === 'function') {
      window.openModal('recurring-picker-modal');
    }
  }

  function toggleRecurringFrequencyList() {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('recurring-frequency-options-list');
    const chevron = document.getElementById('recurring-frequency-chevron');
    if (!list) return;
    const isHidden = list.style.display === 'none' || (typeof getComputedStyle === 'function' && getComputedStyle(list).display === 'none');
    list.style.display = isHidden ? 'flex' : 'none';
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }

  function selectRecurringFrequencyOption(val) {
    const pending = getPendingSettings();
    pending.preset = val;
    if (typeof document === 'undefined') return;
    const input = document.getElementById('recurring-simple-preset');
    if (input) input.value = val;

    const appState = getState();
    const lang = appState.lang || 'el';
    const label = document.getElementById('recurring-frequency-label');
    const icon = document.getElementById('recurring-frequency-icon');

    const meta = {
      daily: { icon: '☀️', el: 'Daily (Καθημερινά)', en: 'Daily' },
      weekly: { icon: '📆', el: 'Weekly (Εβδομαδιαία)', en: 'Weekly' },
      monthly: { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' },
      yearly: { icon: '🎆', el: 'Yearly (Ετήσια)', en: 'Yearly' },
      specific_months: { icon: '📌', el: 'Specific Months (Συγκεκριμένοι Μήνες)', en: 'Specific Months' }
    }[val] || { icon: '📅', el: 'Monthly (Μηνιαία)', en: 'Monthly' };

    if (icon) icon.textContent = meta.icon;
    if (label) label.textContent = lang === 'el' ? meta.el : meta.en;

    const options = document.querySelectorAll('#recurring-frequency-options-list .freq-option-item');
    options.forEach(opt => {
      const isSelected = opt.getAttribute('data-value') === val;
      opt.classList.toggle('selected', isSelected);
      opt.style.background = isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent';
      opt.style.border = isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : 'none';
      const check = opt.querySelector('.freq-check-icon');
      if (check) check.style.display = isSelected ? 'block' : 'none';
    });

    const monthsContainer = document.getElementById('recurring-specific-months-container');
    if (monthsContainer) {
      if (val === 'specific_months') {
        monthsContainer.style.display = 'flex';
        if (!pending.months || pending.months.length === 0) {
          const transDateVal = document.getElementById('trans-date')?.value;
          const currentMonth = transDateVal ? new Date(transDateVal).getMonth() + 1 : new Date().getMonth() + 1;
          pending.months = [currentMonth];
          openRecurringModal();
          return;
        }
      } else {
        monthsContainer.style.display = 'none';
      }
    }

    const list = document.getElementById('recurring-frequency-options-list');
    const chevron = document.getElementById('recurring-frequency-chevron');
    if (list) list.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';

    updateRecurringSummary();
  }

  function onSimplePresetChange() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('recurring-simple-preset');
    if (!select) return;
    const val = select.value;
    const pending = getPendingSettings();
    pending.preset = val;

    const monthsContainer = document.getElementById('recurring-specific-months-container');
    if (monthsContainer) {
      if (val === 'specific_months') {
        monthsContainer.style.display = 'flex';
        // If specific_months is selected and no months are selected yet, default to current transaction month
        if (!pending.months || pending.months.length === 0) {
          const transDateVal = document.getElementById('trans-date')?.value;
          const currentMonth = transDateVal ? new Date(transDateVal).getMonth() + 1 : new Date().getMonth() + 1;
          pending.months = [currentMonth];
          openRecurringModal(); // re-render grid
        }
      } else {
        monthsContainer.style.display = 'none';
      }
    }
    updateRecurringSummary();
  }

  function toggleRecurringSpecificMonth(month, element) {
    const pending = getPendingSettings();
    if (!pending.months) {
      pending.months = [];
    }
    const idx = pending.months.indexOf(month);
    if (idx > -1) {
      if (pending.months.length > 1) {
        pending.months.splice(idx, 1);
        if (element && element.classList) element.classList.remove('active');
      }
    } else {
      pending.months.push(month);
      if (element && element.classList) element.classList.add('active');
    }
    updateRecurringSummary();
  }

  function selectRecurringEndType(type) {
    const pending = getPendingSettings();
    if (typeof document === 'undefined') return;
    const btnPerpetual = document.getElementById('recurring-end-type-perpetual');
    const btnDate = document.getElementById('recurring-end-type-date');
    const dateContainer = document.getElementById('recurring-custom-end-date-container');

    if (type === 'perpetual') {
      if (btnPerpetual) btnPerpetual.classList.add('active');
      if (btnDate) btnDate.classList.remove('active');
      if (dateContainer) dateContainer.style.display = 'none';
      pending.endType = 'perpetual';
      pending.endDate = null;
      pending.endYear = null;
    } else {
      if (btnPerpetual) btnPerpetual.classList.remove('active');
      if (btnDate) btnDate.classList.add('active');
      if (dateContainer) dateContainer.style.display = 'flex';
      pending.endType = 'date';

      // Default to end of current year if no end date selected
      if (!pending.endDate) {
        const today = new Date();
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        const yyyy = endOfYear.getFullYear();
        const mm = String(endOfYear.getMonth() + 1).padStart(2, '0');
        const dd = String(endOfYear.getDate()).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;

        const hiddenInput = document.getElementById('recurring-end-date');
        if (hiddenInput) hiddenInput.value = formatted;

        const label = document.getElementById('recurring-end-date-label');
        if (label) {
          label.textContent = `${dd}/${mm}/${yyyy}`;
        }
        pending.endDate = formatted;
      }
    }
    updateRecurringSummary();
  }

  function updateRecurringSummary() {
    if (typeof document === 'undefined') return;
    const summaryText = document.getElementById('recurring-summary-text');
    if (!summaryText) return;

    const appState = getState();
    const lang = appState.lang || 'el';
    const pending = getPendingSettings();
    const preset = pending.preset || 'monthly';
    const endType = pending.endType || 'perpetual';
    const endDate = pending.endDate;

    let freqPart = '';
    if (lang === 'el') {
      if (preset === 'daily') freqPart = 'Καθημερινά';
      else if (preset === 'weekly') freqPart = 'Κάθε εβδομάδα';
      else if (preset === 'monthly') freqPart = 'Κάθε μήνα';
      else if (preset === 'yearly') freqPart = 'Κάθε χρόνο';
      else if (preset === 'specific_months') {
        const shortMonths = pending.months || [];
        const monthNames = GREEK_MONTHS_SHORT;
        const selectedNames = shortMonths.sort((a, b) => a - b).map(m => monthNames[m - 1]).join(', ');
        freqPart = selectedNames ? `Στους μήνες (${selectedNames})` : 'Επιλεγμένους μήνες';
      } else {
        freqPart = 'Προσαρμοσμένα';
      }
    } else {
      if (preset === 'daily') freqPart = 'Daily';
      else if (preset === 'weekly') freqPart = 'Weekly';
      else if (preset === 'monthly') freqPart = 'Monthly';
      else if (preset === 'yearly') freqPart = 'Yearly';
      else if (preset === 'specific_months') {
        const shortMonths = pending.months || [];
        const monthNames = ENGLISH_MONTHS_SHORT;
        const selectedNames = shortMonths.sort((a, b) => a - b).map(m => monthNames[m - 1]).join(', ');
        freqPart = selectedNames ? `In months (${selectedNames})` : 'Selected months';
      } else {
        freqPart = 'Custom';
      }
    }

    let endPart = '';
    if (lang === 'el') {
      if (endType === 'perpetual') {
        endPart = 'για πάντα';
      } else if (endDate) {
        const parts = endDate.split('-');
        if (parts.length === 3) {
          endPart = `μέχρι τις ${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          endPart = `μέχρι ${endDate}`;
        }
      } else {
        endPart = 'για πάντα';
      }
    } else {
      if (endType === 'perpetual') {
        endPart = 'forever';
      } else if (endDate) {
        const parts = endDate.split('-');
        if (parts.length === 3) {
          endPart = `until ${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          endPart = `until ${endDate}`;
        }
      } else {
        endPart = 'forever';
      }
    }

    summaryText.textContent = lang === 'el'
      ? `Θα δημιουργούνται: ${freqPart} ${endPart}`
      : `Will be created: ${freqPart} ${endPart}`;
  }

  function clearRecurringSettings(shouldCloseModal = true) {
    const pending = getPendingSettings();
    pending.isActive = false;
    pending.days = [];
    pending.months = [];
    pending.years = [];
    pending.preset = 'monthly';
    pending.endType = 'perpetual';
    pending.endDate = null;
    pending.endYear = null;
    delete pending.templateId;

    if (typeof document !== 'undefined') {
      const select = document.getElementById('recurring-simple-preset');
      if (select) {
        select.value = 'monthly';
      }

      const monthsContainer = document.getElementById('recurring-specific-months-container');
      if (monthsContainer) monthsContainer.style.display = 'none';

      selectRecurringEndType('perpetual');
      resetRepInstButton();

      if (shouldCloseModal) {
        if (typeof closeModal === 'function') {
          closeModal('recurring-picker-modal');
        } else if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
          window.closeModal('recurring-picker-modal');
        }
      }
    }
  }

  function saveRecurringSettings() {
    const pending = getPendingSettings();
    pending.isActive = true;
    const appState = getState();
    const lang = appState.lang || 'el';

    if (typeof document !== 'undefined') {
      const hiddenInput = document.getElementById('recurring-end-date');
      if (pending.endType === 'date' && hiddenInput && hiddenInput.value) {
        pending.endDate = hiddenInput.value;
      }
    }

    if (pending.templateId) {
      const template = (appState.recurringTemplates || []).find(t => String(t.id) === String(pending.templateId));
      if (template) {
        template.preset = pending.preset || 'monthly';
        template.endType = pending.endType || 'perpetual';
        template.endDate = (pending.endType === 'date') ? (pending.endDate || null) : null;
        template.endYear = pending.endYear || null;
        template.months = Array.isArray(pending.months) ? [...pending.months] : [];
        template.days = Array.isArray(pending.days) ? [...pending.days] : [];
        template.updated_at = new Date().toISOString();
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('recurring_templates', JSON.stringify(appState.recurringTemplates));
        }
        if (typeof enqueueSyncMutation === 'function') {
          enqueueSyncMutation('save_template', template);
        } else if (typeof window !== 'undefined' && typeof window.enqueueSyncMutation === 'function') {
          window.enqueueSyncMutation('save_template', template);
        }
        if (appState.isSupabaseEnabled && appState.supabaseClient && appState.currentUser) {
          const dbPayload = (typeof mapTemplateToDb === 'function')
            ? mapTemplateToDb(template)
            : (typeof window !== 'undefined' && typeof window.mapTemplateToDb === 'function' ? window.mapTemplateToDb(template) : template);

          appState.supabaseClient
            .from('recurring_templates')
            .upsert([dbPayload])
            .then(({ error }) => {
              if (error) {
                console.warn('Cloud recurring template update warning:', error);
              } else {
                if (typeof dequeueSyncMutation === 'function') {
                  dequeueSyncMutation('save_template', template.id);
                } else if (typeof window !== 'undefined' && typeof window.dequeueSyncMutation === 'function') {
                  window.dequeueSyncMutation('save_template', template.id);
                }
              }
            }).catch(() => { });
        }
        if (typeof processRecurringTemplates === 'function') {
          processRecurringTemplates();
        } else if (typeof window !== 'undefined' && typeof window.processRecurringTemplates === 'function') {
          window.processRecurringTemplates();
        }
        if (typeof updateUI === 'function') {
          updateUI();
        } else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') {
          window.updateUI();
        }
        const toastMsg = lang === 'el' ? '✓ Οι ρυθμίσεις επανάληψης αποθηκεύτηκαν' : '✓ Recurring settings saved';
        if (typeof showSyncToast === 'function') {
          showSyncToast(toastMsg, 2500);
        } else if (typeof window !== 'undefined' && typeof window.showSyncToast === 'function') {
          window.showSyncToast(toastMsg, 2500);
        }
      }
    }

    if (typeof document !== 'undefined') {
      const btn = document.getElementById('btn-rep-inst');
      if (btn) {
        const preset = pending.preset || 'monthly';

        let presetLabel = '';
        if (preset === 'daily') presetLabel = lang === 'el' ? 'Ημερήσια' : 'Daily';
        else if (preset === 'weekly') presetLabel = lang === 'el' ? 'Εβδομαδιαία' : 'Weekly';
        else if (preset === 'monthly') presetLabel = lang === 'el' ? 'Μηνιαία' : 'Monthly';
        else if (preset === 'yearly') presetLabel = lang === 'el' ? 'Ετήσια' : 'Yearly';
        else if (preset === 'specific_months') presetLabel = lang === 'el' ? 'Μήνες' : 'Months';
        else presetLabel = lang === 'el' ? 'Custom' : 'Custom';

        btn.style.background = '#3b82f6';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#3b82f6';
        const isExisting = !!pending.templateId;
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isExisting ? (lang === 'el' ? 'Επαναλαμβανόμενη' : 'Recurring') : (lang === 'el' ? 'Ενεργό' : 'Active')} (${presetLabel})`;
      }
      if (typeof closeModal === 'function') {
        closeModal('recurring-picker-modal');
      } else if (typeof window !== 'undefined' && typeof window.closeModal === 'function') {
        window.closeModal('recurring-picker-modal');
      }
    }
  }

  function resetRepInstButton() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btn-rep-inst');
    if (btn) {
      btn.style.background = 'rgba(59, 130, 246, 0.15)';
      btn.style.color = '#3b82f6';
      btn.style.borderColor = 'rgba(59, 130, 246, 0.35)';
      btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Rep/Inst.';
    }
  }

  // Attach directly to window for global HTML handler access
  if (typeof window !== 'undefined') {
    window.openRecurringModal = openRecurringModal;
    window.toggleRecurringFrequencyList = toggleRecurringFrequencyList;
    window.selectRecurringFrequencyOption = selectRecurringFrequencyOption;
    window.onSimplePresetChange = onSimplePresetChange;
    window.toggleRecurringSpecificMonth = toggleRecurringSpecificMonth;
    window.selectRecurringEndType = selectRecurringEndType;
    window.updateRecurringSummary = updateRecurringSummary;
    window.clearRecurringSettings = clearRecurringSettings;
    window.saveRecurringSettings = saveRecurringSettings;
    window.resetRepInstButton = resetRepInstButton;
  }

  return {
    openRecurringModal,
    toggleRecurringFrequencyList,
    selectRecurringFrequencyOption,
    onSimplePresetChange,
    toggleRecurringSpecificMonth,
    selectRecurringEndType,
    updateRecurringSummary,
    clearRecurringSettings,
    saveRecurringSettings,
    resetRepInstButton,
    getPendingSettings,
    setPendingSettings
  };
}));
