// ============================================================
// TRASH BIN & TRANSACTION RECOVERY SUBSYSTEM
// Autonomous UMD Module (Phase 11A Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TrashBinService = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  var window = windowObj;

// Trash Bin Management
function openTrashBinModal() {
  renderTrashBinList();
  openModal('trash-bin-modal');
}

// Fetch deleted transactions (status='deleted') from the cloud into the local
// trash bin. This replaces the legacy deleted_transactions + tombstone mechanism:
// the trash is now a simple query on the transactions table, so it stays
// consistent across all devices (web + APK).
async function fetchTrashFromCloud() {
  if (!state.isSupabaseEnabled || !state.supabaseClient || !state.currentUser) return;
  try {
    const userId = state.currentUser.id;
    const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
    const familyId = state.userProfile ? state.userProfile.family_id : null;

    const trashQuery = state.supabaseClient
      .from('transactions')
      .select('*')
      .eq('status', 'deleted')
      .order('deleted_at', { ascending: false })
      .limit(100);

    const { data, error } = await promiseTimeout(trashQuery, 15000);
    if (error) {
      console.warn('Cloud trash fetch error:', error);
      return;
    }

    // Preserve locally-stored recurring trash groups (is_recurring_group: true).
    // These are NOT rows in the transactions table — they are local-only objects
    // holding the full series snapshot + template backup. The cloud query above
    // only returns individual soft-deleted transactions, so without merging them
    // back in, a recurring group deleted moments ago would vanish from the trash
    // the next time it is opened (until the user leaves and re-enters the tab).
    const recurringGroups = (state.trashTransactions || []).filter(t => t && t.is_recurring_group);

    // IMPORTANT: The Supabase DB may be EMPTY (all data is local on device). The
    // cloud query above returns only soft-deleted rows that exist in the cloud.
    // We must MERGE the cloud results with the locally-stored trash items instead
    // of replacing them — otherwise locally-deleted items (which never reached the
    // cloud) would vanish from the trash the moment it is opened.
    const cloudItems = data || [];
    const cloudIds = new Set(cloudItems.map(t => String(t.id)));
    const localItems = (state.trashTransactions || []).filter(t => t && !t.is_recurring_group && !cloudIds.has(String(t.id)));

    // Merge: recurring groups first (newest deletion on top), then cloud items,
    // then any remaining local-only items that are not already in the cloud.
    state.trashTransactions = [...recurringGroups, ...cloudItems, ...localItems];
    localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

    // Refresh the trash count badge
    const trashCount = state.trashTransactions.length;
    const hubTrashCountEl = document.getElementById('hub-trash-count');
    if (hubTrashCountEl) hubTrashCountEl.textContent = trashCount;
  } catch (err) {
    console.warn('Failed to fetch cloud trash:', err);
  }
}

async function renderTrashBinList() {
  // Pull the latest deleted transactions from the cloud before rendering so the
  // trash stays consistent across devices.
  await fetchTrashFromCloud();

  const container = document.getElementById('trash-bin-list-container');
  if (!container) return;

  container.innerHTML = '';
  const trashItems = state.trashTransactions || [];
  const lang = state.lang || 'el';

  const btnEmpty = document.getElementById('btn-empty-trash');
  if (btnEmpty) {
    btnEmpty.style.display = trashItems.length === 0 ? 'none' : 'flex';
  }

  if (trashItems.length === 0) {
    const emptyMsg = TRANSLATIONS[lang]['no_trash_items'] || 'The trash bin is empty.';
    container.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; line-height: 1.5;">
        ${emptyMsg}
      </div>
    `;
    return;
  }

  // Sort trash items by deleted_at descending (newest deletion first)
  const sortedTrash = [...trashItems].sort((a, b) => {
    return new Date(b.deleted_at || 0) - new Date(a.deleted_at || 0);
  });

  sortedTrash.forEach(t => {
    if (t.is_recurring_group) {
      // Resolve the theme accent at runtime so the recurring-group badge follows
      // the active theme. renderCategoryIconHtml()/hexToRgba() need a concrete
      // hex value, so var(--accent) alone cannot be passed straight through.
      const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6af7';
      const restoreText = TRANSLATIONS[lang]['restore'] || 'Restore';
      const badgeHtml = (typeof renderCategoryIconHtml === 'function')
        ? renderCategoryIconHtml(t.category || '🔄', { size: 'sm', customColor: color })
        : `<div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;"><i class="fa-solid fa-arrows-rotate"></i></div>`;

      const itemHtml = `
        <div class="trash-item-row" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); gap: 12px; box-sizing: border-box; width: 100%;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; flex-direction: row;">
            ${badgeHtml}
            <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
              <span style="font-weight: 700; color: var(--text-primary); font-size: 14px; word-break: break-word; line-height: 1.3;">${t.note || (TRANSLATIONS[lang] && TRANSLATIONS[lang]['recurring_label']) || 'Επαναλαμβανόμενη'}</span>
              <span style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px; word-break: break-word; line-height: 1.2;">
                ${t.subtitle || '🔄 ' + ((TRANSLATIONS[lang] && TRANSLATIONS[lang]['recurring_label']) || 'Επαναλαμβανόμενη')} • ${getCurrencySymbol()} ${formatDisplayAmount(t.amount, t.currency || state.mainCurrency || 'EUR')}
              </span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button class="restore-btn" onclick="restoreTrashGroup('${t.id}')" style="background: var(--primary); border: none; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: opacity 0.2s; outline: none;">
              ${restoreText}
            </button>
            <button onclick="deleteSingleTrashItem('${t.id}')" style="background: transparent; border: none; color: var(--danger); font-size: 13px; cursor: pointer; padding: 6px; border-radius: 6px;" title="${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['permanent_delete']) || 'Οριστική Διαγραφή'}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', itemHtml);
      return;
    }
    // Find category styling
    const catVisual = (typeof getCategoryVisual === 'function')
      ? getCategoryVisual(t.category, t.type)
      : { iconClass: 'fa-solid fa-shapes', color: '#78909c' };
    const color = catVisual.color || '#78909c';
    const badgeHtml = (typeof renderCategoryIconHtml === 'function')
      ? renderCategoryIconHtml(t.category, { size: 'sm', transType: t.type })
      : `<div style="width: 40px; height: 40px; border-radius: 50%; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">${(catVisual.iconClass && typeof renderIconGlyph === 'function') ? renderIconGlyph(catVisual.iconClass) : (catVisual.iconClass ? `<i class="${catVisual.iconClass}"></i>` : '🧩')}</div>`;

    const restoreText = TRANSLATIONS[lang]['restore'] || 'Restore';

    // Format date nicely
    let formattedDate = t.date || '';
    try {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    } catch (e) { }

    const itemHtml = `
      <div class="trash-item-row" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); gap: 12px; box-sizing: border-box; width: 100%;">
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; flex-direction: row;">
          ${badgeHtml}
          <div style="display: flex; flex-direction: column; min-width: 0; text-align: left; flex: 1;">
            <span style="font-weight: 700; color: var(--text-primary); font-size: 14px; word-break: break-word; line-height: 1.3;">${t.note || ''}</span>
            <span style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px; word-break: break-word; line-height: 1.2;">
              ${formattedDate} • ${getCurrencySymbol()} ${formatDisplayAmount(t.amount, t.currency || state.mainCurrency || 'EUR')}
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button class="restore-btn" onclick="restoreTransaction('${t.id}')" style="background: var(--primary); border: none; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: opacity 0.2s; outline: none;">
            ${restoreText}
          </button>
          <button onclick="deleteSingleTrashItem('${t.id}')" style="background: transparent; border: none; color: var(--danger); font-size: 13px; cursor: pointer; padding: 6px; border-radius: 6px;" title="${(TRANSLATIONS[lang] && TRANSLATIONS[lang]['permanent_delete']) || 'Οριστική Διαγραφή'}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', itemHtml);
  });
}

async function restoreTransaction(id) {
  if (!id) return;

  const itemToRestore = (state.trashTransactions || []).find(t => String(t.id) === String(id));
  if (!itemToRestore) return;

  // 1. Remove from trash and permanent deleted tombstones
  state.trashTransactions = (state.trashTransactions || []).filter(t => String(t.id) !== String(id));
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));
  try {
    const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]') || [];
    const filtered = perm.filter(pId => String(pId) !== String(id));
    if (filtered.length !== perm.length) {
      localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(filtered));
    }
  } catch (_) { }

  // Remove deletion markers and explicitly set status='active' before saving
  // back to transactions. Without status='active', the transaction stays
  // status='deleted' and collectPermanentlyDeletedTxIds() immediately excludes it.
  const cleanedItem = { ...itemToRestore };
  delete cleanedItem.deleted_at;
  delete cleanedItem.deleted_by;
  cleanedItem.status = 'active';

  // 2. Add back to transactions (replace if already present, otherwise append)
  const existingIdx = state.transactions.findIndex(t => String(t.id) === String(cleanedItem.id));
  if (existingIdx !== -1) {
    state.transactions[existingIdx] = cleanedItem;
  } else {
    state.transactions.push(cleanedItem);
  }
  localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));

  if (typeof _markRecentlySaved === 'function') {
    _markRecentlySaved(cleanedItem.id);
  }

  // If this transaction was linked to a recurring template, un-blacklist its date
  // so future recurring processing or regeneration doesn't treat it as deleted.
  if (cleanedItem.recurring_template_id && cleanedItem.date) {
    const txDate = String(cleanedItem.date).split('T')[0].split(' ')[0];
    const key = `${cleanedItem.recurring_template_id}_${txDate}`;
    if (state.deletedRecurringDates && state.deletedRecurringDates.includes(key)) {
      state.deletedRecurringDates = state.deletedRecurringDates.filter(k => k !== key);
      localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
    }
    const template = (state.recurringTemplates || []).find(t => String(t.id) === String(cleanedItem.recurring_template_id));
    if (template && template.description && template.description.includes('||deleted_dates:')) {
      const parts = template.description.split('||deleted_dates:');
      const dates = (parts[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const filteredDates = dates.filter(d => d !== txDate);
      template.description = filteredDates.length > 0 ? `${parts[0].trim()} ||deleted_dates:${filteredDates.join(',')}` : parts[0].trim();
      localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
    }
  }

  // 3. Save to Supabase (Cloud Sync) — status model: set status back to 'active'
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    enqueueSyncMutation('upsert', cleanedItem.id);
    try {
      // DUAL-WRITE (Phase 2): remove the legacy deleted_transactions backup row.
      await state.supabaseClient
        .from('deleted_transactions')
        .delete()
        .eq('id', id);

      // Restore by flipping status back to 'active' (no need to re-insert).
      await state.supabaseClient
        .from('transactions')
        .update({ status: 'active', deleted_at: null, deleted_by: null })
        .eq('id', id);
      dequeueSyncMutation('upsert', cleanedItem.id);
    } catch (err) {
      console.warn('Cloud restore failed, keeping in queue:', err);
    }
  }

  // 4. Update UI & re-render
  calculateInitialBalances();
  updateUI();
  renderTrashBinList();
}

async function emptyTrashBin() {
  const lang = state.lang || 'el';
  const confirmMsg = lang === 'el' ? 'Να διαγραφούν οριστικά αυτές οι κινήσεις;' : 'Permanently delete these transactions?';

  const confirmed = await showConfirm(confirmMsg, lang === 'el' ? 'Εκκαθάριση Κάδου' : 'Empty Trash', '🗑️');
  if (!confirmed) return;

  const itemsBeingEmptied = (state.trashTransactions || []).slice();

  // Clear on Supabase if logged in — hard-delete all status='deleted' rows across
  // the SAME scope the trash reads from (user + family + partner).
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    const userId = state.currentUser.id;
    const partnerId = state.partnerProfile ? state.partnerProfile.id : null;
    const familyId = state.userProfile ? state.userProfile.family_id : null;

    let delQuery = state.supabaseClient
      .from('transactions')
      .delete()
      .eq('status', 'deleted');

    if (familyId && partnerId) {
      delQuery = delQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
    } else if (familyId) {
      delQuery = delQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
    } else if (partnerId) {
      delQuery = delQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
    } else {
      delQuery = delQuery.eq('user_id', userId);
    }

    try {
      const { error } = await delQuery;
      if (error) console.warn('Failed to clear deleted transactions on Supabase:', error);
    } catch (err) {
      console.warn('Failed to clear deleted transactions on Supabase:', err);
    }
  }

  // Durable tombstone: purge every emptied ID from all local caches (offline_transactions,
  // sync queue, state) and record a cloud tombstone so no sync path can ever resurrect
  // them (autoSyncMissingTransactionsToCloud, cachedMissingFromCloud, processSyncQueue,
  // realtime, restore).
  try {
    const allEmptiedIds = [];
    itemsBeingEmptied.forEach(t => {
      if (Array.isArray(t.affectedTransactionIds) && t.affectedTransactionIds.length > 0) {
        t.affectedTransactionIds.forEach(tid => allEmptiedIds.push(tid));
      } else if (t.id) {
        allEmptiedIds.push(t.id);
      }
    });
    if (allEmptiedIds.length > 0) {
      purgePermanentlyDeletedTxIds(allEmptiedIds, { writeCloudTombstone: true });
    }
  } catch (err) {
    console.warn('Failed to purge permanently deleted transaction IDs:', err);
  }

  // Save notes of items in trash to dismissed_recovered_templates before emptying
  try {
    let dismissed = JSON.parse(localStorage.getItem('dismissed_recovered_templates') || '[]');
    itemsBeingEmptied.forEach(t => {
      if (t.note && !dismissed.includes(t.note)) {
        dismissed.push(t.note);
      }
    });
    localStorage.setItem('dismissed_recovered_templates', JSON.stringify(dismissed));
  } catch (e) { }

  state.trashTransactions = [];
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

  updateUI();
  renderTrashBinList();
}


async function deleteSingleTrashItem(id) {
  if (!id) return;
  const lang = state.lang || 'el';
  const confirmMsg = lang === 'el' ? 'Να διαγραφούν οριστικά αυτές οι κινήσεις;' : 'Permanently delete these transactions?';
  const confirmed = await showConfirm(confirmMsg, lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanent Delete', '🗑️');
  if (!confirmed) return;

  const itemIndex = (state.trashTransactions || []).findIndex(t => String(t.id) === String(id));
  if (itemIndex === -1) return;

  const item = state.trashTransactions[itemIndex];

  state.trashTransactions.splice(itemIndex, 1);
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

  // Hard-delete the transaction row(s) from the cloud (permanent delete).
  const idsToDelete = Array.isArray(item.affectedTransactionIds) && item.affectedTransactionIds.length > 0
    ? item.affectedTransactionIds
    : [id];
  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      const { error } = await state.supabaseClient.from('transactions').delete().in('id', idsToDelete);
      if (error) console.warn('Failed to delete trash item on Supabase:', error);
    } catch (err) {
      console.warn('Failed to delete trash item on Supabase:', err);
    }
  }

  // Durable tombstone: purge these IDs from every local cache (offline_transactions,
  // sync queue, state) and record a cloud tombstone so no sync path can ever
  // resurrect them (autoSyncMissingTransactionsToCloud, cachedMissingFromCloud,
  // processSyncQueue, realtime, restore).
  try {
    purgePermanentlyDeletedTxIds(idsToDelete, { writeCloudTombstone: true });
  } catch (err) {
    console.warn('Failed to purge permanently deleted transaction IDs:', err);
  }

  renderTrashBinList();
  showSyncToast(lang === 'el' ? '🗑️ Οριστική διαγραφή.' : '🗑️ Permanently deleted.', 2500);
}
window.deleteSingleTrashItem = deleteSingleTrashItem;

async function restoreTrashGroup(groupId) {
  if (!groupId) return;

  const groupIndex = (state.trashTransactions || []).findIndex(t => String(t.id) === String(groupId));
  if (groupIndex === -1) return;

  const group = state.trashTransactions[groupIndex];
  const lang = state.lang || 'el';

  if (group.templateBackup) {
    const existingIdx = (state.recurringTemplates || []).findIndex(t => String(t.id) === String(group.templateId));
    if (existingIdx !== -1) {
      state.recurringTemplates[existingIdx] = group.templateBackup;
    } else {
      state.recurringTemplates.push(group.templateBackup);
    }
    localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
  }

  if (group.deletedRecurringDatesBackup) {
    state.deletedRecurringDates = group.deletedRecurringDatesBackup;
    localStorage.setItem('deleted_recurring_dates', JSON.stringify(state.deletedRecurringDates));
  }

  if (group.affectedTransactionsSnapshot && group.affectedTransactionsSnapshot.length > 0) {
    const existingIds = new Set(state.transactions.map(t => String(t.id)));
    // Synthetic entries (future occurrences captured for a perpetual "forever"
    // series) are NOT real transactions — they are regenerated by the restored
    // template, so skip them on restore.
    const realSnapshot = group.affectedTransactionsSnapshot.filter(tx => !tx._synthetic);
    realSnapshot.forEach(tx => {
      const existingIdx = state.transactions.findIndex(t => String(t.id) === String(tx.id));
      const cleaned = { ...tx };
      delete cleaned.deleted_at;
      delete cleaned.deleted_by;
      delete cleaned._synthetic;
      cleaned.status = 'active';
      if (existingIdx !== -1) {
        state.transactions[existingIdx] = cleaned;
      } else {
        state.transactions.push(cleaned);
      }
      if (typeof _markRecentlySaved === 'function') {
        _markRecentlySaved(cleaned.id);
      }
    });
    localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
    try {
      const perm = JSON.parse(localStorage.getItem('permanent_deleted_tx_ids') || '[]') || [];
      const restoredIds = new Set(realSnapshot.map(t => String(t.id)));
      const filtered = perm.filter(pId => !restoredIds.has(String(pId)));
      if (filtered.length !== perm.length) {
        localStorage.setItem('permanent_deleted_tx_ids', JSON.stringify(filtered));
      }
    } catch (_) { }
  }

  state.trashTransactions.splice(groupIndex, 1);
  localStorage.setItem('deleted_transactions_trash', JSON.stringify(state.trashTransactions));

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    if (group.templateBackup) {
      state.supabaseClient.from('recurring_templates').upsert([mapTemplateToDb(group.templateBackup)]);
    }
    if (group.affectedTransactionsSnapshot && group.affectedTransactionsSnapshot.length > 0) {
      const realSnapshot = group.affectedTransactionsSnapshot.filter(tx => !tx._synthetic);
      if (realSnapshot.length > 0) {
        // Strip client-only fields that do NOT exist as columns in the live DB
        // (verified live: error 42703) so the upsert does not fail with a 400.
        const dbPayloads = realSnapshot.map(tx => {
          const { description, is_shared, photo_local_uri, photo_url, receipt, fx_snapshot, ...clean } = tx;
          clean.status = 'active';
          delete clean.deleted_at;
          delete clean.deleted_by;
          return clean;
        });
        // Restore to cloud. If the server-side cloud limit trigger rejects the
        // insert (free user over the monthly limit), queue each transaction for
        // later sync instead of dropping it — never lose financial data.
        state.supabaseClient.from('transactions').upsert(dbPayloads)
          .then(({ error }) => {
            if (error) {
              console.warn('Cloud restore failed (possibly cloud limit), queueing for later:', error);
              realSnapshot.forEach(tx => enqueueSyncMutation('save', tx));
            }
          }, err => {
            console.warn('Cloud restore failed, queueing for later:', err);
            realSnapshot.forEach(tx => enqueueSyncMutation('save', tx));
          });
      }
    }
  }

  calculateInitialBalances();
  updateUI();
  renderTrashBinList();

  const msg = lang === 'el' ? '🔄 Η επαναφορά ολοκληρώθηκε.' : '🔄 Restoration completed.';
  showSyncToast(msg, 3000);
}
window.restoreTrashGroup = restoreTrashGroup;

  // UMD Exports & Window Binding
  window.openTrashBinModal = openTrashBinModal;
  window.fetchTrashFromCloud = fetchTrashFromCloud;
  window.renderTrashBinList = renderTrashBinList;
  window.restoreTransaction = restoreTransaction;
  window.emptyTrashBin = emptyTrashBin;
  window.deleteSingleTrashItem = deleteSingleTrashItem;
  window.restoreTrashGroup = restoreTrashGroup;

  return {
    openTrashBinModal: openTrashBinModal,
    fetchTrashFromCloud: fetchTrashFromCloud,
    renderTrashBinList: renderTrashBinList,
    restoreTransaction: restoreTransaction,
    emptyTrashBin: emptyTrashBin,
    deleteSingleTrashItem: deleteSingleTrashItem,
    restoreTrashGroup: restoreTrashGroup
  };
}));
