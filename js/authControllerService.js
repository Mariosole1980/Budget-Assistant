// ============================================================
// AUTHENTICATION & ACCOUNT CREDENTIALS CONTROLLER
// Autonomous UMD Module (Phase 17A Architectural Extraction)
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
    rootObj.AuthControllerService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// AUTHENTICATION & PARTNER LINKING CONTROLLERS
// ============================================================

let currentAuthTab = 'password';
let currentAuthMode = 'login'; // 'login' or 'signup'

function switchAuthTab(tab) {
  currentAuthTab = tab;

  // Update tabs active state
  document.getElementById('tab-btn-password').classList.toggle('active', tab === 'password');
  document.getElementById('tab-btn-magic').classList.toggle('active', tab === 'magic');
  document.getElementById('tab-btn-google').classList.toggle('active', tab === 'google');

  // Show active form
  document.getElementById('auth-password-form').style.display = tab === 'password' ? 'flex' : 'none';
  document.getElementById('auth-magic-form').style.display = tab === 'magic' ? 'flex' : 'none';
  document.getElementById('auth-google-form').style.display = tab === 'google' ? 'block' : 'none';

  // Clear status messages
  clearAuthStatus();
}

function togglePasswordVisibility(inputId, btnEl) {
  const targetId = inputId || 'auth-password';
  const passwordInput = document.getElementById(targetId);
  if (!passwordInput) return;

  const icon = btnEl ? btnEl.querySelector('i') : document.getElementById('toggle-password-icon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    if (icon) {
      icon.className = 'fa-solid fa-eye-slash';
    }
  } else {
    passwordInput.type = 'password';
    if (icon) {
      icon.className = 'fa-regular fa-eye';
    }
  }
}

function openForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  const emailInput = document.getElementById('auth-email');
  const modalEmailInput = document.getElementById('forgot-modal-email');
  const statusBox = document.getElementById('forgot-modal-status');

  if (statusBox) statusBox.style.display = 'none';

  if (modalEmailInput) {
    modalEmailInput.value = emailInput && emailInput.value ? emailInput.value.trim() : '';
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.classList.add('show');
    setTimeout(() => {
      if (modalEmailInput) modalEmailInput.focus();
    }, 150);
  }
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
    modal.classList.remove('show');
  }
}

function handleForgotPasswordOverlayClick(e) {
  if (e.target && e.target.id === 'forgot-password-modal') {
    closeForgotPasswordModal();
  }
}

async function submitForgotPasswordModal(e) {
  if (e) e.preventDefault();
  if (!state.supabaseClient) {
    window.showAlert('Supabase is not initialized.');
    return;
  }

  const emailInput = document.getElementById('forgot-modal-email');
  const email = emailInput ? emailInput.value.trim() : '';
  const statusBox = document.getElementById('forgot-modal-status');
  const submitBtn = document.getElementById('forgot-modal-submit-btn');

  if (!email) {
    if (statusBox) {
      statusBox.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_label']) + ': ' + 'Παρακαλώ εισάγετε email.';
      statusBox.className = 'auth-status-box';
      statusBox.style.display = 'block';
    }
    return;
  }

  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_sending']) || 'Αποστολή...';
  }
  if (statusBox) statusBox.style.display = 'none';

  try {
    const { error } = await state.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;

    if (statusBox) {
      statusBox.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_success']) || '✅ Στάλθηκε σύνδεσμος επαναφοράς κωδικού! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα).';
      statusBox.className = 'auth-status-box success';
      statusBox.style.display = 'block';
    }

    setTimeout(() => {
      closeForgotPasswordModal();
      showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['forgot_password_modal_success']) || '✅ Στάλθηκε σύνδεσμος επαναφοράς κωδικού στα εισερχόμενά σας!', 'success');
    }, 2500);
  } catch (err) {
    console.error('Reset password error:', err);
    if (statusBox) {
      statusBox.textContent = ((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err);
      statusBox.className = 'auth-status-box';
      statusBox.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;
    }
  }
}

function handleForgotPassword() {
  openForgotPasswordModal();
}

// ============================================================
// CHANGE EMAIL & PASSWORD HANDLERS
// ============================================================
function openChangeEmailModal() {
  if (!state.currentUser || state.currentUser.id === 'offline-user' || !state.supabaseClient) {
    const msg = state.lang === 'el'
      ? 'Η λειτουργία αυτή απαιτεί σύνδεση σε λογαριασμό Cloud.'
      : 'This feature requires a signed-in Cloud account.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    else window.showAlert(msg);
    return;
  }

  const currentEmail = state.currentUser.email || '';
  const currentValEl = document.getElementById('change-email-current-val');
  const inputEl = document.getElementById('change-email-new-input');

  if (currentValEl) currentValEl.textContent = currentEmail;
  if (inputEl) {
    inputEl.value = '';
    setTimeout(() => inputEl.focus(), 150);
  }

  openModal('change-email-modal');
}

async function handleUserEmailChange(event) {
  if (event) event.preventDefault();

  if (!state.currentUser || !state.supabaseClient) {
    const msg = state.lang === 'el' ? 'Απαιτείται ενεργή σύνδεση.' : 'Active session required.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    return;
  }

  const inputEl = document.getElementById('change-email-new-input');
  const newEmail = (inputEl?.value || '').trim();

  if (!newEmail || !newEmail.includes('@') || !newEmail.includes('.')) {
    const msg = state.lang === 'el' ? 'Παρακαλώ εισάγετε ένα έγκυρο email.' : 'Please enter a valid email address.';
    window.showAlert(msg);
    return;
  }

  const currentEmail = (state.currentUser.email || '').trim().toLowerCase();
  if (newEmail.toLowerCase() === currentEmail) {
    const msg = state.lang === 'el' ? 'Το νέο email είναι ίδιο με το τρέχον.' : 'The new email is identical to your current one.';
    window.showAlert(msg);
    return;
  }

  const submitBtn = document.getElementById('btn-submit-change-email');
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (state.lang === 'el' ? 'Αποστολή...' : 'Sending...');
  }

  try {
    const { data, error } = await state.supabaseClient.auth.updateUser({
      email: newEmail
    });

    if (error) throw error;

    closeModal('change-email-modal');

    const successMsg = state.lang === 'el'
      ? `📩 Στάλθηκε σύνδεσμος επιβεβαίωσης στο ${newEmail}. Παρακαλώ επιβεβαιώστε το email σας για να ολοκληρωθεί η αλλαγή.`
      : `📩 A confirmation link was sent to ${newEmail}. Please confirm it to complete the update.`;

    if (typeof showToast === 'function') {
      showToast(successMsg, 'success');
    }
    window.showAlert(successMsg);
  } catch (err) {
    console.error('Email update error:', err);
    const errMsg = (state.lang === 'el' ? 'Σφάλμα αλλαγής email: ' : 'Email update error: ') + (err.message || err);
    window.showAlert(errMsg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

function openChangePasswordModal() {
  if (!state.currentUser || state.currentUser.id === 'offline-user' || !state.supabaseClient) {
    const msg = state.lang === 'el'
      ? 'Η λειτουργία αυτή απαιτεί σύνδεση σε λογαριασμό Cloud.'
      : 'This feature requires a signed-in Cloud account.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    else window.showAlert(msg);
    return;
  }

  const newPwdInput = document.getElementById('change-pwd-new-input');
  const confirmPwdInput = document.getElementById('change-pwd-confirm-input');

  if (newPwdInput) newPwdInput.value = '';
  if (confirmPwdInput) confirmPwdInput.value = '';

  openModal('change-password-modal');
  setTimeout(() => {
    if (newPwdInput) newPwdInput.focus();
  }, 150);
}

async function handleUserPasswordChange(event) {
  if (event) event.preventDefault();

  if (!state.currentUser || !state.supabaseClient) {
    const msg = state.lang === 'el' ? 'Απαιτείται ενεργή σύνδεση.' : 'Active session required.';
    if (typeof showToast === 'function') showToast(msg, 'warning');
    return;
  }

  const newPwdInput = document.getElementById('change-pwd-new-input');
  const confirmPwdInput = document.getElementById('change-pwd-confirm-input');
  const newPwd = (newPwdInput?.value || '').trim();
  const confirmPwd = (confirmPwdInput?.value || '').trim();

  if (newPwd.length < 6) {
    const msg = state.lang === 'el' ? 'Ο κωδικός πρέπει να περιέχει τουλάχιστον 6 χαρακτήρες.' : 'Password must be at least 6 characters long.';
    window.showAlert(msg);
    if (newPwdInput) newPwdInput.focus();
    return;
  }

  if (newPwd !== confirmPwd) {
    const msg = state.lang === 'el' ? 'Οι κωδικοί δεν ταιριάζουν. Παρακαλώ ελέγξτε ξανά.' : 'Passwords do not match. Please verify and try again.';
    window.showAlert(msg);
    if (confirmPwdInput) confirmPwdInput.focus();
    return;
  }

  const submitBtn = document.getElementById('btn-submit-change-pwd');
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (state.lang === 'el' ? 'Ενημέρωση...' : 'Updating...');
  }

  try {
    const { data, error } = await state.supabaseClient.auth.updateUser({
      password: newPwd
    });

    if (error) throw error;

    closeModal('change-password-modal');

    const successMsg = state.lang === 'el'
      ? '🔒 Ο κωδικός πρόσβασης άλλαξε με επιτυχία!'
      : '🔒 Password updated successfully!';

    if (typeof showToast === 'function') {
      showToast(successMsg, 'success');
    } else {
      window.showAlert(successMsg);
    }
  } catch (err) {
    console.error('Password update error:', err);
    const errMsg = (state.lang === 'el' ? 'Σφάλμα αλλαγής κωδικού: ' : 'Password update error: ') + (err.message || err);
    window.showAlert(errMsg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

window.togglePasswordVisibility = togglePasswordVisibility;
window.handleForgotPassword = handleForgotPassword;
window.openForgotPasswordModal = openForgotPasswordModal;
window.closeForgotPasswordModal = closeForgotPasswordModal;
window.handleForgotPasswordOverlayClick = handleForgotPasswordOverlayClick;
window.submitForgotPasswordModal = submitForgotPasswordModal;
window.openChangeEmailModal = openChangeEmailModal;
window.handleUserEmailChange = handleUserEmailChange;
window.openChangePasswordModal = openChangePasswordModal;
window.handleUserPasswordChange = handleUserPasswordChange;

function setAuthMode(mode) {
  currentAuthMode = mode;
  document.getElementById('btn-auth-mode-login').classList.toggle('active', mode === 'login');
  document.getElementById('btn-auth-mode-signup').classList.toggle('active', mode === 'signup');

  const submitBtn = document.getElementById('auth-password-submit-btn');
  const lang = state.lang || 'el';

  const emailInput = document.getElementById('auth-email');
  const pwdInput = document.getElementById('auth-password');
  if (emailInput) emailInput.value = '';
  if (pwdInput) pwdInput.value = '';

  const forgotContainer = document.getElementById('forgot-password-container');
  if (forgotContainer) {
    forgotContainer.style.display = mode === 'login' ? 'flex' : 'none';
  }

  if (mode === 'login') {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_login'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_welcome'];
  } else {
    submitBtn.textContent = TRANSLATIONS[lang]['auth_submit_signup'];
    document.getElementById('auth-subtitle').textContent = TRANSLATIONS[lang]['auth_create_account'];
  }
  clearAuthStatus();
  if (emailInput) {
    setTimeout(() => emailInput.focus(), 60);
  }
}

function formatAuthErrorMessage(err) {
  if (!err) return (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_fail_auth']) || 'Αποτυχία ταυτοποίησης.';
  const msg = typeof err === 'string' ? err : (err.message || err.error_description || err.msg || (err.error && (typeof err.error === 'string' ? err.error : err.error.message)) || '');
  const lower = String(msg).toLowerCase();
  if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
    return state.lang === 'el'
      ? 'Υπέρβαση ορίου αποστολής email. Παρακαλούμε περιμένετε 60 δευτερόλεπτα ή συνδεθείτε άμεσα με Κωδικό ή Google.'
      : 'Email rate limit reached. Please wait 60 seconds or sign in directly with Password or Google.';
  }
  if (msg && msg !== '{}' && String(msg).trim() !== '') return msg;
  return (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_fail_auth']) || 'Αποτυχία ταυτοποίησης.';
}

function showAuthStatus(msg, type = 'error') {
  const box = document.getElementById('auth-status-message');
  if (!box) return;
  box.textContent = msg;
  box.className = type === 'success' ? 'auth-status-box success' : 'auth-status-box';
  box.style.display = 'block';
}

function clearAuthStatus() {
  const box = document.getElementById('auth-status-message');
  if (box) box.style.display = 'none';
}

async function handlePasswordAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) {
    window.showAlert('Supabase is not initialized.');
    return;
  }

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const submitBtn = document.getElementById('auth-password-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_please_wait']) || 'Παρακαλώ περιμένετε...';
  clearAuthStatus();

  try {
    if (currentAuthMode === 'login') {
      const { data, error } = await state.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));
        hideAuthOverlay();
        forceSyncNow(true).catch(console.error);
      }
    } else {
      let signedUp = false;
      try {
        const signupRes = await fetch(getBackendApiUrl('/api/auth-signup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, lang: state.lang })
        });
        const signupData = await signupRes.json().catch(() => ({}));
        if (signupRes.ok && signupData.success) {
          signedUp = true;
          // Auto login immediately
          const { data: loginData, error: loginErr } = await state.supabaseClient.auth.signInWithPassword({
            email,
            password
          });
          if (loginErr) throw loginErr;
          if (loginData && loginData.session && loginData.session.user) {
            state.currentUser = loginData.session.user;
            localStorage.setItem('cached_current_user', JSON.stringify(loginData.session.user));
            hideAuthOverlay();
            forceSyncNow(true).catch(console.error);
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_instant_success']) || '🎉 Ο λογαριασμός δημιουργήθηκε και συνδεθήκατε επιτυχώς!', 'success');
            return;
          }
        } else if (signupData?.error) {
          const errMsg = (signupData.error || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || signupRes.status === 422) {
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
            setAuthMode('login');
            return;
          }
        }
      } catch (srvErr) {
        console.warn('Backend signup failed, falling back to standard signup:', srvErr);
      }

      if (!signedUp) {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { data, error } = await state.supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              lang: state.lang
            }
          }
        });

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || error.status === 422) {
            showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
            setAuthMode('login');
            return;
          }
          throw error;
        }

        // Check if user already exists (Supabase returns user object with identities: [] when email already exists)
        const isExistingUser = data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (isExistingUser) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_email_already_exists']) || '⚠️ Αυτό το email είναι ήδη εγγεγραμμένο. Παρακαλούμε συνδεθείτε με τον κωδικό σας ή πατήστε «Ξεχάσατε τον κωδικό σας;».', 'error');
          setAuthMode('login');
          return;
        }

        // If user is logged in immediately (email confirmation is off in Supabase)
        if (data && data.session) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_instant_success']) || '🎉 Ο λογαριασμός δημιουργήθηκε και συνδεθήκατε επιτυχώς!', 'success');
          return;
        }

        // If user is created but awaiting confirmation
        if (data && data.user) {
          showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_success']) || '🎉 Η εγγραφή ολοκληρώθηκε! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα/Spam) για το σύνδεσμο επιβεβαίωσης.', 'success');
        }
      }
    }
  } catch (err) {
    console.error('Password auth failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleMagicAuth(e) {
  e.preventDefault();
  if (!state.supabaseClient) return;

  const email = document.getElementById('auth-magic-email').value.trim();
  const submitBtn = document.getElementById('auth-magic-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_sending']) || 'Αποστολή...';
  clearAuthStatus();

  try {
    const { error } = await state.supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
    showAuthStatus((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_magic_sent']) || '📩 Ο σύνδεσμος σύνδεσης στάλθηκε! Ελέγξτε τα εισερχόμενά σας (και τα Ανεπιθύμητα).', 'success');
  } catch (err) {
    console.error('Magic link failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function handleGoogleAuth() {
  if (!state.supabaseClient) return;
  clearAuthStatus();

  const googleBtn = document.getElementById('auth-google-submit-btn');
  const origGoogleBtnHtml = googleBtn ? googleBtn.innerHTML : '';
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.innerHTML = `<i class="fa-brands fa-google google-icon"></i> <span>${state.lang === 'el' ? 'Σύνδεση σε εξέλιξη...' : 'Signing in...'}</span>`;
  }

  const clientId = '331220079759-nrguc2ujof9u9mqhbn2mouhpga2iniqj.apps.googleusercontent.com';
  const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;

  // 1. Pure Native Android Google Sign-In (Zero Browser, Instant One-Tap, No screen dimming)
  if (isCapacitor && GoogleAuth) {
    try {
      if (!window._googleAuthInitialized) {
        try {
          await GoogleAuth.initialize({
            clientId: clientId,
            serverClientId: clientId,
            scopes: ['profile', 'email'],
            grantOfflineAccess: false,
          });
          window._googleAuthInitialized = true;
        } catch (initErr) {
          console.warn('[GoogleAuth] Native initialize warning:', initErr);
        }
      }

      // Force the native Google account chooser EVERY time the user taps
      // "Sign in with Google". signOut() clears the last-signed-in account;
      // without it, Google silently re-selects the previous account and the
      // user can never switch between multiple Google accounts.
      try {
        await GoogleAuth.signOut();
      } catch (signOutErr) {
        console.warn('[GoogleAuth] best-effort signOut before signIn:', signOutErr);
      }

      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser?.authentication?.idToken || googleUser?.idToken;

      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      // Authenticate directly with Supabase using the native Google ID token
      const { data, error } = await state.supabaseClient.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
      if (data && data.session && data.session.user) {
        state.currentUser = data.session.user;
        localStorage.setItem('cached_current_user', JSON.stringify(data.session.user));

        // Load user-scoped notes and chat history for the new account
        loadNotes();

        // INSTANT ENTRY: Dismiss login screen immediately for zero perceived latency
        hideAuthOverlay();
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = origGoogleBtnHtml;
        }
        if (typeof updateUI === 'function') updateUI();
        if (typeof updateHeaderProfileBadge === 'function') updateHeaderProfileBadge();
        if (typeof renderNotesList === 'function') renderNotesList();

        // Background sync so user isn't kept waiting at the login screen
        forceSyncNow(true).catch(e => console.warn('Background post-login sync warning:', e));
      } else {
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.innerHTML = origGoogleBtnHtml;
        }
      }
      return;
    } catch (err) {
      if (googleBtn) {
        googleBtn.disabled = false;
        googleBtn.innerHTML = origGoogleBtnHtml;
      }
      const errMsg = (err?.message || '').toLowerCase();
      // If user explicitly dismissed or canceled the native picker, exit cleanly
      if (
        errMsg.includes('cancel') ||
        errMsg.includes('canceled') ||
        errMsg.includes('cancelled') ||
        errMsg.includes('closed') ||
        errMsg.includes('dismiss') ||
        errMsg.includes('12501') ||
        errMsg.includes('abort')
      ) {
        console.log('[GoogleAuth] User dismissed native prompt.');
        return;
      }
      console.error('[GoogleAuth] Native auth failed:', err);
      showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
      return;
    }
  }

  // 2. Web/PWA redirect flow (Only for Desktop / Mobile Web browsers)
  try {
    toggleLoader(true);
    const redirectToUrl = window.location.origin + (window.location.pathname || '/');
    const { error } = await state.supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectToUrl,
        queryParams: { prompt: 'select_account' }
      }
    });
    if (error) throw error;
  } catch (err) {
    toggleLoader(false);
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.innerHTML = origGoogleBtnHtml;
    }
    const errMsg = (err?.message || '').toLowerCase();
    if (
      errMsg.includes('cancel') ||
      errMsg.includes('canceled') ||
      errMsg.includes('cancelled') ||
      errMsg.includes('closed') ||
      errMsg.includes('dismiss') ||
      errMsg.includes('12501') ||
      errMsg.includes('abort')
    ) {
      console.log('[GoogleAuth] User dismissed prompt.');
      return;
    }
    console.error('Google auth flow failed:', err);
    showAuthStatus(((TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_error_prefix']) || '❌ Σφάλμα: ') + formatAuthErrorMessage(err));
  }
}

async function handleLogout() {
  const confirmed = await showConfirm(
    state.lang === 'el' ? 'Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε από το λογαριασμό σας;' : 'Are you sure you want to log out of your account?',
    state.lang === 'el' ? 'Αποσύνδεση' : 'Logout',
    '🚪'
  );
  if (!confirmed) return;
  if (!state.supabaseClient) return;

  try {
    state.isLoggingOut = true;
    window._initialDataLoaded = false;
    try {
      await state.supabaseClient.auth.signOut();
    } catch (signOutErr) {
      console.warn('Supabase signOut network error (probably offline):', signOutErr);
    }

    // Also clear the native Google Sign-In session so the next sign-in shows
    // the account chooser again (otherwise Google silently re-selects the last
    // account used on the device). Best-effort — only when the plugin was
    // initialized earlier by a Google sign-in.
    if (window._googleAuthInitialized && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;
      if (GoogleAuth && typeof GoogleAuth.signOut === 'function') {
        try {
          await GoogleAuth.signOut();
        } catch (gErr) {
          console.warn('[GoogleAuth] Native signOut during logout:', gErr);
        }
      }
    }

    // Clear user-specific cached data
    localStorage.removeItem('cached_current_user');
    localStorage.removeItem('cached_user_profile');
    localStorage.removeItem('cached_partner_profile');
    localStorage.removeItem('cached_family_profiles');
    localStorage.removeItem('cached_family_group');
    localStorage.removeItem('offline_transactions');
    localStorage.removeItem('offline_accounts');
    localStorage.removeItem('offline_categories');
    localStorage.removeItem('offline_transactions_owner');
    localStorage.removeItem('deleted_transactions_trash');
    localStorage.removeItem('sync_cursors_v1');
    localStorage.removeItem('sync_last_full_ts');
    localStorage.removeItem('auth_guest_mode');
    localStorage.removeItem('app_theme'); // Reset theme to default (Premium Dark) on logout
    localStorage.removeItem('account_view_mode');
    localStorage.removeItem('offline_notes');
    localStorage.removeItem('deleted_notes_trash');
    localStorage.removeItem('advisor_chat_conversations_v1');
    localStorage.removeItem('advisor_chat_active_id_v1');
    state.activeAccountMode = 'family';
    localStorage.removeItem('bg_active_modal_id');
    localStorage.removeItem('bg_active_modal_tx_id');
    localStorage.removeItem('bg_active_subcat_txs');
    localStorage.removeItem('bg_modal_scroll_top');

    // Instead of forcing a navigation (which fails offline in Android WebView with net::err_failed),
    // manually reset the application state and DOM.
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
    state.session = null;

    // Reset AI advisor conversation DOM
    const chatLog = document.getElementById('advisor-chat-log');
    if (chatLog) chatLog.innerHTML = '';
    const convList = document.getElementById('advisor-conversation-list');
    if (convList) convList.innerHTML = '';

    // Close any open modals to avoid lingering UI elements
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.tx-modal-overlay').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.profile-sheet-overlay').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');

    // Show Auth UI
    const authOverlay = document.getElementById('auth-overlay');
    const formsContainer = document.getElementById('auth-forms-container');
    const authCard = document.getElementById('auth-card');
    const loadingState = document.getElementById('auth-loading-state');

    if (authOverlay) authOverlay.style.display = 'flex';
    if (formsContainer) formsContainer.style.display = 'block';
    if (authCard) authCard.style.display = 'flex';
    if (loadingState) loadingState.style.display = 'none';

    // Update main UI to clear any underlying DOM nodes
    updateUI();
    if (typeof renderNotesList === 'function') renderNotesList();

    state.isLoggingOut = false;
  } catch (err) {
    state.isLoggingOut = false;
    console.error('Sign out error:', err);
  }
}

window.sendFamilyInviteVia = function (channel, inviteCode) {
  const isEl = state.lang === 'el';
  const roleSelect = document.getElementById('invite-role-select');
  const role = roleSelect ? roleSelect.value : 'member';
  const roleTitle = (role === 'admin')
    ? (isEl ? 'Διαχειριστής' : 'Admin')
    : (isEl ? 'Απλό Μέλος' : 'Member');

  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${role}`;
  const familyName = state.familyGroup ? state.familyGroup.name : '';

  const text = isEl
    ? `👋 Γεια σου! Σε προσκαλώ να συνδεθείς ${familyName ? `στην «${familyName}»` : 'στην οικογένειά μας'} στο Budget Assistant (ως ${roleTitle}) για να διαχειριζόμαστε μαζί τα οικονομικά μας!\n\n🔗 Πατήστε το σύνδεσμο για αποδοχή:\n${inviteUrl}`
    : `👋 Hello! I invite you to join ${familyName ? `"${familyName}"` : 'our family'} on Budget Assistant (as ${roleTitle}) to manage our finances together!\n\n🔗 Tap the link to accept:\n${inviteUrl}`;

  const encodedText = encodeURIComponent(text);

  if (channel === 'whatsapp') {
    const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(waUrl, '_blank');
  } else if (channel === 'viber') {
    const viberUrl = `viber://forward?text=${encodedText}`;
    window.open(viberUrl, '_blank');
  } else if (channel === 'sms') {
    const smsUrl = `sms:?body=${encodedText}`;
    window.location.href = smsUrl;
  } else {
    if (navigator.share) {
      navigator.share({
        title: isEl ? 'Πρόσκληση στο Budget Assistant' : 'Budget Assistant Invite',
        text: text
      }).catch(err => console.log('Share canceled:', err));
    } else {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof showSyncToast === 'function') {
          showSyncToast(isEl ? '✓ Το μήνυμα πρόσκλησης αντεγράφη στο πρόχειρο!' : '✓ Invite message copied to clipboard!', 2500);
        }
      });
    }
  }
};

window.shareFamilyInviteCode = (inviteCode) => window.sendFamilyInviteVia('native', inviteCode);

window.copyDirectInviteLink = function (inviteCode) {
  const isEl = state.lang === 'el';
  const roleSelect = document.getElementById('invite-role-select');
  const role = roleSelect ? roleSelect.value : 'member';
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}&role=${role}`;

  navigator.clipboard.writeText(inviteUrl).then(() => {
    if (typeof showSyncToast === 'function') {
      showSyncToast(isEl ? '✓ Αντεγράφη ο απευθείας σύνδεσμος πρόσκλησης!' : '✓ Direct invite link copied!', 2500);
    }
  });
};


  // Window Bindings
  window.switchAuthTab = switchAuthTab;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.openForgotPasswordModal = openForgotPasswordModal;
  window.closeForgotPasswordModal = closeForgotPasswordModal;
  window.handleForgotPasswordOverlayClick = handleForgotPasswordOverlayClick;
  window.submitForgotPasswordModal = submitForgotPasswordModal;
  window.handleForgotPassword = handleForgotPassword;
  window.openChangeEmailModal = openChangeEmailModal;
  window.handleUserEmailChange = handleUserEmailChange;
  window.openChangePasswordModal = openChangePasswordModal;
  window.handleUserPasswordChange = handleUserPasswordChange;
  window.setAuthMode = setAuthMode;
  window.formatAuthErrorMessage = formatAuthErrorMessage;
  window.showAuthStatus = showAuthStatus;
  window.clearAuthStatus = clearAuthStatus;
  window.handlePasswordAuth = handlePasswordAuth;
  window.handleMagicAuth = handleMagicAuth;
  window.handleGoogleAuth = handleGoogleAuth;
  window.handleLogout = handleLogout;
  window.sendFamilyInviteVia = sendFamilyInviteVia;
  window.shareFamilyInviteCode = shareFamilyInviteCode;
  window.copyDirectInviteLink = copyDirectInviteLink;

  return {
    switchAuthTab: switchAuthTab,
    togglePasswordVisibility: togglePasswordVisibility,
    openForgotPasswordModal: openForgotPasswordModal,
    closeForgotPasswordModal: closeForgotPasswordModal,
    handleForgotPasswordOverlayClick: handleForgotPasswordOverlayClick,
    submitForgotPasswordModal: submitForgotPasswordModal,
    handleForgotPassword: handleForgotPassword,
    openChangeEmailModal: openChangeEmailModal,
    handleUserEmailChange: handleUserEmailChange,
    openChangePasswordModal: openChangePasswordModal,
    handleUserPasswordChange: handleUserPasswordChange,
    setAuthMode: setAuthMode,
    formatAuthErrorMessage: formatAuthErrorMessage,
    showAuthStatus: showAuthStatus,
    clearAuthStatus: clearAuthStatus,
    handlePasswordAuth: handlePasswordAuth,
    handleMagicAuth: handleMagicAuth,
    handleGoogleAuth: handleGoogleAuth,
    handleLogout: handleLogout,
    sendFamilyInviteVia: sendFamilyInviteVia,
    shareFamilyInviteCode: shareFamilyInviteCode,
    copyDirectInviteLink: copyDirectInviteLink
  };
}));
