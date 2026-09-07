/**
 * Transaction Modal & Form Controller Subsystem
 * Extracted from app.js (Phase 20B Architectural Modularization)
 * Handles opening, editing, resetting, locking, and populating transaction forms.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TransactionModalService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function toggleTransactionFormLock(locked) {
  const form = document.getElementById('transaction-form');
  if (!form) return;

  if (locked) {
    form.setAttribute('data-readonly', 'true');
  } else {
    form.removeAttribute('data-readonly');
  }

  const inputsToToggle = [
    'trans-date',
    'trans-note',
    'trans-description',
    'trans-account-from',
    'trans-account-to',
    'trans-subcategory-custom'
  ];
  inputsToToggle.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = locked;
    }
  });

  const pointerContainers = [
    document.querySelector('.type-selector-tabs'),
    document.getElementById('trans-category-trigger'),
    document.getElementById('trans-subcategory-trigger'),
    document.getElementById('form-row-amount')
  ];
  pointerContainers.forEach(el => {
    if (el) {
      if (locked) {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.6';
      } else {
        el.style.pointerEvents = '';
        el.style.opacity = '';
      }
    }
  });

  const saveBtn = document.getElementById('btn-save-transaction');
  if (saveBtn) {
    saveBtn.style.display = locked ? 'none' : 'block';
  }
  const deletePhotoBtn = document.getElementById('btn-delete-photo');
  if (deletePhotoBtn) {
    deletePhotoBtn.style.display = locked ? 'none' : 'block';
  }
  const cameraBtn = document.getElementById('trans-camera-btn');
  if (cameraBtn) {
    cameraBtn.style.display = locked ? 'none' : 'block';
  }

  let warningEl = document.getElementById('trans-readonly-warning');
  if (locked) {
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'trans-readonly-warning';
      warningEl.style.padding = '10px 12px';
      warningEl.style.borderRadius = '8px';
      warningEl.style.backgroundColor = 'rgba(239, 83, 80, 0.15)';
      warningEl.style.color = '#ef5350';
      warningEl.style.fontSize = '12px';
      warningEl.style.fontWeight = '500';
      warningEl.style.textAlign = 'center';
      warningEl.style.marginBottom = '8px';
      warningEl.style.display = 'flex';
      warningEl.style.alignItems = 'center';
      warningEl.style.justifyContent = 'center';
      warningEl.style.gap = '8px';
      warningEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${TRANSLATIONS[state.lang]['only_creator_edit_warning']}</span>`;

      const form = document.getElementById('transaction-form');
      if (form) {
        form.parentNode.insertBefore(warningEl, form);
      }
    } else {
      warningEl.querySelector('span').textContent = TRANSLATIONS[state.lang]['only_creator_edit_warning'];
      warningEl.style.display = 'flex';
    }
  } else {
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  }
}

function openAddTransactionModal({ instant = false } = {}) {
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }

  clearRecurringSettings(false);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) {
    repInstBtn.style.display = 'flex';
    resetRepInstButton();
    repInstBtn.onclick = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      openRecurringModal(e);
    };
  }

  if (typeof clearRecurringSettings === 'function') {
    clearRecurringSettings(false);
  }

  toggleTransactionFormLock(false);
  document.getElementById('transaction-form').reset();
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();
  document.getElementById('trans-id').value = '';

  // Reset Category
  document.getElementById('trans-category').value = '';
  document.getElementById('trans-category-display').innerHTML = `<span class="custom-select-placeholder">${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['label_select']) || 'Επιλέξτε...'}</span>`;

  // Reset Subcategory
  const customInput = document.getElementById('trans-subcategory-custom');
  if (customInput) customInput.value = '';
  hideSubcategorySelect();

  document.getElementById('trans-delete-btn').style.display = 'none';

  const creatorRow = document.getElementById('trans-creator-row');
  if (creatorRow) creatorRow.style.display = 'none';

  // Reset photo state
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const cameraInput = document.getElementById('trans-camera-input');
  if (cameraInput) cameraInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (placeholderContainer) placeholderContainer.style.display = 'none';

  const aiBanner = document.getElementById('ai-receipt-scanning-banner');
  if (aiBanner) aiBanner.style.display = 'none';
  const aiCard = document.getElementById('ai-receipt-confirmation-card');
  if (aiCard) aiCard.style.display = 'none';
  const aiCamInput = document.getElementById('trans-ai-camera-input');
  if (aiCamInput) aiCamInput.value = '';
  const aiGalInput = document.getElementById('trans-ai-gallery-input');
  if (aiGalInput) aiGalInput.value = '';

  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  document.getElementById('trans-date').value = localISOTime;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(localISOTime);

  setTransactionFormType('expense');

  // Set default account values to avoid empty payment methods
  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = DEFAULT_ACCOUNTS.slice();
  }
  const cardAcc = state.accounts.find(acc => acc.type === 'card' || acc.name.toLowerCase().trim() === 'card' || acc.name.trim() === 'Κάρτα');
  const defaultFromAcc = cardAcc || state.accounts[0];
  document.getElementById('trans-account-from').value = defaultFromAcc.name;
  document.getElementById('trans-account-to').value = state.accounts.length > 1 ? (state.accounts.find(acc => acc.name !== defaultFromAcc.name) || state.accounts[0]).name : state.accounts[0].name;
  updateAccountDropdowns();

  // Multi-currency: default currency from selected account (or base currency), show row if enabled
  initTransactionCurrency();

  openModal('transaction-modal', { instant });
  updateAmountCurrencySymbol();
  setTimeout(() => initNoteAutocomplete(), 50);
}
window.openAddTransactionModal = openAddTransactionModal;

function openEditTransactionModal(t, { instant = false } = {}) {
  state.lastOpenedTransactionId = t.id;
  if (typeof window.closeCalculatorKeypad === 'function') {
    window.closeCalculatorKeypad();
  }

  const recTemplate = resolveRecurringTemplateForTx(t);
  const repInstBtn = document.getElementById('btn-rep-inst');
  if (repInstBtn) {
    repInstBtn.style.display = 'flex';
    if (recTemplate) {
      _pendingRecurringSettings = {
        isActive: true,
        templateId: recTemplate.id,
        preset: recTemplate.preset || 'monthly',
        endType: recTemplate.endType || 'perpetual',
        endDate: recTemplate.endDate || null,
        endYear: recTemplate.endYear || null,
        months: Array.isArray(recTemplate.months) ? [...recTemplate.months] : [],
        days: Array.isArray(recTemplate.days) ? [...recTemplate.days] : []
      };
      repInstBtn.style.background = '#3b82f6';
      repInstBtn.style.color = '#ffffff';
      repInstBtn.style.borderColor = '#3b82f6';
      const isEl = (state.lang || 'el') === 'el';
      const preset = recTemplate.preset || 'monthly';
      let presetLabel = '';
      if (preset === 'daily') presetLabel = isEl ? 'Ημερήσια' : 'Daily';
      else if (preset === 'weekly') presetLabel = isEl ? 'Εβδομαδιαία' : 'Weekly';
      else if (preset === 'monthly') presetLabel = isEl ? 'Μηνιαία' : 'Monthly';
      else if (preset === 'yearly') presetLabel = isEl ? 'Ετήσια' : 'Yearly';
      else if (preset === 'specific_months') presetLabel = isEl ? 'Μήνες' : 'Months';
      else presetLabel = isEl ? 'Custom' : 'Custom';
      repInstBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${isEl ? 'Επαναλαμβανόμενη' : 'Recurring'} (${presetLabel})`;
      repInstBtn.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openRecurringModal(e);
      };
    } else {
      clearRecurringSettings(false);
      resetRepInstButton();
      repInstBtn.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        openRecurringModal(e);
      };
    }
  }

  const isFamilyMember = state.userProfile && state.userProfile.family_id;
  const isNotAdmin = state.userProfile && state.userProfile.role !== 'admin';
  const isNotOwner = t.user_id && state.currentUser && t.user_id !== state.currentUser.id;
  const shouldLock = !!(isFamilyMember && isNotAdmin && isNotOwner);

  toggleTransactionFormLock(shouldLock);

  document.getElementById('trans-id').value = t.id;

  let dateVal = t.date;
  if (dateVal) {
    if (dateVal.includes('T')) {
      dateVal = dateVal.slice(0, 16);
    } else if (dateVal.length === 10) {
      if (t.created_at) {
        const createdDate = new Date(t.created_at);
        if (!isNaN(createdDate.getTime())) {
          const hrs = String(createdDate.getHours()).padStart(2, '0');
          const mins = String(createdDate.getMinutes()).padStart(2, '0');
          dateVal = `${dateVal}T${hrs}:${mins}`;
        } else {
          dateVal = `${dateVal}T00:00`;
        }
      } else {
        dateVal = `${dateVal}T00:00`;
      }
    }
  }
  document.getElementById('trans-date').value = dateVal;
  document.getElementById('trans-date-display').textContent = formatGreekDateTime(dateVal);

  document.getElementById('trans-amount').value = formatCalcDisplay(String(t.amount));

  // Load note (primary title) and description (secondary) separately
  document.getElementById('trans-note').value = t.note || '';
  document.getElementById('trans-description').value = t.description || '';
  if (window.updateDescriptionHeight) window.updateDescriptionHeight();

  if (shouldLock) {
    document.getElementById('trans-delete-btn').style.display = 'none';
  } else {
    document.getElementById('trans-delete-btn').style.display = 'flex';
  }

  // Reset photo state and load existing photos if available
  _pendingReceiptFiles.forEach(p => {
    if (p.url && !p.isExisting) URL.revokeObjectURL(p.url);
  });
  _pendingReceiptFiles = [];
  _pendingReceiptDeleted = false;
  const photoInput = document.getElementById('trans-photo-input');
  if (photoInput) photoInput.value = '';
  const cameraInput = document.getElementById('trans-camera-input');
  if (cameraInput) cameraInput.value = '';
  const previewContainer = document.getElementById('trans-photo-preview-container');
  const placeholderContainer = document.getElementById('trans-photo-placeholder-container');
  if (previewContainer) previewContainer.style.display = 'none';
  if (placeholderContainer) placeholderContainer.style.display = 'none';

  const aiBanner = document.getElementById('ai-receipt-scanning-banner');
  if (aiBanner) aiBanner.style.display = 'none';
  const aiCard = document.getElementById('ai-receipt-confirmation-card');
  if (aiCard) aiCard.style.display = 'none';
  const aiCamInput = document.getElementById('trans-ai-camera-input');
  if (aiCamInput) aiCamInput.value = '';
  const aiGalInput = document.getElementById('trans-ai-gallery-input');
  if (aiGalInput) aiGalInput.value = '';

  // Load receipt photos from IndexedDB
  if (t.photo_local_uri && t.id) {
    ReceiptStorage.load(t.id).then(blobs => {
      if (blobs && blobs.length > 0) {
        blobs.forEach(blob => {
          const url = URL.createObjectURL(blob);
          _pendingReceiptFiles.push({
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: blob,
            url: url,
            isExisting: true
          });
        });
        renderPhotoPreviews();
      } else if (placeholderContainer) {
        // Photo exists in cloud record but not locally (different device)
        placeholderContainer.style.display = 'flex';
        const placeholderText = document.getElementById('trans-photo-placeholder-text');
        if (placeholderText) {
          placeholderText.textContent = TRANSLATIONS[state.lang]['photo_mismatch_warning'] || 'Η εικόνα είναι διαθέσιμη μόνο στη συσκευή που καταχωρήθηκε.';
        }
      }
    }).catch(err => console.warn('Failed to load receipts:', err));
  }

  setTransactionFormType(t.type);
  setTimeout(() => {
    if (t.type !== 'transfer') {
      document.getElementById('trans-category').value = t.category;

      const subcatVal = t.subcategory || '';
      document.getElementById('trans-subcategory-select').value = subcatVal;

      const customInput = document.getElementById('trans-subcategory-custom');
      if (customInput) customInput.value = '';

      updateCategoryDisplay();
      updateSubcategorySuggestions();
      updateSubcategoryRowVisibility();
    }

    document.getElementById('trans-account-from').value = t.account_from;
    if (t.type === 'transfer') {
      document.getElementById('trans-account-to').value = t.account_to || '';
    }
    updateAccountDropdowns();
  }, 10);

  // Show creator info
  const creatorRow = document.getElementById('trans-creator-row');
  const creatorText = document.getElementById('trans-creator-text');
  if (creatorRow && creatorText) {
    let creatorName = null;
    if (state.userProfile && state.userProfile.family_id && t.user_id) {
      const creator = state.familyProfiles.find(p => p.id === t.user_id);
      if (creator) {
        creatorName = creator.display_name || creator.email.split('@')[0];
      }
    }
    if (!creatorName && state.partnerProfile && t.user_id === state.partnerProfile.id) {
      creatorName = state.partnerProfile.display_name || state.partnerProfile.email.split('@')[0];
    }
    if (!creatorName && state.currentUser && t.user_id === state.currentUser.id) {
      creatorName = state.currentUser.email ? state.currentUser.email.split('@')[0] : (state.userProfile?.display_name || '');
    }
    if (creatorName) {
      creatorRow.style.display = 'block';
      creatorText.textContent = (state.lang === 'el' ? 'Καταχωρήθηκε από: ' : 'Added by: ') + creatorName;
    } else {
      creatorRow.style.display = 'none';
    }
  }

  // Multi-currency: set currency from the transaction being edited, show row if enabled
  initTransactionCurrency(t.currency || null);

  // Multi-currency: prefill the "actual amount" correction field (base currency)
  // with the transaction's current base-currency value, if it differs from base.
  const actualInput = document.getElementById('trans-actual-amount');
  if (actualInput) {
    const baseCurrency = localStorage.getItem('app_currency') || 'EUR';
    const txCurrency = getTransactionCurrency();
    if (CurrencyService.isEnabled() && txCurrency !== baseCurrency) {
      const baseVal = CurrencyService.toBase(t);
      actualInput.value = (baseVal != null && !isNaN(baseVal)) ? String(baseVal) : '';
    } else {
      actualInput.value = '';
    }
  }
  syncActualAmountRowVisibility();

  openModal('transaction-modal', { instant });
  updateAmountCurrencySymbol();
  setTimeout(() => initNoteAutocomplete(), 50);
}

  return {
    toggleTransactionFormLock,
    openAddTransactionModal,
    openEditTransactionModal
  };
}));
