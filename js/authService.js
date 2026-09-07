/**
 * ============================================================
 * AUTHENTICATION & SUPABASE AUTH CONTROLLER SUBSYSTEM
 * ============================================================
 * Handles Supabase client initialization, auth listeners, session verification,
 * OAuth & magic link callbacks, user profile loading, and family invitation prompts.
 *
 * Extracted from app.js (Phase 21A Architectural Modularization)
 * ============================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AuthService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _promiseTimeout(promise, ms) {
    if (typeof promiseTimeout === 'function') return promiseTimeout(promise, ms);
    if (typeof window !== 'undefined' && typeof window.promiseTimeout === 'function') {
      return window.promiseTimeout(promise, ms);
    }
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Promise timed out')), ms))
    ]);
  }

function loadConfig() {
  // Database credentials are strictly hardcoded in state.supabaseConfig.
  state.isSupabaseEnabled = true;
}

function initSupabase() {
  if (state.isSupabaseEnabled && window.supabase) {
    try {
      state.supabaseClient = window.supabase.createClient(
        state.supabaseConfig.url,
        state.supabaseConfig.key,
        {
          auth: {
            flowType: 'implicit',
            autoRefreshToken: true,
            persistSession: true
          }
        }
      );
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge online';
        syncBadge.textContent = 'Cloud Sync ✓';
      }
      updateHeaderSyncIcon('syncing');
      // Initialize authentication flow
      initSupabaseAuth();
    } catch (err) {
      console.error('Supabase init failed:', err);
      state.isSupabaseEnabled = false;
      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) {
        syncBadge.className = 'sync-badge offline';
        syncBadge.textContent = 'Offline';
      }
      updateHeaderSyncIcon('error');
    }
  } else {
    const syncBadge = document.getElementById('sync-badge');
    if (syncBadge) {
      syncBadge.className = 'sync-badge offline';
      syncBadge.textContent = 'Local Mode';
    }
    updateHeaderSyncIcon('offline');
  }
}

function toggleLoader(show) {
  const loadingState = document.getElementById('auth-loading-state');
  const authCard = document.getElementById('auth-card');
  if (show) {
    if (loadingState) loadingState.style.display = 'flex';
    if (authCard) authCard.style.display = 'none';
  } else {
    if (loadingState) loadingState.style.display = 'none';
    if (authCard) authCard.style.display = 'flex';
  }
}
window.toggleLoader = toggleLoader;

function initSupabaseAuth() {
  if (!state.supabaseClient) return;

  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  const inviteRole = urlParams.get('role');
  if (inviteCode) {
    localStorage.setItem('pending_invite_code', inviteCode.trim().toUpperCase());
    if (inviteRole) {
      localStorage.setItem('pending_invite_role', inviteRole.trim().toLowerCase());
    } else {
      localStorage.removeItem('pending_invite_role');
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // Debug-only auth logging. Disabled in production to reduce console noise and
  // avoid logging potentially sensitive auth/session details.
  const AUTH_DEBUG = false;
  function logAuthDebug(msg) {
    if (AUTH_DEBUG) console.log('[AuthDebug]', msg);
  }

  // Global error handler to capture runtime JS errors and display them in the debug overlay
  window.addEventListener('error', (event) => {
    logAuthDebug(`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`);
    console.error('Runtime error:', event.error);
  });

  logAuthDebug('Starting auth checks...');

  const hashStr = window.location.hash || '';
  const searchStr = window.location.search || '';

  const urlKeys = [];
  if (hashStr) {
    const hashParams = new URLSearchParams(hashStr.substring(1));
    for (const key of hashParams.keys()) {
      urlKeys.push(`hash:${key}`);
    }
  }
  if (searchStr) {
    const searchParams = new URLSearchParams(searchStr);
    for (const key of searchParams.keys()) {
      urlKeys.push(`query:${key}`);
    }
  }
  logAuthDebug(`URL components: ${urlKeys.join(', ') || 'none'}`);

  const isAuthRedirect = hashStr.includes('access_token=') ||
    hashStr.includes('id_token=') ||
    hashStr.includes('error=') ||
    searchStr.includes('code=') ||
    searchStr.includes('error=');


  let processingRedirect = isAuthRedirect;
  logAuthDebug(`Is redirect callback: ${isAuthRedirect}`);

  const authOverlay = document.getElementById('auth-overlay');
  const loadingState = document.getElementById('auth-loading-state');
  const formsContainer = document.getElementById('auth-forms-container');
  const authCard = document.getElementById('auth-card');

  if (isAuthRedirect) {
    if (authOverlay) authOverlay.style.display = 'flex';
    toggleLoader(true);
    if (formsContainer) formsContainer.style.display = 'none';

    // Safety timeout to prevent getting stuck
    setTimeout(() => {
      if (processingRedirect && !state.currentUser && !state.guestMode) {
        logAuthDebug('TIMEOUT: Auth redirect timed out (6s).');
        console.warn('Auth redirect timed out or failed. Restoring login form.');
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        showAuthStatus(state.lang === 'el'
          ? '⚠️ Η σύνδεση καθυστερεί ή απέτυχε. Δοκιμάστε ξανά.'
          : '⚠️ Login is taking too long or failed. Please try again.');
      }
    }, 6000);
  }

  // We delay early style removal until session verification is fully resolved to prevent background page flashing.

  if (hashStr.includes('error=') || searchStr.includes('error=')) {
    const rawParams = hashStr.includes('error=') ? hashStr.substring(1) : searchStr.substring(1);
    const params = new URLSearchParams(rawParams);
    const error = params.get('error');
    let errorDescription = params.get('error_description') || error;
    if (errorDescription) {
      errorDescription = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      logAuthDebug(`Error in redirect: ${error} - ${errorDescription}`);
      let errorMsg = '';
      if (error === 'identity_provider_email_conflict') {
        errorMsg = state.lang === 'el'
          ? '❌ Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκιμάστε να συνδεθείτε με email/κωδικό.'
          : '❌ An account with this email already exists. Try logging in with email/password.';
      } else {
        errorMsg = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + errorDescription;
      }

      processingRedirect = false;
      toggleLoader(false);
      if (formsContainer) formsContainer.style.display = 'block';
      showAuthStatus(errorMsg);
      // Clean URL hash so it doesn't reappear on refresh
      window.history.replaceState(null, null, window.location.pathname);
    }
  }

  // Global unhandled promise rejection handler during authentication
  window.addEventListener('unhandledrejection', (event) => {
    logAuthDebug(`Unhandled promise rejection: ${event.reason}`);
    console.warn('Unhandled promise rejection:', event.reason);
    const reason = event.reason;
    if (reason && (reason.message || reason.error_description || String(reason).includes('Auth') || String(reason).includes('token'))) {
      const msg = reason.message || reason.error_description || String(reason);
      // ONLY show auth error overlay if user is actively in the login flow / redirect
      // and NOT already logged in with cached credentials or guest mode
      const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
      if (processingRedirect || !hasCachedUser) {
        processingRedirect = false;
        toggleLoader(false);
        if (formsContainer) formsContainer.style.display = 'block';
        showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_unhandled']) || '❌ Σφάλμα (Unhandled): ') + msg);
      }
    }
  });

  logAuthDebug('Fetching current session...');
  // Fetch session explicitly to capture any errors during initialization or OAuth code/hash exchange
  state.supabaseClient.auth.getSession().then(({ data, error }) => {
    const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
    if (error) {
      logAuthDebug(`getSession error: ${error.message || error}`);
      console.error('Supabase getSession error:', error);
      // If we have cached credentials / offline session, do NOT show the login overlay on getSession error!
      if (hasCachedUser) {
        logAuthDebug('getSession error ignored; maintaining offline cached session.');
        hideAuthOverlay();
        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();
        const earlyHideStyle = document.getElementById('early-auth-hide-style');
        if (earlyHideStyle) earlyHideStyle.remove();
        return;
      }
      processingRedirect = false;
      toggleLoader(false);
      // SECURITY/UX: Even on a session-check error the user is NOT authenticated,
      // so we MUST show the login overlay. Removing early-auth-style without
      // re-showing the overlay left the app on a blank screen with only the lock
      // icon on fresh installs / when no valid session existed.
      if (authOverlay) authOverlay.style.display = 'flex';
      if (formsContainer) formsContainer.style.display = 'block';
      if (authCard) authCard.style.display = 'flex';
      if (loadingState) loadingState.style.display = 'none';
      showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_auth']) || '❌ Σφάλμα ταυτοποίησης: ') + (error.message || error));
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
    } else {
      logAuthDebug(`getSession resolved. Session exists: ${!!(data && data.session)}`);
      if (data && data.session && (window.location.hash || window.location.search)) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      if (!data || !data.session) {
        // If we have cached credentials, keep the offline session active!
        if (hasCachedUser) {
          logAuthDebug('No active network session from getSession, but cached user exists -> keeping offline session active.');
          hideAuthOverlay();
          const earlyStyle = document.getElementById('early-auth-style');
          if (earlyStyle) earlyStyle.remove();
          const earlyHideStyle = document.getElementById('early-auth-hide-style');
          if (earlyHideStyle) earlyHideStyle.remove();
          return;
        }
        // Only show login forms if onAuthStateChange hasn't already logged us in
        if (!state.currentUser && !state.guestMode) {
          showAuthOverlay();
        }
      } else if (data.session && data.session.user) {
        // Fallback for browsers where INITIAL_SESSION event may be delayed/missed
        state.session = data.session;
        state.currentUser = data.session.user;
        // SECURITY: Session verified valid - safe to render this user's data.
        window._authConfirmed = true;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        hideAuthOverlay();
        if (!window._initialDataLoaded) {
          loadData().then(() => { window._initialDataLoaded = true;
      if (typeof checkAndPromptAppReview === 'function') checkAndPromptAppReview(); }).catch(console.error);
        }
      }
    }
  }).catch(err => {
    logAuthDebug(`getSession catch error: ${err.message || err}`);
    console.error('Supabase getSession catch error:', err);
    const hasCachedUser = !!(localStorage.getItem('cached_current_user') || state.currentUser || state.guestMode);
    if (hasCachedUser) {
      logAuthDebug('getSession catch error ignored; maintaining offline cached session.');
      hideAuthOverlay();
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
      return;
    }
    processingRedirect = false;
    toggleLoader(false);
    // SECURITY/UX: Same as the error path above - the user is NOT authenticated,
    // so we MUST show the login overlay instead of leaving a blank screen.
    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_auth']) || '❌ Σφάλμα ταυτοποίησης: ') + (err.message || err));
    const earlyStyle = document.getElementById('early-auth-style');
    if (earlyStyle) earlyStyle.remove();
    const earlyHideStyle = document.getElementById('early-auth-hide-style');
    if (earlyHideStyle) earlyHideStyle.remove();
  });

  logAuthDebug('Subscribing to onAuthStateChange...');
  state.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    logAuthDebug(`Auth Event Fired: ${event}, Session: ${!!session}`);

    if (state.isLoggingOut) {
      logAuthDebug('Sign-out in progress, ignoring auth state change.');
      return;
    }

    // ANTI-FLICKER FIX (resume flash): A background TOKEN_REFRESHED is NOT a login.
    // It fires silently whenever the Supabase auth client auto-refreshes a
    // near-expiry access token (e.g. after the app was backgrounded long enough
    // that the token had to be rotated). Running the full login pipeline below
    // (updateUI -> loadUserProfiles -> forceSyncNow) would trigger a full DOM
    // re-render cascade right after resume - exactly when the user is watching -
    // and the CSS transition guard (_RESUME_GUARD_MS) has already expired. For a
    // silent token refresh we only keep the session identity in sync and silently
    // refresh the authoritative profile, WITHOUT any visible re-render.
    if (event === 'TOKEN_REFRESHED') {
      if (session && session.user) {
        state.session = session;
        state.currentUser = session.user;
        window._authConfirmed = true;
        localStorage.setItem('cached_current_user', JSON.stringify(session.user));
        // Silent background refresh of the server-side profile (premium/family
        // status). Updates state + small badge/banner elements only - never a
        // full UI re-render, so it cannot cause a visible flash on resume.
        loadUserProfiles(session.user);
      }
      logAuthDebug('TOKEN_REFRESHED: silent session keep-alive, no re-render.');
      return;
    }

    if (session && session.user) {
      processingRedirect = false;
      state.session = session;
      const cachedRawUser = localStorage.getItem('cached_current_user');
      let previousUserId = null;
      try {
        if (cachedRawUser) previousUserId = JSON.parse(cachedRawUser).id;
      } catch (e) { }

      // ANTI-FLICKER: If this user is ALREADY active with data loaded in memory,
      // subsequent SIGNED_IN / INITIAL_SESSION events (e.g. from tab resume/focus)
      // are keep-alives and must NOT re-trigger the entire cold-boot login sequence
      // or re-run loadData(), which would momentarily wipe and rebuild the DOM.
      const isSameUserAlreadyLoaded = !!(
        window._initialDataLoaded &&
        previousUserId &&
        previousUserId === session.user.id &&
        state.currentUser &&
        state.currentUser.id === session.user.id
      );

      if (isSameUserAlreadyLoaded) {
        logAuthDebug(`${event}: session re-affirmed for active user, skipping full reload.`);
        loadUserProfiles(session.user);
        return;
      }

      if (previousUserId && previousUserId !== session.user.id) {
        window._initialDataLoaded = false;
        // User account changed! Clean previous user's local caches & trash
        state.trashTransactions = [];
        // IMPORTANT: Reset in-memory user/partner/family state immediately so a
        // previous account's cached premium/family data cannot bleed into the
        // new account (isPremium() reads state.userProfile).
        state.userProfile = null;
        state.partnerProfile = null;
        state.familyProfiles = [];
        state.familyGroup = null;
        localStorage.removeItem('deleted_transactions_trash');
        localStorage.removeItem('offline_transactions');
        localStorage.removeItem('cached_partner_profile');
        localStorage.removeItem('cached_user_profile');
        localStorage.removeItem('cached_family_profiles');
        localStorage.removeItem('cached_family_group');
        localStorage.removeItem('sync_cursors_v1');
        localStorage.removeItem('sync_last_full_ts');
      }

      state.currentUser = session.user;
      // SECURITY: Session verified valid - safe to render this user's data.
      window._authConfirmed = true;
      localStorage.setItem('cached_current_user', JSON.stringify(session.user));

      // Force-reset any in-memory profile that does not belong to the CURRENT
      // session user. This is the final guard: even if loadOfflineData restored
      // a previous account's cached premium/family data before the session was
      // confirmed, it is discarded now so isPremium() can never report a stale
      // entitlement for the wrong account.
      if (state.userProfile && state.userProfile.id !== session.user.id) {
        state.userProfile = null;
      }
      if (state.partnerProfile && state.partnerProfile.id === session.user.id) {
        state.partnerProfile = null;
      }

      // Load cached partner and user profile if available
      try {
        const cachedPartner = localStorage.getItem('cached_partner_profile');
        if (cachedPartner) {
          state.partnerProfile = JSON.parse(cachedPartner);
        }
        const cachedUser = localStorage.getItem('cached_user_profile');
        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            // CRITICAL: Only restore the cached profile if it belongs to the
            // CURRENT user. Without this check, a previous account's cached
            // premium/family state can leak into a newly logged-in account
            // (e.g. "already PRO" shown on an account that never paid).
            if (parsedUser && parsedUser.id === session.user.id) {
              state.userProfile = parsedUser;
            } else {
              localStorage.removeItem('cached_user_profile');
            }
          } catch (e) {
            localStorage.removeItem('cached_user_profile');
          }
        }
        const cachedFamily = localStorage.getItem('cached_family_profiles');
        if (cachedFamily) {
          state.familyProfiles = JSON.parse(cachedFamily);
        }
        const cachedGroup = localStorage.getItem('cached_family_group');
        if (cachedGroup) {
          state.familyGroup = JSON.parse(cachedGroup);
        }
        const cachedMode = localStorage.getItem('account_view_mode');
        if (cachedMode === 'personal' || cachedMode === 'family') {
          state.activeAccountMode = cachedMode;
        }
        const cachedMember = localStorage.getItem('selected_family_member_id');
        if (cachedMember) {
          state.selectedFamilyMemberId = cachedMember;
        }
      } catch (e) {
        console.error('Failed to parse cached profiles:', e);
      }

      // Clear guest mode state
      state.guestMode = false;
      localStorage.removeItem('auth_guest_mode');

      // Clear URL parameters so they don't persist or trigger reload loops
      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, null, window.location.pathname);
      }

      // Hide auth overlay & reset elements
      hideAuthOverlay();
      // Modals should NOT be force-closed here since we want to restore them on resume/boot
      // if (typeof window.forceCloseAllModals === 'function') window.forceCloseAllModals();

      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => {
          if (typeof openChangePasswordModal === 'function') {
            openChangePasswordModal();
            const msg = (state.lang === 'el')
              ? '🔑 Παρακαλώ ορίστε τον νέο σας κωδικό πρόσβασης.'
              : '🔑 Please set your new password.';
            if (typeof showToast === 'function') showToast(msg, 'info');
          }
        }, 400);
      }

      // Show switcher in header
      const switcher = document.getElementById('wallet-switcher-container');
      if (switcher) switcher.style.display = 'inline-block';

      const email = session.user.email || '';
      // Show user badge
      updateHeaderProfileBadge();

      // Show email in the new profile header card (legacy element stays hidden)
      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay) {
        emailDisplay.textContent = email;
        emailDisplay.title = email;
      }
      // Note: settings-user-email-item is intentionally kept hidden.
      // The email is displayed in the profile-user-email element instead.

      // Apply correct visual transformation theme.
      // Call updateUI() immediately to display cached transactions on startup
      // instead of leaving the app blank while fetching fresh data from the cloud.
      applyWalletTheme();
      renderPartnerSection();
      // ANTI-FLICKER: The cached render below is deferred by updateUI() (150ms),
      // which runs AFTER the startup double-rAF removes the 'no-transition' class
      // from <html> (~32ms). Without suppression, this cached DOM wipe animates in
      // with transitions enabled, producing a visible flash on a full WebView reload
      // (e.g. after a long background where the OS killed the WebView). Suppress
      // transitions around this deferred render so it is invisible to the user.
      window._suppressTransitions = true;
      try {
        updateUI();
      } finally {
        setTimeout(() => { window._suppressTransitions = false; }, 1500);
      }

      // Trigger background updates and data loading asynchronously
      (async () => {
        try {
          // 1. Load user profile and partner details (network request)
          await loadUserProfiles(session.user);
          // Re-verify any locally-stored Play purchase that previously completed
          // but failed activation (best-effort, capped retries).
          try { await recoverPendingPlayPurchase(); } catch (e) { console.warn('Pending Play purchase recovery:', e); }
          applyWalletTheme();
          renderPartnerSection();

          // 2. Load fresh data from cloud immediately.
          _suppressRealtimeEvents = true;
          try {
            await loadData();

            // Start automatic polling sync
            startPartnerSyncPolling();

            // Start realtime subscription
            setupSupabaseRealtimeSubscription();
          } finally {
            // Re-enable realtime after a delay to let any inflight echo events drain.
            // This prevents the subscription's own INSERT echo from triggering handleRealtimeTransactionChange
            // and causing a 3rd render 3s after login.
            // 10s: Supabase Realtime echo events can take up to 5-8s to arrive, so we need
            // enough margin to absorb them before re-enabling the handler.
            setTimeout(() => { _suppressRealtimeEvents = false; }, 10000);
          }

          // 3. Import locally-saved data from the phone. If there are pending
          // local transactions (e.g. recorded while offline / as guest), ASK the
          // user whether to import them into their account instead of silently
          // syncing. This is the "auto-import saved data" option on entry.
          //
          // FIX (dialog loop): The dialog is remembered after dismissal. We store
          // the guest count the user last saw ("Keep Offline Only" / backdrop tap),
          // so the dialog no longer re-appears on every app open. It only re-appears
          // when NEW offline transactions are recorded (the pending count changes).
          // If a sync/transfer fails for some items (e.g. schema mismatch), the
          // transfer silently retries and only re-prompts when the set changes.
          // 3. Automatic and silent import of any locally-saved / guest transactions into the cloud account.
          // ZERO POPUPS - ZERO USER EFFORT.
          try {
            await syncLocalTransactionsToCloud(session.user.id, { silent: true });
          } catch (err) {
            console.warn('Auto-sync local transactions on login failed:', err);
          }
        } catch (err) {
          console.error('Error during background auth setup:', err);
        }
      })();
    } else {
      // OFFLINE & PERSISTENT SESSION GUARD:
      // When a null-session or SIGNED_OUT auth event fires without an explicit
      // user-initiated logout (state.isLoggingOut is false) and we have a cached
      // user, it is almost always due to an expired token or failed background
      // network refresh while offline, NOT a genuine user logout.
      // Treating it as a logout wipes cached_current_user and locks the user out
      // of the app. Instead, preserve the cached session so the app remains
      // fully usable offline.
      const cachedUserRaw = localStorage.getItem('cached_current_user');
      if (!state.isLoggingOut && cachedUserRaw) {
        logAuthDebug('Null-session event ignored without explicit logout; preserving cached user offline.');
        try {
          state.currentUser = JSON.parse(cachedUserRaw);
        } catch (e) {
          state.currentUser = null;
        }
        // SECURITY: Preserving existing cached session for offline access
        window._authConfirmed = true;
        // Keep the app usable offline: hide the auth overlay and render cached data.
        const authOverlayEl = document.getElementById('auth-overlay');
        if (authOverlayEl) authOverlayEl.style.display = 'none';
        toggleLoader(false);
        const formsContainerEl = document.getElementById('auth-forms-container');
        if (formsContainerEl) formsContainerEl.style.display = 'block';
        updateHeaderSyncIcon('offline');
        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();
        const earlyHideStyle = document.getElementById('early-auth-hide-style');
        if (earlyHideStyle) earlyHideStyle.remove();
        window._suppressTransitions = true;
        try {
          updateUI();
        } finally {
          setTimeout(() => { window._suppressTransitions = false; }, 1500);
        }
        return;
      }

      // Stop automatic polling sync
      stopPartnerSyncPolling();

      // Stop realtime subscription
      stopSupabaseRealtimeSubscription();

      state.currentUser = null;
      // SECURITY: The session is no longer valid, so the user is NOT authenticated.
      // Reset _authConfirmed so no personal data can be rendered behind the login
      // screen. (The guest-mode branch below re-confirms auth for guest users.)
      window._authConfirmed = false;
      state.userProfile = null;
      state.partnerProfile = null;
      state.familyProfiles = [];
      state.familyGroup = null;
      state.activeAccountMode = 'family';
      // PRIVACY/ISOLATION: Also wipe the in-memory personal data (including the
      // recurring templates) so no render/generation pass can leak the previous
      // account's data — e.g. processRecurringTemplates() re-creating the main
      // profile's recurring transactions into a later guest session. The cached
      // copy stays in localStorage for offline reuse when the user signs back in.
      state.transactions = [];
      state.budgets = [];
      state.recurringTemplates = [];
      state.deletedRecurringDates = [];
      state.trashTransactions = [];
      state.notifications = [];
      state.notes = [];
      localStorage.removeItem('account_view_mode');
      localStorage.removeItem('cached_current_user');
      localStorage.removeItem('cached_partner_profile');
      localStorage.removeItem('cached_user_profile');
      localStorage.removeItem('cached_family_profiles');
      localStorage.removeItem('cached_family_group');
      localStorage.removeItem('offline_transactions');
      localStorage.removeItem('offline_accounts');
      localStorage.removeItem('offline_categories');
      localStorage.removeItem('offline_transactions_owner');
      updateHeaderSyncIcon('offline');

      if (localStorage.getItem('auth_guest_mode') === 'true') {
        state.guestMode = true;
        // SECURITY: Guest mode is a valid authenticated state (clean slate).
        window._authConfirmed = true;

        const earlyStyle = document.getElementById('early-auth-style');
        if (earlyStyle) earlyStyle.remove();

        // Hide auth overlay & reset elements — UNLESS the user explicitly opened
        // the login card (e.g. by tapping the lock icon). In that case a
        // null-session event must not yank the login form away from under them.
        if (!_authOverlayUserRequested) {
          hideAuthOverlay();
        }
        toggleLoader(false);

        // Hide switcher (guest has no shared wallet)
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';

        // Show lock icon user badge
        updateHeaderProfileBadge();

        // Load offline data and render
        window._suppressTransitions = true;
        try {
          await loadData();
          updateUI();
        } finally {
          setTimeout(() => { window._suppressTransitions = false; }, 1500);
        }
        renderPartnerSection();
      } else {
        showAuthOverlay();

        // Hide switcher
        const switcher = document.getElementById('wallet-switcher-container');
        if (switcher) switcher.style.display = 'none';

        // Hide user badge
        const userBadge = document.getElementById('user-profile-badge');
        if (userBadge) userBadge.style.display = 'none';
      }

      // Remove wallet theme active class
      document.body.classList.remove('shared-wallet-active');
      renderPartnerSection();
    }
  });

  // ============================================================
  // FALLBACK SAFETY NET: Guarantee the login screen is shown.
  // ============================================================
  // After the initial auth check (getSession + INITIAL_SESSION) has had time to
  // resolve, if the user is STILL not authenticated (no valid session, not guest,
  // not offline-with-cached-user), force the auth overlay to appear. This catches
  // every edge case that could otherwise leave the app on a blank screen with only
  // the lock icon: a stale/invalid cached_current_user, a getSession error/catch
  // that previously removed early-auth-style without re-showing the overlay, or a
  // delayed/missed INITIAL_SESSION event.
  setTimeout(() => {
    try {
      const isAuthed = !!window._authConfirmed;
      const isGuest = !!state.guestMode;
      const hasCachedUser = !!localStorage.getItem('cached_current_user');
      const isOfflineNow = typeof navigator !== 'undefined' && !navigator.onLine;
      // A user is considered "effectively logged in" if the session was confirmed
      // OR (offline with a cached user / guest mode) - in those cases the overlay
      // must stay hidden.
      const effectivelyLoggedIn = isAuthed || isGuest || (isOfflineNow && hasCachedUser);
      if (effectivelyLoggedIn) return;

      const overlay = document.getElementById('auth-overlay');
      const forms = document.getElementById('auth-forms-container');
      const card = document.getElementById('auth-card');
      const loading = document.getElementById('auth-loading-state');
      if (overlay) overlay.style.display = 'flex';
      if (forms) forms.style.display = 'block';
      if (card) card.style.display = 'flex';
      if (loading) loading.style.display = 'none';
      const earlyStyle = document.getElementById('early-auth-style');
      if (earlyStyle) earlyStyle.remove();
      const earlyHideStyle = document.getElementById('early-auth-hide-style');
      if (earlyHideStyle) earlyHideStyle.remove();
      // Ensure the header shows the lock icon (unauthenticated state).
      updateHeaderProfileBadge();
    } catch (e) {
      console.warn('Auth fallback overlay failed:', e);
    }
  }, 2500);
}

async function loadUserProfiles(user) {
  if (!state.supabaseClient) return;

  try {
    // 1. Fetch current user profile
    const { data: profile, error } = await _promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(r => r),
      8000
    ).catch(e => ({ data: null, error: e }));

    // Guard against out-of-order responses when switching accounts quickly:
    // if the active user changed while this request was in flight, discard the
    // result so a previous account's premium/family state can't be applied.
    if (!state.currentUser || state.currentUser.id !== user.id) return;

    if (error || !profile) {
      // Insert profile manually if trigger didn't do it
      const { data: newProfile, error: insertError } = await _promiseTimeout(
        state.supabaseClient
          .from('profiles')
          .insert([{ id: user.id, email: user.email, display_name: user.email.split('@')[0] }])
          .select()
          .single()
          .then(r => r),
        8000
      ).catch(e => ({ data: null, error: e }));

      if (insertError) {
        console.error('Failed to create profile:', insertError);
      } else {
        state.userProfile = newProfile;
        localStorage.setItem('cached_user_profile', JSON.stringify(newProfile));
        updateHeaderProfileBadge();
      }
    } else {
      state.userProfile = profile;
      localStorage.setItem('cached_user_profile', JSON.stringify(profile));
      updateHeaderProfileBadge();
    }

    // 2. Load family profiles & family group details
    if (state.userProfile && state.userProfile.family_id) {
      const [famRes, groupRes] = await _promiseTimeout(
        Promise.all([
          state.supabaseClient.from('profiles').select('*').eq('family_id', state.userProfile.family_id),
          state.supabaseClient.from('family_groups').select('*').eq('id', state.userProfile.family_id).single()
        ]),
        8000
      ).catch(e => [{ data: null, error: e }, { data: null, error: e }]);

      if (famRes && famRes.data) {
        state.familyProfiles = famRes.data;
        localStorage.setItem('cached_family_profiles', JSON.stringify(famRes.data));
        const otherMember = state.familyProfiles.find(p => p.id !== user.id);
        if (state.familyProfiles.length === 2 && otherMember) {
          state.partnerProfile = otherMember;
          localStorage.setItem('cached_partner_profile', JSON.stringify(otherMember));
        } else {
          state.partnerProfile = null;
          localStorage.removeItem('cached_partner_profile');
        }
      } else {
        state.familyProfiles = [];
        localStorage.removeItem('cached_family_profiles');
      }

      if (groupRes && groupRes.data) {
        state.familyGroup = groupRes.data;
        localStorage.setItem('cached_family_group', JSON.stringify(groupRes.data));
      } else {
        state.familyGroup = null;
        localStorage.removeItem('cached_family_group');
      }

      // Re-register realtime subscription so family and partner channels are active
      if (typeof setupSupabaseRealtimeSubscription === 'function' && state.currentUser && state.supabaseClient) {
        setupSupabaseRealtimeSubscription();
      }
    } else {
      state.familyProfiles = [];
      state.familyGroup = null;
      state.partnerProfile = null;
      localStorage.removeItem('cached_partner_profile');
      localStorage.removeItem('cached_family_profiles');
      localStorage.removeItem('cached_family_group');

      // 3. Scan pending invitations for this user's email
      const pendingInviteCode = localStorage.getItem('pending_invite_code');
      if (pendingInviteCode) {
        localStorage.removeItem('pending_invite_code'); // Clear immediately
        setTimeout(() => showPendingInviteCodePrompt(pendingInviteCode), 1000);
      } else if (user.email) {
        const { data: pending } = await _promiseTimeout(
          state.supabaseClient
            .from('pending_invitations')
            .select('*, family_groups(name, invite_code)')
            .eq('invited_email', user.email.trim().toLowerCase()),
          8000
        ).catch(e => ({ data: null, error: e }));

        if (pending && pending.length > 0) {
          setTimeout(() => showPendingInvitationPrompt(pending[0]), 1000);
        }
      }
    }
  } catch (e) {
    console.error('Error loading user profiles:', e);
  }

  // Refresh the Premium UI (Settings Hub badge + banner) so it reflects the
  // authoritative server profile on app load / login — not only when the user
  // taps the Premium card. Without this, a premium user would see "Upgrade"
  // until they open the Premium modal.
  if (typeof updatePremiumUI === 'function') {
    updatePremiumUI();
  }
}

function showPendingInviteCodePrompt(inviteCode) {
  if (!state.supabaseClient || !state.currentUser) return;

  state.supabaseClient
    .from('family_groups')
    .select('name')
    .eq('invite_code', inviteCode)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        console.warn('Could not find family group for invite code:', inviteCode);
        return;
      }

      const familyName = data.name;
      const confirmMsg = state.lang === 'el'
        ? `📬 Εκκρεμής πρόσκληση!\nΈχετε έναν σύνδεσμο πρόσκλησης για την οικογένεια «${familyName}» (Κωδικός: ${inviteCode}).\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
        : `📬 Pending invitation!\nYou have an invitation link for the family group "${familyName}" (Code: ${inviteCode}).\n\nDo you want to join this family group?`;

      showConfirm(confirmMsg, state.lang === 'el' ? '📬 Πρόσκληση' : '📬 Invitation', '👥').then((confirmed) => {
        if (confirmed) {
          const inviteRole = localStorage.getItem('pending_invite_role') || 'member';
          localStorage.removeItem('pending_invite_role');

          state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
            .then(({ data: joinData, error: joinErr }) => {
              if (joinErr) {
                window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + joinErr.message : 'Error joining family: ' + joinErr.message);
              } else {
                window.showAlert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
                window.location.reload();
              }
            });
        }
      });
    });
}

function showPendingInvitationPrompt(invite) {
  if (!state.supabaseClient || !state.currentUser) return;
  const familyName = invite.family_groups ? invite.family_groups.name : 'Οικογένεια';
  const confirmMsg = state.lang === 'el'
    ? `📬 Εκκρεμής πρόσκληση!\nΈχετε προσκληθεί να συνδεθείτε στην οικογένεια «${familyName}».\n\nΘέλετε να γίνετε μέλος αυτής της οικογένειας;`
    : `📬 Pending invitation!\nYou have been invited to join the family group "${familyName}".\n\nDo you want to join this family group?`;

  showConfirm(confirmMsg, state.lang === 'el' ? '📬 Πρόσκληση' : '📬 Invitation', '👥').then((confirmed) => {
    if (confirmed) {
      const inviteCode = invite.family_groups ? invite.family_groups.invite_code : '';
      if (!inviteCode) return;
      const inviteRole = invite.role || 'member';

      state.supabaseClient.rpc('join_family_group', { invite_code_input: inviteCode, invite_role_input: inviteRole })
        .then(async ({ data, error }) => {
          if (error) {
            window.showAlert(state.lang === 'el' ? 'Σφάλμα κατά τη σύνδεση: ' + error.message : 'Error joining family: ' + error.message);
          } else {
            window.showAlert(state.lang === 'el' ? '🎉 Συνδεθήκατε επιτυχώς στην οικογένεια!' : '🎉 Joined the family successfully!');
            window.location.reload();
          }
        });
    } else {
      // Delete the pending invitation from database so they are not prompted again
      state.supabaseClient.from('pending_invitations').delete().eq('id', invite.id).then(() => {
      });
    }
  });
}

  return {
    loadConfig,
    initSupabase,
    toggleLoader,
    initSupabaseAuth,
    loadUserProfiles,
    showPendingInviteCodePrompt,
    showPendingInvitationPrompt
  };
}));
