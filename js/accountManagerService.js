// ============================================================
// ACCOUNT MANAGER & CUSTOM ACCOUNTS LOGIC
// Autonomous UMD Module (Phase 16C Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.AccountManagerService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// ACCOUNT MANAGER & CUSTOM ACCOUNTS LOGIC
// ============================================================

function openSettingsAccountManager() {
  renderAccountManagerList();
  openModal('account-manager-modal');
}

function renderAccountManagerList() {
  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = (typeof DEFAULT_ACCOUNTS !== 'undefined' ? DEFAULT_ACCOUNTS : [
      { name: 'Cash', type: 'cash', balance: 0 },
      { name: 'Bank Account', type: 'bank', balance: 0 },
      { name: 'Card', type: 'card', balance: 0 }
    ]).slice();
  }

  const container = document.getElementById('account-manager-list');
  if (!container) return;

  container.innerHTML = '';
  const lang = state.lang || 'el';
  const accounts = state.accounts.filter(a => a.is_active !== false);

  const countLabel = document.getElementById('acc-mgr-count-label');
  if (countLabel) {
    countLabel.textContent = lang === 'el'
      ? `Σύνολο: ${accounts.length} πορτοφόλια`
      : `Total: ${accounts.length} wallets`;
  }

  if (accounts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 14px; font-style: italic;">
        ${lang === 'el' ? 'Δεν βρέθηκαν πορτοφόλια.' : 'No wallets found.'}
      </div>
    `;
    return;
  }

  accounts.forEach(acc => {
    const visual = getAccountVisualInfo(acc);
    const displayName = getAccountDisplayName(acc);
    const safeName = escapeHtml(displayName);
    const balance = parseFloat(acc.balance) || 0;
    const currency = acc.currency || (typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '€');

    const card = document.createElement('div');
    card.className = 'category-mgr-item';
    card.setAttribute('data-account-name', acc.name);
    card.style.cssText = 'background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; transition: background 0.2s;';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
        <i class="fa-solid fa-grip-lines drag-handle-acc" style="color: var(--text-muted); cursor: grab; padding: 4px; font-size: 14px;"></i>
        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${visual.color}22; border: 1px solid ${visual.color}44; color: ${visual.color}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
          <i class="${visual.iconClass}"></i>
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeName}</span>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; background: ${visual.color}22; color: ${visual.color}; border: 1px solid ${visual.color}44;">${lang === 'el' ? visual.labelEl : visual.labelEn}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            ${(typeof formatDisplayAmount === 'function') ? formatDisplayAmount(balance, currency) : balance.toFixed(2)} ${currency}
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button type="button" class="icon-btn btn-edit-acc" style="font-size: 13px; color: var(--text-secondary); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; background: transparent; cursor: pointer;" title="Επεξεργασία">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="icon-btn btn-delete-acc" style="font-size: 13px; color: var(--red-negative); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; background: transparent; cursor: pointer;" title="Διαγραφή">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    card.querySelector('.btn-edit-acc').onclick = () => openAccountEditorModal(acc);
    card.querySelector('.btn-delete-acc').onclick = () => deleteAccountFromManager(acc);

    container.appendChild(card);
  });

  if (window.Sortable) {
    if (container._sortable) { container._sortable.destroy(); }
    container._sortable = Sortable.create(container, {
      animation: 150,
      handle: '.drag-handle-acc',
      onEnd: function () {
        const newOrder = Array.from(container.children).map(el => el.getAttribute('data-account-name')).filter(Boolean);
        const map = new Map(state.accounts.map(a => [a.name, a]));
        const sorted = [];
        newOrder.forEach(name => { if (map.has(name)) sorted.push(map.get(name)); });
        state.accounts.forEach(a => { if (!newOrder.includes(a.name)) sorted.push(a); });
        state.accounts = sorted;
        localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      }
    });
  }
}

function openAccountEditorModal(acc = null) {
  const form = document.getElementById('account-editor-form');
  if (form) form.reset();

  const titleEl = document.getElementById('acc-editor-title');
  const idInput = document.getElementById('acc-editor-id');
  const origNameInput = document.getElementById('acc-editor-orig-name');
  const nameInput = document.getElementById('acc-editor-name');
  const currencySelect = document.getElementById('acc-editor-currency');
  const balanceInput = document.getElementById('acc-editor-balance');

  if (acc) {
    if (titleEl) titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['accounts_edit_account']) || 'Επεξεργασία Πορτοφολιού';
    if (idInput) idInput.value = acc.id || '';
    if (origNameInput) origNameInput.value = acc.name || '';
    if (nameInput) nameInput.value = acc.name || '';
    if (currencySelect) currencySelect.value = acc.currency || 'EUR';
    if (balanceInput) balanceInput.value = acc.balance !== undefined ? acc.balance : '';
    selectAccountEditorType(acc.type || 'bank');
  } else {
    if (titleEl) titleEl.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['accounts_add_account']) || 'Νέο Πορτοφόλι';
    if (idInput) idInput.value = '';
    if (origNameInput) origNameInput.value = '';
    if (nameInput) nameInput.value = '';
    if (currencySelect) currencySelect.value = state.userProfile?.currency || 'EUR';
    if (balanceInput) balanceInput.value = '';
    selectAccountEditorType('bank');
  }

  openModal('account-editor-modal');
}

function selectAccountEditorType(type) {
  const input = document.getElementById('acc-editor-type');
  if (input) input.value = type;

  document.querySelectorAll('#acc-editor-type-group .acc-type-pill').forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.classList.add('active');
      btn.style.borderColor = '#3b82f6';
      btn.style.background = 'rgba(59,130,246,0.15)';
      btn.style.color = 'var(--text-primary)';
    } else {
      btn.classList.remove('active');
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'rgba(255,255,255,0.03)';
      btn.style.color = 'var(--text-secondary)';
    }
  });
}

async function saveAccountEditor(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('acc-editor-id')?.value;
  const origName = document.getElementById('acc-editor-orig-name')?.value;
  const name = document.getElementById('acc-editor-name')?.value.trim();
  const type = document.getElementById('acc-editor-type')?.value || 'bank';
  const currency = document.getElementById('acc-editor-currency')?.value || 'EUR';
  const balance = parseFloat(document.getElementById('acc-editor-balance')?.value) || 0;

  if (!name) return;

  if (!state.accounts) state.accounts = [];

  let accountObj = null;
  if (origName) {
    accountObj = state.accounts.find(a => a.name === origName || (id && a.id === id));
  }

  const userId = state.currentUser ? state.currentUser.id : null;
  const familyId = state.userProfile ? state.userProfile.family_id : null;

  if (accountObj) {
    // Update existing
    const oldName = accountObj.name;
    accountObj.name = name;
    accountObj.type = type;
    accountObj.currency = currency;
    accountObj.balance = balance;

    // If renamed, update transactions referencing old name
    if (oldName !== name) {
      (state.transactions || []).forEach(t => {
        if (t.account_from === oldName) t.account_from = name;
        if (t.account_to === oldName) t.account_to = name;
      });
    }

    if (state.supabaseClient && userId) {
      try {
        if (accountObj.id) {
          await state.supabaseClient.from('accounts').update({
            name: accountObj.name,
            type: accountObj.type,
            currency: accountObj.currency,
            balance: accountObj.balance
          }).eq('id', accountObj.id);
        }
      } catch (err) {
        console.warn('Failed to update account in cloud:', err);
      }
    }
  } else {
    // Create new
    const newAcc = {
      id: crypto.randomUUID ? crypto.randomUUID() : ('acc_' + Date.now()),
      name,
      type,
      currency,
      balance,
      user_id: userId,
      family_id: familyId,
      is_active: true
    };
    state.accounts.push(newAcc);

    if (state.supabaseClient && userId) {
      try {
        await state.supabaseClient.from('accounts').insert([newAcc]);
      } catch (err) {
        console.warn('Failed to insert account in cloud:', err);
      }
    }
  }

  localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));

  closeModal('account-editor-modal');
  renderAccountManagerList();
  renderAccountPickerOptions();
  if (typeof updateAccountDropdowns === 'function') updateAccountDropdowns();
  if (typeof updateUI === 'function') updateUI();

  if (typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? '✓ Το πορτοφόλι αποθηκεύτηκε' : '✓ Wallet saved', 2000);
  }
}

async function deleteAccountFromManager(acc) {
  const name = typeof acc === 'string' ? acc : acc.name;
  const confirmMsg = state.lang === 'el'
    ? `Είσαι σίγουρος ότι θέλεις να διαγράψεις το πορτοφόλι "${getAccountDisplayName(name)}";`
    : `Are you sure you want to delete wallet "${getAccountDisplayName(name)}"?`;

  const confirmed = (typeof showConfirm === 'function')
    ? await showConfirm(confirmMsg, state.lang === 'el' ? 'Διαγραφή Λογαριασμού' : 'Delete Account', 'Διαγραφή')
    : confirm(confirmMsg);

  if (!confirmed) return;

  const targetAcc = state.accounts.find(a => a.name === name || (typeof acc === 'object' && acc.id && a.id === acc.id));
  if (targetAcc) {
    targetAcc.is_active = false;
    state.accounts = state.accounts.filter(a => a !== targetAcc);
  } else {
    state.accounts = state.accounts.filter(a => a.name !== name);
  }

  if (state.supabaseClient && targetAcc && targetAcc.id) {
    try {
      await state.supabaseClient.from('accounts').delete().eq('id', targetAcc.id);
    } catch (err) {
      console.warn('Failed to delete account from cloud:', err);
    }
  }

  localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));

  renderAccountManagerList();
  renderAccountPickerOptions();
  if (typeof updateAccountDropdowns === 'function') updateAccountDropdowns();
  if (typeof updateUI === 'function') updateUI();

  if (typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? '✓ Το πορτοφόλι διαγράφηκε' : '✓ Wallet deleted', 2000);
  }
}

window.openSettingsAccountManager = openSettingsAccountManager;
window.renderAccountManagerList = renderAccountManagerList;
window.openAccountEditorModal = openAccountEditorModal;
window.selectAccountEditorType = selectAccountEditorType;
window.saveAccountEditor = saveAccountEditor;
window.deleteAccountFromManager = deleteAccountFromManager;


function openSettleUpModal() {
  const modal = document.getElementById('settle-up-modal');
  if (!modal) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const myId = state.currentUser ? state.currentUser.id : null;

  if (!state.familyProfiles || state.familyProfiles.length < 2) return;

  const p1 = state.familyProfiles.find(p => p.id === myId) || state.familyProfiles[0];
  const p2 = state.familyProfiles.find(p => p.id !== p1.id) || state.familyProfiles[1];
  const members = [
    { id: p1.id, name: p1.display_name || (p1.email ? p1.email.split('@')[0] : (state.lang === 'el' ? 'Εσύ' : 'You')) },
    { id: p2.id, name: p2.display_name || (p2.email ? p2.email.split('@')[0] : (state.lang === 'el' ? 'Σύντροφος' : 'Partner')) }
  ];

  const sharedTxs = (state.transactions || []).filter(t => {
    if (!t || t.type !== 'expense' || t.is_shared === false) return false;
    if (!t.date) return false;
    const dStr = String(t.date).split('T')[0];
    const parts = dStr.split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[0], 10) === currentYear && (parseInt(parts[1], 10) - 1) === currentMonth;
  });

  const settleData = (typeof SafeToSpendEngine !== 'undefined')
    ? SafeToSpendEngine.calculateCoupleSettleUp(sharedTxs, members)
    : null;

  if (!settleData) return;

  const total = settleData.totalSharedExpenses;
  const m1 = settleData.members[0];
  const m2 = settleData.members[1];
  const settlement = settleData.settlement;
  const isEl = state.lang === 'el';

  const totalEl = document.getElementById('settle-up-modal-total');
  if (totalEl) totalEl.textContent = `€ ${total.toFixed(2).replace('.', ',')}`;

  const p1Label = document.getElementById('settle-up-modal-p1-label');
  const p2Label = document.getElementById('settle-up-modal-p2-label');
  const p1Bar = document.getElementById('settle-up-modal-p1-bar');
  const p2Bar = document.getElementById('settle-up-modal-p2-bar');

  const pct1 = total > 0 ? Math.round((m1.paid / total) * 100) : 50;
  const pct2 = 100 - pct1;

  if (p1Label) p1Label.textContent = `${m1.name}: € ${m1.paid.toFixed(2).replace('.', ',')} (${pct1}%)`;
  if (p2Label) p2Label.textContent = `${m2.name}: € ${m2.paid.toFixed(2).replace('.', ',')} (${pct2}%)`;
  if (p1Bar) p1Bar.style.width = `${pct1}%`;
  if (p2Bar) p2Bar.style.width = `${pct2}%`;

  const verdictBox = document.getElementById('settle-up-modal-verdict-box');
  const recordBtn = document.getElementById('settle-up-record-btn');
  if (verdictBox) {
    if (settlement.amount === 0) {
      verdictBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #10b981;">
          <i class="fa-solid fa-circle-check" style="font-size: 24px;"></i>
          <div>
            <div style="font-weight: 800; font-size: 14px;">${isEl ? 'Πλήρης Ισορροπία (Πάτσι)' : 'Completely Balanced'}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">${isEl ? 'Οι συνεισφορές σας είναι 50/50. Δεν απαιτείται καμία πληρωμή.' : 'Contributions are exactly 50/50.'}</div>
          </div>
        </div>
      `;
      if (recordBtn) recordBtn.style.display = 'none';
    } else {
      const isOwed = settlement.to.id === myId;
      verdictBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">
              ${isOwed ? (isEl ? 'Σου οφείλονται:' : 'You are owed:') : (isEl ? 'Πρέπει να πληρώσεις:' : 'You need to pay:')}
            </div>
            <div style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; color: #fbbf24;">
              € ${settlement.amount.toFixed(2).replace('.', ',')}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
            <div>${escapeHtml(settlement.from.name)} ➔ ${escapeHtml(settlement.to.name)}</div>
          </div>
        </div>
      `;
      if (recordBtn) {
        recordBtn.style.display = 'flex';
        recordBtn.innerHTML = `
          <i class="fa-solid fa-hand-holding-dollar"></i>
          <span>${isEl ? `Εξόφληση € ${settlement.amount.toFixed(2).replace('.', ',')}` : `Settle Up € ${settlement.amount.toFixed(2)}`}</span>
        `;
      }
    }
  }

  const listEl = document.getElementById('settle-up-modal-tx-list');
  if (listEl) {
    if (sharedTxs.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">${isEl ? 'Δεν υπάρχουν κοινές συναλλαγές αυτόν τον μήνα.' : 'No shared transactions this month.'}</div>`;
    } else {
      listEl.innerHTML = sharedTxs.slice(0, 15).map(tx => {
        const payerName = tx.user_id === m1.id ? m1.name : m2.name;
        const note = tx.note || tx.description || tx.category || (isEl ? 'Έξοδο' : 'Expense');
        const amt = (typeof CurrencyService !== 'undefined' && typeof CurrencyService.toBase === 'function')
          ? CurrencyService.toBase(tx)
          : (typeof tx.amount === 'number' ? Math.abs(tx.amount) : parseFloat(tx.amount) || 0);
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; font-size: 12px;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 600; color: #fff;">${escapeHtml(note)}</span>
              <span style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(payerName)} • ${tx.date ? String(tx.date).split('T')[0] : ''}</span>
            </div>
            <span style="font-weight: 700; color: #f87171;">- € ${amt.toFixed(2).replace('.', ',')}</span>
          </div>
        `;
      }).join('');
    }
  }

  openModal('settle-up-modal');
}

function recordSettlementTransaction() {
  closeModal('settle-up-modal');
  if (typeof openAddTransactionModal === 'function') {
    openAddTransactionModal('transfer');
  }
}

window.openSettleUpModal = openSettleUpModal;
window.recordSettlementTransaction = recordSettlementTransaction;


  // Window Bindings
  window.openSettingsAccountManager = openSettingsAccountManager;
  window.renderAccountManagerList = renderAccountManagerList;
  window.openAccountEditorModal = openAccountEditorModal;
  window.selectAccountEditorType = selectAccountEditorType;
  window.saveAccountEditor = saveAccountEditor;
  window.deleteAccountFromManager = deleteAccountFromManager;
  window.openSettleUpModal = openSettleUpModal;
  window.recordSettlementTransaction = recordSettlementTransaction;

  return {
    openSettingsAccountManager: openSettingsAccountManager,
    renderAccountManagerList: renderAccountManagerList,
    openAccountEditorModal: openAccountEditorModal,
    selectAccountEditorType: selectAccountEditorType,
    saveAccountEditor: saveAccountEditor,
    deleteAccountFromManager: deleteAccountFromManager,
    openSettleUpModal: openSettleUpModal,
    recordSettlementTransaction: recordSettlementTransaction
  };
}));
