/**
 * Account Picker View Subsystem
 * Extracted from app.js (Phase 19C Architectural Modularization)
 * Handles account selector modals, visual badges, labels, and trigger displays.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccountPickerView = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let _currentAccountPickerTarget = 'from';

  function getAccountVisualInfo(accOrType) {
    const type = typeof accOrType === 'object' && accOrType ? accOrType.type : accOrType;
    switch (type) {
      case 'cash':
        return { iconClass: 'fa-solid fa-money-bill-wave', emoji: '💵', color: '#10b981', labelEl: 'Μετρητά', labelEn: 'Cash' };
      case 'card':
        return { iconClass: 'fa-solid fa-credit-card', emoji: '💳', color: '#f59e0b', labelEl: 'Κάρτα', labelEn: 'Card' };
      case 'investment':
        return { iconClass: 'fa-solid fa-chart-line', emoji: '📈', color: '#8b5cf6', labelEl: 'Επένδυση', labelEn: 'Investment' };
      case 'bank':
      default:
        return { iconClass: 'fa-solid fa-building-columns', emoji: '🏦', color: '#3b82f6', labelEl: 'Τράπεζα', labelEn: 'Bank' };
    }
  }

  function getAccountDisplayName(accOrName) {
    if (!accOrName) return '';
    const name = typeof accOrName === 'string' ? accOrName : (accOrName.name || '');
    const type = typeof accOrName === 'object' && accOrName ? (accOrName.type || '') : '';
    const lowerName = name.toLowerCase().trim();
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    const lang = appState.lang || 'el';

    if (lang === 'el') {
      if (lowerName === 'cash' || lowerName === 'μετρητά' || (!lowerName && type === 'cash')) return 'Μετρητά';
      if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τραπεζικός λογαριασμός' || lowerName === 'τράπεζα' || (!lowerName && type === 'bank')) return 'Τράπεζα';
      if (lowerName === 'card' || lowerName === 'κάρτα' || (!lowerName && type === 'card')) return 'Κάρτα';
      if (lowerName === 'other bank' || lowerName === 'άλλη τράπεζα' || lowerName === 'bank 2' || lowerName === 'bank account 2') return 'Άλλη Τράπεζα';
    } else {
      if (lowerName === 'cash' || lowerName === 'μετρητά' || (!lowerName && type === 'cash')) return 'Cash';
      if (lowerName === 'bank account' || lowerName === 'bank' || lowerName === 'τραπεζικός λογαριασμός' || lowerName === 'τράπεζα' || (!lowerName && type === 'bank')) return 'Bank Account';
      if (lowerName === 'card' || lowerName === 'κάρτα' || (!lowerName && type === 'card')) return 'Card';
      if (lowerName === 'other bank' || lowerName === 'άλλη τράπεζα' || lowerName === 'bank 2' || lowerName === 'bank account 2') return 'Other Bank';
    }
    return name;
  }

  function openAccountPickerModal(target) {
    if (typeof window !== 'undefined' && window.autocompleteJustSelected) return;
    const form = document.getElementById('transaction-form');
    if (form && form.getAttribute('data-readonly') === 'true') return;
    _currentAccountPickerTarget = target;

    const titleEl = document.getElementById('account-picker-title');
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : window.TRANSLATIONS) || {};
    const lang = appState.lang || 'el';

    if (titleEl) {
      const langDict = translations[lang] || {};
      titleEl.textContent = langDict['account_picker_title'] || (lang === 'el' ? 'Επιλογή τρόπου πληρωμής' : 'Select Payment Method');
    }

    renderAccountPickerOptions();
    if (typeof openModal === 'function') {
      openModal('account-picker-modal');
    }
  }

  function renderAccountPickerOptions() {
    if (typeof document === 'undefined') return;
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    const defaultAccounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : window.DEFAULT_ACCOUNTS) || [
      { name: 'Cash', type: 'cash', balance: 0 },
      { name: 'Bank Account', type: 'bank', balance: 0 },
      { name: 'Other Bank', type: 'bank', balance: 0 },
      { name: 'Card', type: 'card', balance: 0 }
    ];

    if (!appState.accounts || appState.accounts.length === 0) {
      appState.accounts = defaultAccounts.slice();
    }
    const container = document.getElementById('account-picker-list');
    if (!container) return;

    container.innerHTML = '';

    const targetInput = document.getElementById(`trans-account-${_currentAccountPickerTarget}`);
    const currentVal = targetInput ? targetInput.value : '';
    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));

    appState.accounts.filter(a => a.is_active !== false).forEach(acc => {
      const item = document.createElement('div');
      item.className = 'account-picker-item';
      if (acc.name === currentVal) {
        item.classList.add('selected');
      }

      const visual = getAccountVisualInfo(acc);
      const displayName = getAccountDisplayName(acc);

      item.innerHTML = `
        <div style="width: 32px; height: 32px; border-radius: 8px; background: ${visual.color}22; border: 1px solid ${visual.color}44; color: ${visual.color}; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px;">
          <i class="${visual.iconClass}"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeFn(displayName)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${appState.lang === 'el' ? visual.labelEl : visual.labelEn}</div>
        </div>
      `;

      item.onclick = () => selectAccountOption(acc.name);
      container.appendChild(item);
    });

    const translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : window.TRANSLATIONS) || {};

    // Quick Bank presets when selecting destination for a Transfer
    if (_currentAccountPickerTarget === 'to') {
      const bankPresets = [
        { name: 'Eurobank', color: '#ef4444' },
        { name: 'Εθνική', color: '#0ea5e9' },
        { name: 'Πειραιώς', color: '#eab308' },
        { name: 'Alpha Bank', color: '#3b82f6' },
        { name: 'Revolut', color: '#ec4899' },
        { name: (appState.lang === 'el' ? 'Άλλη Τράπεζα' : 'Other Bank'), keyName: 'Other Bank', color: '#10b981' }
      ];

      const bankSection = document.createElement('div');
      bankSection.style.cssText = 'margin: 10px 0 6px; padding: 10px; background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px;';

      const bankTitle = document.createElement('div');
      bankTitle.style.cssText = 'font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;';
      bankTitle.innerHTML = `<i class="fa-solid fa-building-columns"></i> <span>${(translations[appState.lang] && translations[appState.lang]['account_picker_bank_transfer']) || (appState.lang === 'el' ? '🏦 Μεταφορά σε Τράπεζα:' : '🏦 Transfer to Bank:')}</span>`;
      bankSection.appendChild(bankTitle);

      const chipsRow = document.createElement('div');
      chipsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

      bankPresets.forEach(preset => {
        const chipBtn = document.createElement('button');
        chipBtn.type = 'button';
        chipBtn.style.cssText = 'padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s;';
        chipBtn.innerHTML = `<span style="color:${preset.color}; font-size:10px;">●</span> <span>${escapeFn(preset.name)}</span>`;
        chipBtn.onclick = (e) => {
          if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
          }
          const targetName = preset.keyName || preset.name;
          let acc = appState.accounts.find(a => a.name.toLowerCase() === targetName.toLowerCase() || (preset.keyName && a.name.toLowerCase() === preset.keyName.toLowerCase()));
          if (!acc) {
            acc = {
              id: (typeof generateSafeUUID === 'function' ? generateSafeUUID() : ('acc_' + Date.now())),
              name: targetName,
              type: 'bank',
              balance: 0,
              is_active: true
            };
            appState.accounts.push(acc);
            try { localStorage.setItem('offline_accounts', JSON.stringify(appState.accounts)); } catch (_) {}
            if (appState.supabaseClient && appState.currentUser) {
              try {
                appState.supabaseClient.from('accounts').insert({
                  id: acc.id,
                  name: acc.name,
                  type: acc.type,
                  balance: 0,
                  user_id: appState.currentUser.id,
                  is_active: true
                });
              } catch (_) {}
            }
          }
          selectAccountOption(acc.name);
        };
        chipsRow.appendChild(chipBtn);
      });
      bankSection.appendChild(chipsRow);
      container.appendChild(bankSection);
    }

    // + New Account option at the bottom
    const newAccBtn = document.createElement('div');
    newAccBtn.className = 'account-picker-item new-acc-item';
    newAccBtn.style.cssText = 'border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 12px; color: #3b82f6; font-weight: 600; display: flex; align-items: center; cursor: pointer;';
    newAccBtn.innerHTML = `
      <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px;">
        <i class="fa-solid fa-plus"></i>
      </div>
      <span style="font-size: 13px;">${(translations[appState.lang] && translations[appState.lang]['account_picker_new']) || '+ Νέος Λογαριασμός...'}</span>
    `;
    newAccBtn.onclick = (e) => {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
      if (typeof closeModal === 'function') closeModal('account-picker-modal');
      if (typeof openAccountEditorModal === 'function') openAccountEditorModal();
    };
    container.appendChild(newAccBtn);
  }

  function selectAccountOption(name) {
    if (typeof document === 'undefined') return;
    const appState = (typeof state !== 'undefined' ? state : window.state) || {};

    // Bank-to-Bank Guard & Auto-resolver:
    // If selecting destination ('to') for a transfer and user chooses the same account as source ('from')
    if (_currentAccountPickerTarget === 'to') {
      const fromEl = document.getElementById('trans-account-from');
      const fromVal = fromEl ? fromEl.value : '';
      if (fromVal && fromVal === name) {
        const acc = (appState.accounts || []).find(a => a.name === name);
        if (acc && (acc.type === 'bank' || (acc.name && acc.name.toLowerCase().includes('bank')) || acc.name === 'Τράπεζα')) {
          let otherBank = (appState.accounts || []).find(a => a.name !== fromVal && (a.type === 'bank' || (a.name && a.name.toLowerCase().includes('bank')) || a.name === 'Other Bank' || a.name === 'Άλλη Τράπεζα'));
          if (!otherBank) {
            otherBank = {
              id: 'acc_other_bank',
              name: 'Other Bank',
              type: 'bank',
              balance: 0,
              is_active: true
            };
            if (!appState.accounts) appState.accounts = [];
            appState.accounts.push(otherBank);
            try { localStorage.setItem('offline_accounts', JSON.stringify(appState.accounts)); } catch (_) {}
          }
          name = otherBank.name;
          const notice = appState.lang === 'el'
            ? '🏦 Επιλέχθηκε "Άλλη Τράπεζα" για τη μεταφορά μεταξύ τραπεζών.'
            : '🏦 Selected "Other Bank" for bank-to-bank transfer.';
          if (typeof showSyncToast === 'function') {
            showSyncToast(notice, 2500);
          }
        }
      }
    }

    const targetId = `trans-account-${_currentAccountPickerTarget}`;
    const el = document.getElementById(targetId);
    if (el) el.value = name;

    updateAccountTriggerDisplay(_currentAccountPickerTarget);
    if (typeof closeModal === 'function') closeModal('account-picker-modal');
  }

  function updateAccountTriggerDisplay(target) {
    if (typeof document === 'undefined') return;
    const input = document.getElementById(`trans-account-${target}`);
    if (!input) return;
    let value = input.value;
    const triggerDisplay = document.getElementById(`trans-account-${target}-display`);
    if (!triggerDisplay) return;

    const appState = (typeof state !== 'undefined' ? state : window.state) || {};
    const defaultAccounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : window.DEFAULT_ACCOUNTS) || [
      { name: 'Cash', type: 'cash', balance: 0 },
      { name: 'Bank Account', type: 'bank', balance: 0 },
      { name: 'Other Bank', type: 'bank', balance: 0 },
      { name: 'Card', type: 'card', balance: 0 }
    ];

    if (!value) {
      if (!appState.accounts || appState.accounts.length === 0) {
        appState.accounts = defaultAccounts.slice();
      }
      const fromVal = document.getElementById('trans-account-from')?.value;
      const defaultAcc = target === 'to'
        ? (appState.accounts.find(a => a.name !== fromVal) || appState.accounts[1] || appState.accounts[0])
        : appState.accounts[0];
      if (defaultAcc) {
        input.value = defaultAcc.name;
        value = defaultAcc.name;
      }
    }

    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str => String(str || ''));
    if (!value) {
      triggerDisplay.innerHTML = `<span class="custom-select-placeholder">${appState.lang === 'el' ? 'Επιλογή...' : 'Select...'}</span>`;
    } else {
      if (!appState.accounts || appState.accounts.length === 0) {
        appState.accounts = defaultAccounts.slice();
      }
      const acc = appState.accounts.find(a => a.name === value);
      const visual = acc ? getAccountVisualInfo(acc) : { iconClass: 'fa-solid fa-wallet', color: '#3b82f6' };
      const name = acc ? getAccountDisplayName(acc) : value;
      triggerDisplay.innerHTML = `<span class="custom-select-icon" style="margin-right: 8px; color: ${visual.color};"><i class="${visual.iconClass}"></i></span><span class="custom-select-text">${escapeFn(name)}</span>`;
    }
  }

  function updateAccountDropdowns() {
    updateAccountTriggerDisplay('from');
    updateAccountTriggerDisplay('to');
  }

  return {
    getAccountVisualInfo,
    getAccountDisplayName,
    openAccountPickerModal,
    renderAccountPickerOptions,
    selectAccountOption,
    updateAccountTriggerDisplay,
    updateAccountDropdowns,
    getCurrentTarget: function () { return _currentAccountPickerTarget; },
    setCurrentTarget: function (t) { _currentAccountPickerTarget = t; }
  };
}));
