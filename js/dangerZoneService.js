// ============================================================
// DANGER ZONE & DESTRUCTIVE ACTIONS SUBSYSTEM
// Autonomous UMD Module (Phase 17D Architectural Extraction)
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
    rootObj.DangerZoneService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

function clearCacheAndReset() {
  if (typeof forceAppUpdate === 'function') {
    forceAppUpdate();
  }
}
window.clearCacheAndReset = clearCacheAndReset;

// ============================================================
// CLEAR DATA & DELETE ACCOUNT (with safety locks)
// ============================================================

// Generic PIN prompt modal -> resolves with the entered PIN string, or null if cancelled.
// ============================================================
// CLEAR DATA & DELETE ACCOUNT SAFETY PROMPTS
// Extracted to js/dialogService.js (Phase 5 Architectural Domain Extraction)
// ============================================================
// 🗑️ Clear Local Data - PIN if exists, otherwise type "ΔΙΑΓΡΑΦΗ"
async function clearLocalDataConfirm() {
  const hasPin = localStorage.getItem('app_pin') && localStorage.getItem('app_lock_enabled') === 'true';

  if (hasPin) {
    const pin = await promptForPin(
      state.lang === 'el' ? 'Εισάγετε το PIN σας για να εκκαθαρίσετε τα τοπικά δεδομένα.' : 'Enter your PIN to clear local data.',
      state.lang === 'el' ? 'Εκκαθάριση Τοπικών Δεδομένων' : 'Clear Local Data'
    );
    if (!pin) return;
    const savedPin = localStorage.getItem('app_pin');
    if (pin !== savedPin) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Λάθος PIN!' : 'Incorrect PIN!'), 3000);
      return;
    }
  } else {
    const requiredWord = state.lang === 'el' ? 'ΔΙΑΓΡΑΦΗ' : 'DELETE';
    const confirmed = await promptForTypedConfirmation(
      state.lang === 'el'
        ? 'Θα διαγραφούν όλα τα δεδομένα που είναι αποθηκευμένα στη συσκευή. Η ενέργεια δεν μπορεί να αναιρεθεί.'
        : 'All data stored on this device will be deleted. This action cannot be undone.',
      requiredWord,
      state.lang === 'el' ? 'Εκκαθάριση Τοπικών Δεδομένων' : 'Clear Local Data'
    );
    if (!confirmed) return;
  }

  // Perform the local data wipe (keep user logged in)
  try {
    const keysToRemove = [
      'cached_current_user', 'cached_partner_profile',
      'offline_transactions', 'offline_accounts', 'offline_categories', 'offline_transactions_owner',
      'bg_active_modal_id', 'bg_active_modal_tx_id', 'bg_active_subcat_txs', 'bg_modal_scroll_top',
      'advisor_conversations', 'active_advisor_conversation_id',
      'notes_cache', 'recurring_templates_cache', 'trash_cache'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    state.transactions = [];
    state.trashTransactions = [];
    state.accounts = [];
    state.categories = [];
    state.notes = [];
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.notifications = [];

    // Close any open modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    updateUI();
    showSyncToast("🗑️ " + (state.lang === 'el' ? 'Τα τοπικά δεδομένα εκκαθαρίστηκαν.' : 'Local data cleared.'), 3000);

    // Re-sync from cloud if logged in
    if (state.supabaseClient && state.currentUser) {
      setTimeout(() => { forceSyncNow(true); }, 600);
    }
  } catch (err) {
    console.error('Clear local data error:', err);
    showSyncToast("❌ " + (state.lang === 'el' ? 'Σφάλμα κατά την εκκαθάριση.' : 'Error while clearing.'), 3000);
  }
}
window.clearLocalDataConfirm = clearLocalDataConfirm;

// ⚠️ Delete Account - PIN if exists, otherwise type "ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ"
async function deleteAccountConfirm() {
  const hasPin = localStorage.getItem('app_pin') && localStorage.getItem('app_lock_enabled') === 'true';

  if (hasPin) {
    const pin = await promptForPin(
      state.lang === 'el' ? 'Εισάγετε το PIN σας για να διαγράψετε τον λογαριασμό.' : 'Enter your PIN to delete your account.',
      state.lang === 'el' ? 'Διαγραφή Πορτοφολιού' : 'Delete Wallet'
    );
    if (!pin) return;
    const savedPin = localStorage.getItem('app_pin');
    if (pin !== savedPin) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Λάθος PIN!' : 'Incorrect PIN!'), 3000);
      return;
    }
  } else {
    const requiredWord = state.lang === 'el' ? 'ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ' : 'DELETE ACCOUNT';
    const confirmed = await promptForTypedConfirmation(
      state.lang === 'el'
        ? 'Θα διαγραφεί ο λογαριασμός σας και όλα τα δεδομένα σας από το cloud. Η ενέργεια δεν μπορεί να αναιρεθεί.'
        : 'Your account and all your data will be permanently deleted from the cloud. This action cannot be undone.',
      requiredWord,
      state.lang === 'el' ? 'Διαγραφή Λογαριασμού' : 'Delete Account',
      state.lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanently Delete'
    );
    if (!confirmed) return;
  }

  // Final confirmation
  const finalConfirm = await showConfirm(
    state.lang === 'el'
      ? 'Είστε απόλυτα σίγουροι; Ο λογαριασμός και όλα τα δεδομένα θα διαγραφούν οριστικά.'
      : 'Are you absolutely sure? Your account and all data will be permanently deleted.',
    state.lang === 'el' ? 'Οριστική Διαγραφή' : 'Permanent Deletion',
    '⚠️'
  );
  if (!finalConfirm) return;

  try {
    let session = null;
    if (state.supabaseClient) {
      const { data } = await state.supabaseClient.auth.getSession();
      session = data && data.session;
    }
    if (!session || !session.access_token) {
      showSyncToast("❌ " + (state.lang === 'el' ? 'Δεν υπάρχει ενεργή σύνδεση.' : 'No active session.'), 3000);
      return;
    }

    showSyncToast("⏳ " + (state.lang === 'el' ? 'Διαγραφή λογαριασμού...' : 'Deleting account...'), 0);

    const res = await fetch(getBackendApiUrl('/api/delete-account'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      }
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      // Localize the family-membership block message (server returns it in English only).
      let errorText = result.error || res.status;
      if (result.code === 'FAMILY_MEMBERSHIP_REQUIRED') {
        errorText = state.lang === 'el'
          ? 'Δεν μπορείτε να διαγράψετε τον λογαριασμό σας όσο είστε μέλος μιας οικογενειακής ομάδας. Αποχωρήστε πρώτα από την ομάδα (ή μεταφέρετε τα δικαιώματα διαχειριστή σε άλλο μέλος αν είστε ο μόνος διαχειριστής) και δοκιμάστε ξανά.'
          : 'Cannot delete account while you are a member of a family group. Please leave the family group first (or transfer admin to another member if you are the only admin), then try again.';
      }
      showSyncToast("❌ " + (state.lang === 'el' ? 'Αποτυχία διαγραφής: ' : 'Deletion failed: ') + errorText, 4000);
      return;
    }

    // Clear all local data and log out
    localStorage.clear();
    state.transactions = [];
    state.trashTransactions = [];
    state.accounts = [];
    state.categories = [];
    state.notes = [];
    state.currentUser = null;
    state.userProfile = null;
    state.partnerProfile = null;
    state.familyProfiles = [];
    state.familyGroup = null;
    state.recurringTemplates = [];
    state.deletedRecurringDates = [];
    state.notifications = [];
    state.guestMode = false;

    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    updateUI();
    showSyncToast("✅ " + (state.lang === 'el' ? 'Ο λογαριασμός διαγράφηκε.' : 'Account deleted.'), 3000);

    // Show auth UI
    const authOverlay = document.getElementById('auth-overlay');
    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');
    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';
  } catch (err) {
    console.error('Delete account error:', err);
    showSyncToast("❌ " + (state.lang === 'el' ? 'Σφάλμα κατά τη διαγραφή.' : 'Error during deletion.'), 4000);
  }
}
window.deleteAccountConfirm = deleteAccountConfirm;

  // Window Bindings
  window.clearCacheAndReset = clearCacheAndReset;
  window.clearLocalDataConfirm = clearLocalDataConfirm;
  window.deleteAccountConfirm = deleteAccountConfirm;

  return {
    clearCacheAndReset: clearCacheAndReset,
    clearLocalDataConfirm: clearLocalDataConfirm,
    deleteAccountConfirm: deleteAccountConfirm
  };
}));
