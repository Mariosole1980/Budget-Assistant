/**
 * Budget Assistant - Selection Service Module
 * Multi-selection mode, batch selection, select all, and bulk deletion
 * Extracted from app.js (Phase 14C Modularization)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

function enterSelectionMode() {
  ensureHistoryPushed();
  state.selectionMode = true;
  state.selectedIds.clear();

  const bar = document.getElementById('selection-bar');
  if (bar) bar.classList.add('active');

  const fab = document.getElementById('fab-btn');
  if (fab) fab.classList.add('hidden');

  updateNoteShortcutVisibility();
  updateSelectionHeader();
  renderTransactionsTab();
}

function exitSelectionMode() {
  state.selectionMode = false;
  state.selectedIds.clear();

  const bar = document.getElementById('selection-bar');
  if (bar) bar.classList.remove('active');

  const fab = document.getElementById('fab-btn');
  if (fab) fab.classList.remove('hidden');

  updateNoteShortcutVisibility();
  renderTransactionsTab();
}

function toggleSelection(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }
  updateSelectionHeader();
  renderTransactionsTab();
}

function updateSelectionHeader() {
  const countSpan = document.getElementById('selection-count');
  if (countSpan) {
    countSpan.textContent = `${state.selectedIds.size} ${(TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['selection_count_text']) || 'επιλεγμένα'}`;
  }
}

function getVisibleTransactionIds() {
  const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
  let start, end;
  if (monthStartDay === 1) {
    start = new Date(state.selectedYear, state.selectedMonth, 1, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(state.selectedYear, state.selectedMonth, monthStartDay, 0, 0, 0, 0);
    end = new Date(state.selectedYear, state.selectedMonth + 1, monthStartDay - 1, 23, 59, 59, 999);
  }

  return state.transactions.filter(t => {
    if (!t.date) return false;
    const tDate = new Date(String(t.date).replace(' ', 'T'));
    return tDate >= start && tDate <= end;
  }).map(t => t.id);
}

function toggleSelectAll() {
  const visibleIds = getVisibleTransactionIds();
  const allSelected = visibleIds.every(id => state.selectedIds.has(id));

  if (allSelected) {
    visibleIds.forEach(id => state.selectedIds.delete(id));
  } else {
    visibleIds.forEach(id => state.selectedIds.add(id));
  }
  updateSelectionHeader();
  renderTransactionsTab();
}

async function deleteSelectedTransactions() {
  const selectedIds = Array.from(state.selectedIds);
  if (selectedIds.length === 0) return;

  // Recurring-aware multi-delete:
  // If the selection contains ANY recurring transaction, route it through the
  // recurring delete modal so the 3 options (only selected / selected + future /
  // whole series) ALWAYS appear — even when several recurring transactions are
  // selected at once. Non-recurring selections are carried along and deleted
  // together with the chosen scope.
  const selectedTxns = (state.transactions || []).filter(t => selectedIds.some(id => String(id) === String(t.id)));
  const recurringSelected = [];
  const recurringIds = new Set();
  selectedTxns.forEach(tx => {
    if (tx && resolveRecurringTemplateForTx(tx)) {
      recurringSelected.push(tx);
      recurringIds.add(String(tx.id));
    }
  });
  const plainSelectedIds = selectedIds.filter(id => !recurringIds.has(String(id)));

  if (recurringSelected.length === 1 && plainSelectedIds.length === 0) {
    // Exactly one recurring transaction (nothing else selected) → keep the
    // original single-item 3-option modal flow.
    exitSelectionMode();
    setTimeout(() => {
      openRecurringDeleteModal(recurringSelected[0], String(recurringSelected[0].date || '').split('T')[0].split(' ')[0], { instant: true });
    }, 100);
    return;
  }
  if (recurringSelected.length >= 1) {
    // Multiple recurring transactions and/or a mix of recurring + regular ones →
    // use the bulk-aware 3-option modal so the user still chooses what happens
    // to the recurring series (the regular selected ones are deleted too).
    exitSelectionMode();
    setTimeout(() => {
      openRecurringDeleteModal(recurringSelected, null, { instant: true, plainSelectedIds: plainSelectedIds });
    }, 100);
    return;
  }

  const count = selectedIds.length;
  const isEl = (state.lang === 'el');
  let msg;
  if (count === 1) {
    msg = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['confirm_delete_selected_singular']) ||
      (isEl ? 'Να διαγραφεί η επιλεγμένη συναλλαγή;' : 'Delete the selected transaction?');
  } else {
    const template = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['confirm_delete_transactions_plural']) ||
      (isEl ? 'Να διαγραφούν οι {count} επιλεγμένες συναλλαγές;' : 'Delete {count} selected transactions?');
    msg = template.replace('{count}', count);
  }
  const title = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['btn_delete']) || (isEl ? 'Διαγραφή' : 'Delete');
  const confirmed = await showConfirm(msg, title, '🗑️');
  if (!confirmed) return;

  // Find duplicates of all selected transactions to delete them too
  const idsToDeleteSet = new Set(selectedIds.map(String));

  selectedIds.forEach(id => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx) {
      const txDate = String(tx.date || '').split('T')[0].split(' ')[0];
      const txAmount = (parseFloat(tx.amount) || 0).toFixed(2);
      state.transactions.forEach(t => {
        if (t.id && t.id !== id) {
          const tDate = String(t.date || '').split('T')[0].split(' ')[0];
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const isDupe = tDate === txDate &&
            tAmount === txAmount &&
            t.type === tx.type &&
            t.category === tx.category &&
            (t.account_from || '') === (tx.account_from || '') &&
            (t.account_to || '') === (tx.account_to || '') &&
            (t.note || '') === (tx.note || '') &&
            (t.user_id || '') === (tx.user_id || '');
          if (isDupe) {
            idsToDeleteSet.add(String(t.id));
          }
        }
      });
    }
  });

  const idsToDelete = Array.from(idsToDeleteSet);

  // Save deleted transactions to Trash
  try {
    const deletedTxs = state.transactions.filter(t => idsToDelete.includes(String(t.id)));
    deletedTxs.forEach(t => {
      state.trashTransactions = state.trashTransactions || [];
      const alreadyInTrash = state.trashTransactions.some(tt => String(tt.id) === String(t.id));
      if (!alreadyInTrash) {
        const trashItem = { ...t, deleted_at: new Date().toISOString() };
        state.trashTransactions.push(trashItem);
      }
    });
    if (state.trashTransactions.length > 100) {
      state.trashTransactions = state.trashTransactions.slice(-100);
    }
    localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));
  } catch (err) {
    console.warn('Failed to save deleted transactions to trash:', err);
  }

  // 1. Suppress realtime events (safe helper: auto-releases via setTimeout,
  //    immune to early returns/throws leaving the counter stuck)
  suppressRealtimeFor(8000);

  // 2. Process each transaction deletion locally & trigger background sync/delete
  for (const id of idsToDelete) {
    _deletingTxIds.add(String(id));

    // Clean up local receipt photo from IndexedDB
    ReceiptStorage.remove(id).catch(err => {
      console.warn('Failed to remove receipt during transaction delete:', err);
    });

    // Optimistically delete from local state (updates state.transactions and deletedRecurringDates)
    deleteTransactionOffline(id, true);
  }
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  // Perform background delete in bulk
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    // Enqueue immediately before starting the cloud request to prevent data loss if the app is closed/killed
    idsToDelete.forEach(id => enqueueSyncMutation('delete', id));

    (async () => {
      try {
        // Status model: soft-delete via status='deleted' instead of hard delete.
        const { error } = await promiseTimeout(
          state.supabaseClient
            .from('transactions')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString(),
              deleted_by: state.currentUser.id
            })
            .in('id', idsToDelete),
          12000
        );
        if (error) throw error;
        idsToDelete.forEach(id => dequeueSyncMutation('delete', id));
      } catch (err) {
        console.warn(`Cloud delete failed for selected, keeping in queue:`, idsToDelete, err);
      } finally {
        idsToDelete.forEach(id => _deletingTxIds.delete(String(id)));
      }
    })();
  } else {
    idsToDelete.forEach(id => _deletingTxIds.delete(String(id)));
  }

  // 3. Clear selection and exit selection mode
  exitSelectionMode();

  // 4. Update calculations and render UI once
  calculateInitialBalances();
  updateUI();

  // 5. Re-enable realtime after enough time (handled by suppressRealtimeFor above)
}

window.enterSelectionMode = enterSelectionMode;
window.exitSelectionMode = exitSelectionMode;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelectedTransactions = deleteSelectedTransactions;

  if (typeof window !== 'undefined') {
    window.enterSelectionMode = enterSelectionMode;
    window.exitSelectionMode = exitSelectionMode;
    window.toggleSelection = toggleSelection;
    window.updateSelectionHeader = updateSelectionHeader;
    window.getVisibleTransactionIds = getVisibleTransactionIds;
    window.toggleSelectAll = toggleSelectAll;
    window.deleteSelectedTransactions = deleteSelectedTransactions;
  }

  return {
    enterSelectionMode: enterSelectionMode,
    exitSelectionMode: exitSelectionMode,
    toggleSelection: toggleSelection,
    updateSelectionHeader: updateSelectionHeader,
    getVisibleTransactionIds: getVisibleTransactionIds,
    toggleSelectAll: toggleSelectAll,
    deleteSelectedTransactions: deleteSelectedTransactions
  };
}));
