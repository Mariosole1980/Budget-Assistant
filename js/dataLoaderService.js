/**
 * ============================================================
 * DATA LOADER & OFFLINE CACHE SUBSYSTEM
 * ------------------------------------------------------------
 * Handles instant local cache data hydration (offline-first)
 * and Supabase cloud synchronization (incremental & full sync).
 *
 * Extracted from app.js (Phase 28A Architectural Modularization)
 * ============================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DataLoaderService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  
  function deduplicateCategories() {
    if (typeof window !== 'undefined' && typeof window.deduplicateCategories === 'function' && window.deduplicateCategories !== deduplicateCategories) {
      return window.deduplicateCategories();
    }
    const s = getState();
    if (!s || !s.categories) return;
    const seen = new Set();
    s.categories = s.categories.filter(c => {
      if (!c || !c.name) return false;
      const key = (c.type || 'expense') + '|' + c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getState() {
    return (typeof window !== 'undefined' && window.state) ? window.state : {};
  }

async function loadData() {
  // Cancel any pending realtime debounce timer to prevent stale DB events
  // from overwriting the fresh data we are about to fetch.
  if (typeof _realtimeDebounceTimer !== 'undefined' && _realtimeDebounceTimer) {
    clearTimeout(_realtimeDebounceTimer);
    _realtimeDebounceTimer = null;
    if (typeof _pendingRealtimeEvents !== 'undefined') _pendingRealtimeEvents = [];
  } else if (typeof window !== 'undefined' && window._realtimeDebounceTimer) {
    clearTimeout(window._realtimeDebounceTimer);
    window._realtimeDebounceTimer = null;
    if (window._pendingRealtimeEvents) window._pendingRealtimeEvents = [];
  }

  // PRIVACY/ISOLATION: In guest mode, never fetch or load a previous account's
  // personal data from the cloud. Guest mode always starts with a clean slate.
  if (state.guestMode) {
    loadOfflineData();
    if (typeof updateHeaderSyncIcon === 'function') updateHeaderSyncIcon('offline'); else if (typeof window !== 'undefined' && typeof window.updateHeaderSyncIcon === 'function') window.updateHeaderSyncIcon('offline');
    return;
  }

  // 1. INSTANT LOCAL CACHE LOAD (0ms):
  // Immediately load cached data into memory and render the UI.
  // The user sees all transactions, accounts, categories, and balances INSTANTLY
  // on cold start without waiting for any network round-trip.
  loadOfflineData();
  if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
  if (typeof updateUI === 'function') updateUI(); else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') window.updateUI();

  if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
    try {
      if (typeof updateHeaderSyncIcon === 'function') updateHeaderSyncIcon('syncing'); else if (typeof window !== 'undefined' && typeof window.updateHeaderSyncIcon === 'function') window.updateHeaderSyncIcon('syncing');

      // Process offline queue first (flushes offline deletes/saves) before fetching latest transactions
      await processSyncQueue({ skipReload: true });

      const userId = state.currentUser.id;
      const partnerId = state.partnerProfile ? state.partnerProfile.id : null;

      // Fetch categories & accounts first
      const familyId = state.userProfile ? state.userProfile.family_id : null;
      let catsQuery = state.supabaseClient.from('categories').select('*');
      let accsQuery = state.supabaseClient.from('accounts').select('*');
      let tempsQuery = state.supabaseClient.from('recurring_templates').select('*');

      if (familyId && partnerId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (familyId) {
        const filter = `family_id.eq.${familyId},user_id.eq.${userId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else if (partnerId) {
        const filter = `user_id.eq.${userId},user_id.eq.${partnerId}`;
        catsQuery = catsQuery.or(filter);
        accsQuery = accsQuery.or(filter);
        tempsQuery = tempsQuery.or(filter);
      } else {
        catsQuery = catsQuery.eq('user_id', userId);
        accsQuery = accsQuery.eq('user_id', userId);
        tempsQuery = tempsQuery.eq('user_id', userId);
      }

      const [catsRes, accsRes, tempsRes] = await promiseTimeout(
        Promise.all([
          catsQuery,
          accsQuery,
          tempsQuery.then(r => r, () => ({ data: [], error: null }))
        ]),
        15000
      );
      if (catsRes.error) throw catsRes.error;
      if (accsRes.error) throw accsRes.error;

      // Fetch all transactions with pagination (due to Supabase PostgREST default 1000 limit)
      let allTransactions = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let transQuery = state.supabaseClient
          .from('transactions')
          .select('*')
          .eq('status', 'active')
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (familyId) {
          if (partnerId) {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId},user_id.eq.${partnerId}`);
          } else {
            transQuery = transQuery.or(`family_id.eq.${familyId},user_id.eq.${userId}`);
          }
        } else if (partnerId) {
          transQuery = transQuery.or(`user_id.eq.${userId},user_id.eq.${partnerId}`);
        } else {
          transQuery = transQuery.eq('user_id', userId);
        }

        const { data: pageData, error: pageErr } = await promiseTimeout(
          transQuery,
          15000
        );
        if (pageErr) throw pageErr;

        if (pageData && pageData.length > 0) {
          allTransactions = allTransactions.concat(pageData);
          if (pageData.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // DATA-INTEGRITY SELF-HEALING: The cloud is the source of truth for what is
      // active. Clean any stale local tombstone/trash entries that claim a
      // cloud-active transaction was permanently deleted (this is what caused
      // "dozens of transactions disappeared from web after refresh").
      try {
        reconcileStaleTombstones(allTransactions);
      } catch (reconcileErr) {
        console.warn('[DataIntegrity] reconcileStaleTombstones failed in loadData:', reconcileErr);
      }

      let categories = catsRes.data || [];
      let accounts = accsRes.data || [];
      if (tempsRes && tempsRes.data) {
        const cloudTemps = tempsRes.data.map(mapTemplateFromDb);
        state.recurringTemplates = mergeAndDeduplicateTemplates(cloudTemps, state.recurringTemplates);
        cleanDuplicateTemplates();
        localStorage.setItem('recurring_templates', JSON.stringify(state.recurringTemplates));
      }

      // Pre-populate standard categories in the cloud for this user if they don't have any
      if (!categories || categories.length === 0) {
        const now = new Date().toISOString();
        const catsToInsert = DEFAULT_CATEGORIES.map(c => ({
          id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          user_id: userId,
          family_id: familyId,
          created_at: now,
          updated_at: now
        }));
        try {
          const { data: newCats, error: catErr } = await state.supabaseClient.from('categories').insert(catsToInsert).select();
          if (!catErr && newCats && newCats.length > 0) {
            categories = newCats;
          } else {
            console.warn('Failed to pre-populate categories:', catErr);
            categories = DEFAULT_CATEGORIES.slice();
          }
        } catch (e) {
          console.warn('Failed to pre-populate categories catch:', e);
          categories = DEFAULT_CATEGORIES.slice();
        }
      }

      // Pre-populate standard accounts in the cloud for this user if they don't have any
      if (!accounts || accounts.length === 0) {
        const now = new Date().toISOString();
        const accsToInsert = DEFAULT_ACCOUNTS.map(a => ({
          id: typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID(),
          name: a.name,
          type: a.type,
          balance: a.balance,
          user_id: userId,
          family_id: familyId,
          created_at: now,
          updated_at: now
        }));
        try {
          const { data: newAccs, error: accErr } = await state.supabaseClient.from('accounts').insert(accsToInsert).select();
          if (!accErr && newAccs && newAccs.length > 0) {
            accounts = newAccs;
          } else {
            console.warn('Failed to pre-populate accounts:', accErr);
            accounts = DEFAULT_ACCOUNTS.slice();
          }
        } catch (e) {
          console.warn('Failed to pre-populate accounts catch:', e);
          accounts = DEFAULT_ACCOUNTS.slice();
        }
      }

      // Preserve pending local transactions that failed to sync (offline fallback),
      // so they are not lost when fresh cloud data overwrites local cache.
      //
      // ACCOUNT-ISOLATION (fix): The offline cache is NOT account-scoped, so when a
      // user signs into a DIFFERENT account, the previous account's unsynced local
      // transactions would otherwise be merged into this account's data (a
      // cross-account data leak). We only preserve/merge pending local transactions
      // when the cache belongs to the current user (or is unowned guest/legacy data).
      const cachedOwner = localStorage.getItem('offline_transactions_owner');
      const cacheBelongsToCurrentUser = !cachedOwner || cachedOwner === userId;
      const getPendingFn = (typeof getPendingLocalTransactions === 'function')
        ? getPendingLocalTransactions
        : ((typeof window !== 'undefined' && typeof window.getPendingLocalTransactions === 'function')
          ? window.getPendingLocalTransactions
          : ((typeof TransactionMerge !== 'undefined' && typeof TransactionMerge.getPendingLocalTransactions === 'function')
            ? TransactionMerge.getPendingLocalTransactions
            : () => []));
      const pendingLocal = cacheBelongsToCurrentUser
        ? getPendingFn(JSON.parse(localStorage.getItem('offline_transactions') || '[]'))
        : [];

      // Auto-rescue & sync any local transactions missing in the cloud
      const missingSynced = await autoSyncMissingTransactionsToCloud(allTransactions, userId);
      if (missingSynced && missingSynced.length > 0) {
        allTransactions = [...allTransactions, ...missingSynced];
      }

      // Deduplicate merged transactions (ID-based only — content-based dedup was
      // removed because it destroyed legitimate identical transactions).
      const cachedForMerge = cacheBelongsToCurrentUser
        ? (JSON.parse(localStorage.getItem('offline_transactions') || '[]') || [])
        : [];
      const updatedCloudIds = new Set(allTransactions.map(t => String(t.id)));
      const cachedMissingFromCloud = cachedForMerge.filter(t =>
        !(t && t.id && updatedCloudIds.has(String(t.id)))
      );
      // Durable tombstone guard: never reintroduce a permanently-deleted transaction
      // from the offline cache into state (defense-in-depth; the merge also excludes
      // these IDs via deps.permanentlyDeletedTxIds).
      let permanentlyDeletedSet = null;
      try {
        if (typeof collectPermanentlyDeletedTxIds === 'function') {
          permanentlyDeletedSet = new Set(Array.from(collectPermanentlyDeletedTxIds()).map(String));
        } else if (typeof window !== 'undefined' && typeof window.collectPermanentlyDeletedTxIds === 'function') {
          permanentlyDeletedSet = new Set(Array.from(window.collectPermanentlyDeletedTxIds()).map(String));
        }
      } catch (err) {
        console.warn('Failed to collect permanently deleted IDs in loadData merge:', err);
      }
      const safeCachedMissingFromCloud = (permanentlyDeletedSet
        ? cachedMissingFromCloud.filter(t => !(t && t.id && permanentlyDeletedSet.has(String(t.id))))
        : cachedMissingFromCloud
      ).filter(t => {
        if (!t || !t.id) return false;
        const isRecurringOrigin = !!(t.recurring_template_id || String(t.id).startsWith('recurring_') || (typeof isTransactionRecurring === 'function' && isTransactionRecurring(t)));
        if (isRecurringOrigin && t.date) {
          const tMonth = String(t.date).slice(0, 7);
          const tAmount = (parseFloat(t.amount) || 0).toFixed(2);
          const tNote = normalizeGreekString(t.note || t.description || '');
          const hasCloudOccurrenceInSameMonth = allTransactions.some(cTx => {
            if (!cTx || !cTx.date || String(cTx.date).slice(0, 7) !== tMonth) return false;
            if (t.recurring_template_id && cTx.recurring_template_id && String(t.recurring_template_id) === String(cTx.recurring_template_id)) return true;
            const cAmount = (parseFloat(cTx.amount) || 0).toFixed(2);
            const cNote = normalizeGreekString(cTx.note || cTx.description || '');
            return cAmount === tAmount && cTx.type === t.type && isSameCategory(cTx.category, t.category) && tNote.length > 0 && cNote === tNote;
          });
          if (hasCloudOccurrenceInSameMonth) {
            return false;
          }
        }
        return true;
      });
      const mergeFn = (typeof mergeAndDeduplicateTransactions === 'function')
        ? mergeAndDeduplicateTransactions
        : ((typeof window !== 'undefined' && typeof window.mergeAndDeduplicateTransactions === 'function')
          ? window.mergeAndDeduplicateTransactions
          : ((typeof TransactionMerge !== 'undefined' && typeof TransactionMerge.mergeAndDeduplicateTransactions === 'function')
            ? TransactionMerge.mergeAndDeduplicateTransactions
            : (c, l) => [...(c || []), ...(l || [])]));
      const compareFn = (typeof compareTransactions === 'function')
        ? compareTransactions
        : ((typeof window !== 'undefined' && typeof window.compareTransactions === 'function')
          ? window.compareTransactions
          : (a, b) => new Date((b && b.date) || 0) - new Date((a && a.date) || 0));

      const mergedTransactions = mergeFn(allTransactions, [...pendingLocal, ...safeCachedMissingFromCloud]);
      mergedTransactions.sort(compareFn);
      state.transactions = mergedTransactions;

      // Merge categories: retain any local custom categories that haven't synced to cloud yet
      const cloudCatNames = new Set((categories || []).map(c => c && c.name ? c.name.trim().toLowerCase() : ''));
      const localCustomCats = (state.categories || []).filter(c => c && c.name && !cloudCatNames.has(c.name.trim().toLowerCase()));
      state.categories = [...(categories || []), ...localCustomCats];
      deduplicateCategories();

      // If there are unsynced local categories, sync them to cloud in background
      if (localCustomCats.length > 0 && state.supabaseClient && userId) {
        localCustomCats.forEach(localCat => {
          const now = new Date().toISOString();
          state.supabaseClient.from('categories').insert({
            id: localCat.id || (typeof generateUUID === 'function' ? generateUUID() : crypto.randomUUID()),
            user_id: userId,
            family_id: familyId,
            name: localCat.name,
            type: localCat.type || 'expense',
            icon: localCat.icon || '💸',
            color: localCat.color || '#78909c',
            hidden: !!localCat.hidden,
            created_at: localCat.created_at || now,
            updated_at: localCat.updated_at || now
          }).then(({ error }) => { if (error) console.warn('Background sync category warning:', error); });
        });
      }

      state.accounts = accounts;

      if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();

      autoRecoverTemplatesFromHistory();

      // Link existing transactions to their recurring templates (content-key
      // backfill) so the recurring delete options appear from the transaction
      // modal even for transactions saved before recurring_template_id was kept.
      backfillRecurringTemplateIds();

      // Clean up any cross-language duplicate templates or duplicate recurring transactions
      if (typeof cleanCrossLanguageRecurringDuplicates === 'function') cleanCrossLanguageRecurringDuplicates(); else if (typeof window !== 'undefined' && typeof window.cleanCrossLanguageRecurringDuplicates === 'function') window.cleanCrossLanguageRecurringDuplicates();

      localStorage.setItem('offline_transactions', JSON.stringify(state.transactions));
      localStorage.setItem('offline_accounts', JSON.stringify(state.accounts));
      localStorage.setItem('offline_categories', JSON.stringify(state.categories));
      // ACCOUNT-ISOLATION: Attribute the local cache to the current user so a
      // later sign-in with a DIFFERENT account does not import/merge this data.
      localStorage.setItem('offline_transactions_owner', userId);

      // Establish incremental sync cursor baseline from full fetch
      try {
        if (typeof getSyncCursors === 'function' && typeof saveSyncCursors === 'function') {
          const cursors = getSyncCursors();
          const nextCursors = { ...cursors };
          if (allTransactions.length > 0) {
            let maxTs = '';
            let maxId = '';
            for (let i = 0; i < allTransactions.length; i++) {
              const tx = allTransactions[i];
              const txTs = tx.updated_at || tx.created_at || '';
              if (txTs && (!maxTs || txTs > maxTs)) {
                maxTs = txTs;
                maxId = tx.id || '';
              }
            }
            nextCursors.transactions = maxTs ? { ts: maxTs, id: maxId } : { ts: new Date().toISOString(), id: '00000000-0000-0000-0000-000000000000' };
          } else {
            nextCursors.transactions = { ts: new Date(0).toISOString(), id: '00000000-0000-0000-0000-000000000000' };
          }
          saveSyncCursors(nextCursors);
          if (typeof markFullSyncDone === 'function') markFullSyncDone();
        }
      } catch (_) { }

      if (typeof updateHeaderSyncIcon === 'function') updateHeaderSyncIcon('synced'); else if (typeof window !== 'undefined' && typeof window.updateHeaderSyncIcon === 'function') window.updateHeaderSyncIcon('synced');
      if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
      pushNoTransition();
      if (typeof updateUI === 'function') updateUI(); else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') window.updateUI();
      window._initialDataLoaded = true;
      setTimeout(() => {
        popNoTransition();
      }, 1000);

      // Run automatic duplicate / corrupt category cleanup in background
      cleanDuplicateCategories().catch(e => console.warn('Automatic categories cleanup error:', e));

      // NOTE: cleanDuplicateTransactions no longer needed here since we dedup inline above.
      // It is kept available for manual/sync-triggered calls only.

      // Try to flush pending local items in background without blocking UI.
      if (pendingLocal.length > 0) {
        syncLocalTransactionsToCloud(userId, { silent: true }).catch(() => { });
      }
    } catch (err) {
      console.error('Supabase fetch failed, falling back to offline cache:', err);
      // Load from cache and show offline state (not error) so user knows data is still visible
      loadOfflineData();
      if (typeof updateHeaderSyncIcon === 'function') updateHeaderSyncIcon('offline'); else if (typeof window !== 'undefined' && typeof window.updateHeaderSyncIcon === 'function') window.updateHeaderSyncIcon('offline');
      if (typeof updateUI === 'function') updateUI(); else if (typeof window !== 'undefined' && typeof window.updateUI === 'function') window.updateUI();
      if (err && typeof showSyncToast === 'function') {
        const errorMsg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
        showSyncToast('⚠️ Σφάλμα συγχρονισμού: ' + errorMsg, 8000);
      }
    }
  } else {
    if (typeof updateHeaderSyncIcon === 'function') updateHeaderSyncIcon('offline'); else if (typeof window !== 'undefined' && typeof window.updateHeaderSyncIcon === 'function') window.updateHeaderSyncIcon('offline');
    loadOfflineData();
  }
}

function loadOfflineData() {
  // PRIVACY/ISOLATION: In guest mode, never load a previous account's cached
  // personal data (transactions, accounts, categories, recurring templates,
  // notes, trash, notifications). Guest mode must always start with a clean
  // slate. The cached data stays in localStorage so it is preserved for when
  // the user logs back into their own account.
  const isGuest = !!state.guestMode;

  if (isGuest) {
    state.currentUser = null;
    state.partnerProfile = null;
    state.userProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    // PRIVACY/ISOLATION: Guest mode starts with a clean slate, so we never load a
    // previous account's personal data. However, DEMO data (is_demo / demo_ id) that
    // the guest explicitly added via onboardingAddDemoData() must be preserved — it is
    // guest-owned sample data, not another account's private data. Without this, the
    // demo transactions/budgets are wiped the moment loadData() -> loadOfflineData()
    // runs right after they are created, so the Demo Mode appears broken for guests.
    const isDemoItem = (it) => it && (it.is_demo || (it.id && String(it.id).startsWith('demo_')));
    try {
      const cachedTxs = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      state.transactions = Array.isArray(cachedTxs) ? cachedTxs.filter(isDemoItem) : [];
    } catch (e) {
      state.transactions = [];
    }
    try {
      const cachedBudgets = JSON.parse(localStorage.getItem('cached_budgets') || '[]');
      state.budgets = Array.isArray(cachedBudgets) ? cachedBudgets.filter(isDemoItem) : [];
    } catch (e) {
      state.budgets = [];
    }
    state.accounts = DEFAULT_ACCOUNTS.slice();
    state.categories = DEFAULT_CATEGORIES.slice();
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.trashTransactions = [];
    state.notifications = [];
    state.notes = [];
    if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
    return;
  }

  try {
    const cachedUser = localStorage.getItem('cached_current_user');
    if (cachedUser) {
      state.currentUser = JSON.parse(cachedUser);
    }
  } catch (e) {
    console.error('Failed to parse cached current user:', e);
  }
  try {
    const cachedPartner = localStorage.getItem('cached_partner_profile');
    if (cachedPartner) {
      state.partnerProfile = JSON.parse(cachedPartner);
    }
  } catch (e) {
    console.error('Failed to parse cached partner profile:', e);
  }
  try {
    const cachedProfile = localStorage.getItem('cached_user_profile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      // PRIVACY/ISOLATION: Only restore the cached profile if it belongs to the
      // cached current user. A previous account's state must not leak.
      if (parsedProfile && state.currentUser && state.currentUser.id) {
        if (parsedProfile.id === state.currentUser.id) {
          state.userProfile = parsedProfile;
        } else {
          localStorage.removeItem('cached_user_profile');
        }
      } else if (parsedProfile) {
        state.userProfile = parsedProfile;
      }
    }
  } catch (e) {
    console.error('Failed to parse cached user profile:', e);
  }
  try {
    const cachedFamily = localStorage.getItem('cached_family_profiles');
    state.familyProfiles = cachedFamily ? JSON.parse(cachedFamily) : [];
  } catch (e) {
    console.error('Failed to parse cached family profiles:', e);
    state.familyProfiles = [];
  }
  try {
    const cachedGroup = localStorage.getItem('cached_family_group');
    state.familyGroup = cachedGroup ? JSON.parse(cachedGroup) : null;
  } catch (e) {
    console.error('Failed to parse cached family group:', e);
    state.familyGroup = null;
  }

  try {
    if (!state.currentUser && !localStorage.getItem('cached_current_user')) {
      state.transactions = getOfflineGuestTransactions();
    } else {
      const trans = localStorage.getItem('offline_transactions');
      state.transactions = trans ? JSON.parse(trans) : [];
    }
  } catch (e) {
    console.error('Failed to parse offline transactions:', e);
    state.transactions = [];
  }
  try {
    const accs = localStorage.getItem('offline_accounts');
    const parsedAccs = accs ? JSON.parse(accs) : null;
    state.accounts = (Array.isArray(parsedAccs) && parsedAccs.length > 0) ? parsedAccs : DEFAULT_ACCOUNTS.slice();
  } catch (e) {
    console.error('Failed to parse offline accounts:', e);
    state.accounts = DEFAULT_ACCOUNTS.slice();
  }
  try {
    const cats = localStorage.getItem('offline_categories');
    const parsedCats = cats ? JSON.parse(cats) : null;
    state.categories = (Array.isArray(parsedCats) && parsedCats.length > 0) ? parsedCats : DEFAULT_CATEGORIES.slice();
    deduplicateCategories();
  } catch (e) {
    console.error('Failed to parse offline categories:', e);
    state.categories = DEFAULT_CATEGORIES.slice();
    deduplicateCategories();
  }

  // PRIVACY/ISOLATION: Only load recurring templates into memory when there is an
  // actual (cached or active) user. When the app is on the login screen / guest
  // boot, a stale 'recurring_templates' cache from a previous account must never
  // be loaded, otherwise processRecurringTemplates() below would regenerate that
  // account's recurring transactions into the unowned guest cache
  // (offline_guest_transactions) — leaking personal data into the next guest session.
  const hasUserContext = !!(state.currentUser || localStorage.getItem('cached_current_user'));
  try {
    const temps = hasUserContext ? localStorage.getItem('recurring_templates') : null;
    state.recurringTemplates = temps ? JSON.parse(temps) : [];
  } catch (e) {
    console.error('Failed to parse recurring templates:', e);
    state.recurringTemplates = [];
  }
  try {
    const deleted = hasUserContext ? localStorage.getItem('deleted_recurring_dates') : null;
    state.deletedRecurringDates = deleted ? JSON.parse(deleted) : [];
  } catch (e) {
    console.error('Failed to parse deleted recurring dates:', e);
    state.deletedRecurringDates = [];
  }
  try {
    const trash = localStorage.getItem('deleted_transactions_trash');
    const parsedTrash = trash ? JSON.parse(trash) : [];
    const currentUid = state.currentUser ? state.currentUser.id : (localStorage.getItem('cached_current_user') ? JSON.parse(localStorage.getItem('cached_current_user')).id : null);
    if (currentUid) {
      state.trashTransactions = parsedTrash.filter(t => !t || !t.user_id || t.user_id === currentUid || (state.partnerProfile && t.user_id === state.partnerProfile.id) || (state.userProfile && t.family_id && t.family_id === state.userProfile.family_id));
    } else {
      state.trashTransactions = parsedTrash.filter(t => !t || !t.user_id);
    }
  } catch (e) {
    console.error('Failed to parse deleted transactions trash:', e);
    state.trashTransactions = [];
  }
  try {
    const notifs = localStorage.getItem('state_notifications') || localStorage.getItem('money_manager_notifications');
    state.notifications = notifs ? JSON.parse(notifs) : [];
  } catch (e) {
    console.error('Failed to parse notifications:', e);
    state.notifications = [];
  }

  if (typeof loadNotes === 'function') loadNotes(); else if (typeof window !== 'undefined' && typeof window.loadNotes === 'function') window.loadNotes();
  if (typeof loadBudgets === 'function') loadBudgets(); else if (typeof window !== 'undefined' && typeof window.loadBudgets === 'function') window.loadBudgets();

  if (typeof cleanCrossLanguageRecurringDuplicates === 'function') cleanCrossLanguageRecurringDuplicates(); else if (typeof window !== 'undefined' && typeof window.cleanCrossLanguageRecurringDuplicates === 'function') window.cleanCrossLanguageRecurringDuplicates();
  // PRIVACY/ISOLATION: Only generate recurring occurrences when an actual user is
  // present. With no user (logged out / login screen / guest boot) this function
  // would write the generated transactions into the unowned guest cache via
  // saveTransactionOffline(), leaking a previous account's recurring data into the
  // next guest session.
  if (state.currentUser || localStorage.getItem('cached_current_user')) {
    if (typeof processRecurringTemplates === 'function') processRecurringTemplates(); else if (typeof window !== 'undefined' && typeof window.processRecurringTemplates === 'function') window.processRecurringTemplates();
  }
  if (typeof cleanCrossLanguageRecurringDuplicates === 'function') cleanCrossLanguageRecurringDuplicates(); else if (typeof window !== 'undefined' && typeof window.cleanCrossLanguageRecurringDuplicates === 'function') window.cleanCrossLanguageRecurringDuplicates();
  if (typeof calculateInitialBalances === 'function') calculateInitialBalances(); else if (typeof window !== 'undefined' && typeof window.calculateInitialBalances === 'function') window.calculateInitialBalances();
  if (typeof cleanDuplicateCategories === 'function') { cleanDuplicateCategories().catch(e => console.warn('Offline automatic categories cleanup error:', e)); } else if (typeof window !== 'undefined' && typeof window.cleanDuplicateCategories === 'function') { window.cleanDuplicateCategories().catch(e => console.warn('Offline automatic categories cleanup error:', e)); }
}

  return {
    loadData,
    loadOfflineData
  };
}));
