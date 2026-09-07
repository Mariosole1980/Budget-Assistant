// ============================================================
// PROFILE & USER PREFERENCES SUBSYSTEM
// Autonomous UMD Module (Phase 17B Architectural Extraction)
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
    rootObj.UserProfileService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// PROFILE & SETTINGS SHEET FUNCTIONS
// ============================================================

function updateHeaderProfileBadge() {
  if (typeof updateHeaderDemoBadge === 'function') {
    updateHeaderDemoBadge();
  }

  const userBadge = document.getElementById('user-profile-badge');
  if (!userBadge) return;

  const devSettingsRow = document.getElementById('developer-settings-row');
  if (devSettingsRow) {
    devSettingsRow.style.display = isAdminUser() ? 'flex' : 'none';
  }

  // NOTE: The guest-connect-banner element was removed from index.html (the
  // "Σύνδεση & Συγχρονισμός Cloud" card). Cloud connection happens automatically
  // on app open or via the lock icon, so the banner was redundant.

  const moreAvatar = document.getElementById('more-profile-avatar') || document.querySelector('#more-screen .profile-avatar');
  const moreLetters = document.getElementById('profile-avatar-letters');
  const moreName = document.getElementById('profile-user-name');
  const moreEmail = document.getElementById('profile-user-email');

  if (state.guestMode || !state.currentUser) {
    if (userBadge) {
      userBadge.style.display = 'flex';
      userBadge.style.cursor = 'pointer';
      userBadge.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 11px; pointer-events: none;"></i>';
      userBadge.title = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_signup_title']) || 'Σύνδεση / Εγγραφή';
      userBadge.removeAttribute('onclick');
      userBadge.onclick = function (e) {
        if (e) {
          try { e.preventDefault(); e.stopPropagation(); } catch (err) { }
        }
        showAuthOverlay();
      };
      userBadge.style.backgroundImage = 'none';
      userBadge.className = 'user-profile-badge';
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--blue-positive) 100%)';
      moreAvatar.innerHTML = '<i class="fa-solid fa-user" style="font-size: 20px;"></i>';
    }
    if (moreName) moreName.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_guest_title']) || (state.lang === 'el' ? 'Επισκέπτης (Offline)' : 'Guest (Offline)');
    if (moreEmail) moreEmail.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['auth_guest_tap_to_signin']) || (state.lang === 'el' ? 'Πατήστε για σύνδεση' : 'Tap to sign in');
    return;
  }

  const email = state.currentUser.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  if (moreName) {
    moreName.textContent = state.userProfile?.display_name || state.currentUser?.email?.split('@')[0] || 'User';
  }
  if (moreEmail) {
    moreEmail.textContent = email || 'email@example.com';
  }

  if (userBadge) {
    userBadge.style.display = 'flex';
    userBadge.title = email;
    userBadge.onclick = () => openProfileSheet();
    userBadge.className = 'user-profile-badge';
  }

  if (avatarType === 'preset') {
    const presetIcons = {
      '1': 'fa-user-tie', '2': 'fa-gem', '3': 'fa-crown', '4': 'fa-coins',
      '5': 'fa-chart-line', '6': 'fa-vault', '7': 'fa-rocket', '8': 'fa-robot',
      '9': 'fa-bolt', '10': 'fa-gamepad', '11': 'fa-shield-halved', '12': 'fa-laptop-code',
      '13': 'fa-cat', '14': 'fa-dog', '15': 'fa-dragon', '16': 'fa-dove',
      '17': 'fa-fire', '18': 'fa-heart', '19': 'fa-mask', '20': 'fa-ghost',
      '21': 'fa-star', '22': 'fa-tree', '23': 'fa-globe', '24': 'fa-wand-magic-sparkles'
    };
    const iconClass = presetIcons[presetId] || 'fa-user-tie';

    if (userBadge) {
      userBadge.classList.add('avatar-preset-badge', 'preset-' + presetId);
      userBadge.style.backgroundImage = 'none';
      userBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.className = 'profile-avatar preset-' + presetId;
      moreAvatar.innerHTML = `<i class="fa-solid ${iconClass}" style="font-size: 22px; color: #fff;"></i>`;
    }
  } else if (avatarType === 'custom' && customData) {
    if (userBadge) {
      userBadge.classList.add('avatar-img-badge');
      userBadge.style.backgroundImage = `url(${customData})`;
      userBadge.innerHTML = '';
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = `url(${customData})`;
      moreAvatar.style.backgroundSize = 'cover';
      moreAvatar.style.backgroundPosition = 'center';
      moreAvatar.innerHTML = '';
    }
  } else {
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      const parts = state.userProfile.display_name.trim().split(/\s+/).filter(p => p.length > 0);
      if (parts.length > 0) {
        initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
      }
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    if (userBadge) {
      userBadge.style.backgroundImage = 'none';
      userBadge.textContent = initials;
    }
    if (moreAvatar) {
      moreAvatar.style.backgroundImage = 'none';
      moreAvatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--blue-positive) 100%)';
      moreAvatar.innerHTML = `<span id="profile-avatar-letters">${initials}</span>`;
    }
  }
}

function getMyFamilyRole() {
  if (!state.currentUser) return 'personal';
  if (!state.familyGroup && (!state.userProfile || !state.userProfile.family_id)) return 'personal';

  if (Array.isArray(state.familyProfiles)) {
    const myProf = state.familyProfiles.find(p => p.id === state.currentUser.id);
    if (myProf && myProf.role) return myProf.role;
  }

  if (state.userProfile && state.userProfile.role) {
    return state.userProfile.role;
  }

  return 'member';
}
window.getMyFamilyRole = getMyFamilyRole;

function setAccountViewMode(mode) {
  if (mode !== 'family' && mode !== 'personal') return;
  if (!state.familyGroup && mode === 'family') {
    closeProfileSheet();
    if (typeof openSettingsSubscreen === 'function') {
      openSettingsSubscreen('family', 'settings_family_title');
    }
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? '⚠️ Συνδεθείτε ή δημιουργήστε οικογενειακή ομάδα' : '⚠️ Join or create a family group first', 2500);
    }
    return;
  }
  state.activeAccountMode = mode;
  localStorage.setItem('account_view_mode', mode);

  updateProfileSheetModeButtons();
  calculateInitialBalances();
  updateUI();
  if (typeof window.updateDesktopSidebarUser === 'function') {
    window.updateDesktopSidebarUser();
  }

  if (typeof showSyncToast === 'function') {
    const msg = mode === 'personal'
      ? (state.lang === 'el' ? '👤 Ατομικός Λογαριασμός ενεργός' : '👤 Personal Account Mode active')
      : (state.lang === 'el' ? '👥 Οικογενειακός Λογαριασμός ενεργός' : '👥 Family Account Mode active');
    showSyncToast(msg, 2000);
  }
}
window.setAccountViewMode = setAccountViewMode;

function updateProfileSheetModeButtons() {
  const mode = state.activeAccountMode || 'family';
  const btnPersonal = document.getElementById('profile-mode-btn-personal');
  const btnFamily = document.getElementById('profile-mode-btn-family');
  if (btnPersonal) {
    btnPersonal.classList.toggle('active', mode === 'personal');
  }
  if (btnFamily) {
    btnFamily.classList.toggle('active', mode === 'family');
  }
}
window.updateProfileSheetModeButtons = updateProfileSheetModeButtons;

function openProfileSheet() {
  if (state.guestMode || !state.currentUser) {
    showAuthOverlay();
    return;
  }

  // Ensure all translations are applied to profile sheet elements
  applyLanguage(state.lang);

  const email = state.currentUser.email || '';
  const name = state.userProfile?.display_name || email.split('@')[0];

  const nameInput = document.getElementById('profile-name-input');
  if (nameInput) {
    nameInput.value = name;
    nameInput.placeholder = state.lang === 'el' ? 'Το όνομά σας' : 'Your name';
  }

  const emailDisplay = document.getElementById('profile-email-display');
  if (emailDisplay) emailDisplay.textContent = email;

  // Calculate & populate profile quick stats
  const activeTransactions = (typeof getActiveTransactions === 'function') ? getActiveTransactions() : (state.transactions || []);
  const totalTransCount = activeTransactions.length;
  const activeCatsCount = (state.categories || []).filter(c => c && !c.hidden).length;

  const statTransEl = document.getElementById('profile-stat-transactions');
  if (statTransEl) statTransEl.textContent = totalTransCount;

  const statCatsEl = document.getElementById('profile-stat-categories');
  if (statCatsEl) statCatsEl.textContent = activeCatsCount;

  // Populate Role & Family Badge
  const roleBadgeEl = document.getElementById('profile-role-badge');
  const statGroupEl = document.getElementById('profile-stat-group');
  if (state.familyGroup) {
    const myRole = getMyFamilyRole();
    if (roleBadgeEl) {
      if (myRole === 'admin') {
        roleBadgeEl.className = 'profile-role-badge admin';
        roleBadgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> <span>${state.lang === 'el' ? 'Διαχειριστής Οικογένειας' : 'Family Admin'}</span>`;
      } else {
        roleBadgeEl.className = 'profile-role-badge member';
        roleBadgeEl.innerHTML = `<i class="fa-solid fa-users"></i> <span>${state.lang === 'el' ? 'Μέλος Οικογένειας' : 'Family Member'}</span>`;
      }
    }
    if (statGroupEl) statGroupEl.textContent = state.familyGroup.name || (state.lang === 'el' ? 'Οικογένεια' : 'Family');
  } else {
    if (roleBadgeEl) {
      roleBadgeEl.className = 'profile-role-badge personal';
      roleBadgeEl.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span>${state.lang === 'el' ? 'Ατομικός Λογαριασμός' : 'Personal Account'}</span>`;
    }
    if (statGroupEl) statGroupEl.textContent = state.lang === 'el' ? 'Ατομικό' : 'Personal';
  }

  updateProfileSheetModeButtons();

  // Update cloud sync status
  const cloudStatus = document.getElementById('profile-cloud-status');
  if (cloudStatus) {
    const icon = cloudStatus.querySelector('i');
    const span = cloudStatus.querySelector('span');
    if (navigator.onLine) {
      cloudStatus.className = 'profile-cloud-status online';
      if (icon) icon.className = 'fa-solid fa-cloud-check';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Active' : 'Συγχρονισμός Cloud: Ενεργός';
    } else {
      cloudStatus.className = 'profile-cloud-status offline';
      if (icon) icon.className = 'fa-solid fa-cloud-slash';
      if (span) span.textContent = state.lang === 'en' ? 'Cloud Sync: Offline' : 'Συγχρονισμός Cloud: Εκτός σύνδεσης';
    }
  }

  updateProfileSheetAvatarPreview();

  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.add('active');
    initProfileSheetSwipeDismiss();
  }
}

function closeProfileSheet() {
  const modal = document.getElementById('profile-settings-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  // Re-render the active tab now that the sheet is closed. Without this, changes
  // made inside the sheet (e.g. the Personal/Family account mode switcher) would
  // not be reflected in the underlying tab until a full refresh, because
  // _updateUIImpl() skips the tab re-render while the sheet overlay is open.
  if (typeof updateUI === 'function') updateUI();
}

function handleProfileSheetOverlayClick(e) {
  if (e.target.id === 'profile-settings-modal') {
    closeProfileSheet();
  }
}

function updateProfileSheetAvatarPreview() {
  const preview = document.getElementById('profile-sheet-avatar-preview');
  if (!preview) return;

  const email = state.currentUser?.email || '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const presetId = localStorage.getItem('avatar_preset_id_' + email) || '1';
  const customData = localStorage.getItem('avatar_custom_data_' + email) || '';

  preview.className = 'profile-sheet-avatar';
  preview.style.backgroundImage = 'none';
  preview.innerHTML = '';

  document.querySelectorAll('.preset-avatar-option').forEach(opt => {
    opt.classList.remove('active');
    const pid = opt.getAttribute('data-preset');
    if (avatarType === 'preset' && pid === presetId) {
      opt.classList.add('active');
    }
  });

  const customTrigger = document.querySelector('.preset-custom-trigger');
  if (customTrigger) {
    customTrigger.classList.remove('active');
    if (avatarType === 'custom') {
      customTrigger.classList.add('active');
    }
  }

  if (avatarType === 'preset') {
    preview.classList.add('preset-' + presetId);
    const presetIcons = {
      '1': 'fa-user-tie', '2': 'fa-gem', '3': 'fa-crown', '4': 'fa-coins',
      '5': 'fa-chart-line', '6': 'fa-vault', '7': 'fa-rocket', '8': 'fa-robot',
      '9': 'fa-bolt', '10': 'fa-gamepad', '11': 'fa-shield-halved', '12': 'fa-laptop-code',
      '13': 'fa-cat', '14': 'fa-dog', '15': 'fa-dragon', '16': 'fa-dove',
      '17': 'fa-fire', '18': 'fa-heart', '19': 'fa-mask', '20': 'fa-ghost',
      '21': 'fa-star', '22': 'fa-tree', '23': 'fa-globe', '24': 'fa-wand-magic-sparkles'
    };
    const iconClass = presetIcons[presetId] || 'fa-user-tie';
    preview.innerHTML = `<i class="fa-solid ${iconClass}" style="color: #fff;"></i>`;
  } else if (avatarType === 'custom' && customData) {
    preview.style.backgroundImage = `url(${customData})`;
  } else {
    let initials = '👤';
    if (state.userProfile && state.userProfile.display_name) {
      initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
    } else if (email) {
      initials = email.substring(0, 2).toUpperCase();
    }
    preview.textContent = initials;
  }
}

function selectPresetAvatar(id) {
  if (!state.currentUser) return;
  const email = state.currentUser.email || '';
  localStorage.setItem('avatar_type_' + email, 'preset');
  localStorage.setItem('avatar_preset_id_' + email, String(id));

  updateProfileSheetAvatarPreview();
  updateHeaderProfileBadge();
}

function openProfilePhotoSourcePicker(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  const modalEl = document.getElementById('profile-photo-source-modal');
  if (modalEl) {
    if (typeof ensureOverlayInBody === 'function') ensureOverlayInBody(modalEl);
    if (modalEl.parentElement === document.body) {
      document.body.appendChild(modalEl);
    }
  }
  openModal('profile-photo-source-modal');
}

function triggerProfileCameraCapture(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  closeModal('profile-photo-source-modal');
  const cameraInput = document.getElementById('profile-avatar-camera-input');
  if (cameraInput) {
    cameraInput.value = '';
    setTimeout(() => {
      cameraInput.click();
    }, 60);
  }
}

function triggerProfileGalleryUpload(e) {
  if (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
  closeModal('profile-photo-source-modal');
  const fileInput = document.getElementById('profile-avatar-file-input');
  if (fileInput) {
    fileInput.value = '';
    setTimeout(() => {
      fileInput.click();
    }, 60);
  }
}

function handleProfilePhotoSourceOverlayClick(e) {
  if (e.target.id === 'profile-photo-source-modal') {
    closeModal('profile-photo-source-modal');
  }
}

function triggerAvatarUpload(e) {
  openProfilePhotoSourcePicker(e);
}
window.openProfilePhotoSourcePicker = openProfilePhotoSourcePicker;
window.triggerProfileCameraCapture = triggerProfileCameraCapture;
window.triggerProfileGalleryUpload = triggerProfileGalleryUpload;
window.handleProfilePhotoSourceOverlayClick = handleProfilePhotoSourceOverlayClick;
window.triggerAvatarUpload = triggerAvatarUpload;

function openAvatarViewerModal() {
  const email = state.currentUser ? (state.currentUser.email || '') : '';
  const avatarType = localStorage.getItem('avatar_type_' + email) || 'initials';
  const customData = localStorage.getItem('avatar_custom_data_' + email);
  const presetId = localStorage.getItem('avatar_preset_id_' + email);

  const preview = document.getElementById('avatar-viewer-large-preview');
  const deleteBtn = document.getElementById('avatar-viewer-delete-btn');

  if (preview) {
    preview.className = '';
    preview.style.background = '';
    preview.innerHTML = '';

    if (avatarType === 'custom' && customData) {
      preview.innerHTML = `<img src="${customData}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      if (deleteBtn) deleteBtn.style.display = 'flex';
    } else if (avatarType === 'preset' && presetId) {
      preview.className = 'preset-' + presetId;
      preview.innerHTML = `<i class="fa-solid fa-user" style="font-size:48px;"></i>`;
      if (deleteBtn) deleteBtn.style.display = 'flex';
    } else {
      let initials = 'BA';
      if (state.userProfile && state.userProfile.display_name) {
        initials = state.userProfile.display_name.substring(0, 2).toUpperCase();
      } else if (email) {
        initials = email.substring(0, 2).toUpperCase();
      }
      preview.style.background = 'linear-gradient(135deg, #7c6af7, #5a48e8)';
      preview.textContent = initials;
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  }

  openModal('avatar-viewer-modal');
}
window.openAvatarViewerModal = openAvatarViewerModal;

function triggerAvatarUploadFromViewer() {
  closeModal('avatar-viewer-modal');
  setTimeout(() => {
    openProfilePhotoSourcePicker();
  }, 200);
}
window.triggerAvatarUploadFromViewer = triggerAvatarUploadFromViewer;

function deleteCustomAvatar() {
  if (!state.currentUser) return;
  const email = state.currentUser.email || '';
  localStorage.removeItem('avatar_type_' + email);
  localStorage.removeItem('avatar_custom_data_' + email);
  localStorage.removeItem('avatar_preset_id_' + email);

  updateProfileSheetAvatarPreview();
  updateHeaderProfileBadge();
  closeModal('avatar-viewer-modal');
  showSyncToast(state.lang === 'el' ? '✓ Η φωτογραφία αφαιρέθηκε' : '✓ Photo removed', 2000);
}
window.deleteCustomAvatar = deleteCustomAvatar;

function handleCustomAvatarUpload(e) {
  if (!state.currentUser) return;
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    const email = state.currentUser.email || '';
    localStorage.setItem('avatar_type_' + email, 'custom');
    localStorage.setItem('avatar_custom_data_' + email, evt.target.result);

    updateProfileSheetAvatarPreview();
    updateHeaderProfileBadge();
    showSyncToast(state.lang === 'el' ? '✓ Η φωτογραφία ενημερώθηκε' : '✓ Photo updated', 2000);
  };
  reader.readAsDataURL(file);
}

async function saveProfileName() {
  if (!state.currentUser || !state.supabaseClient) return;

  const nameInput = document.getElementById('profile-name-input');
  if (!nameInput) return;

  const newName = nameInput.value.trim();
  const oldName = state.userProfile?.display_name || '';

  if (!newName || newName === oldName) return;

  try {
    const { data, error } = await promiseTimeout(
      state.supabaseClient
        .from('profiles')
        .update({ display_name: newName })
        .eq('id', state.currentUser.id)
        .select()
        .single()
        .then(r => r),
      6000
    ).catch(err => ({ data: null, error: err }));

    if (error) {
      console.error('Failed to update display_name:', error);
      window.showAlert('⚠️ Αποτυχία ενημέρωσης ονόματος στη βάση δεδομένων.');
      nameInput.value = oldName;
    } else if (data) {
      state.userProfile = data;
      updateHeaderProfileBadge();
      updateProfileSheetAvatarPreview();

      localStorage.setItem('cached_current_user', JSON.stringify(data));

      const emailDisplay = document.getElementById('settings-user-email-value');
      if (emailDisplay && state.currentUser) {
        emailDisplay.textContent = `${state.currentUser.email} (${newName})`;
      }
    }
  } catch (err) {
    console.error('Error saving display name:', err);
  }
}

function handleProfileNameKeydown(e) {
  if (e.key === 'Enter') {
    e.target.blur();
  }
}

function openPartnerFromProfile() {
  closeProfileSheet();
  switchTab('more');
  setTimeout(() => {
    const partnerEl = document.getElementById('partner-linking-container');
    if (partnerEl) {
      partnerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      partnerEl.style.outline = '2px solid var(--accent)';
      setTimeout(() => partnerEl.style.outline = '', 2000);
    }
  }, 350);
}

async function triggerProfileSync() {
  const syncBtn = document.getElementById('profile-sync-spinner');
  if (syncBtn) syncBtn.classList.add('fa-spin');
  const modalSyncSpinner = document.getElementById('modal-sync-spinner');
  if (modalSyncSpinner) modalSyncSpinner.classList.add('fa-spin');

  const syncStatus = document.getElementById('profile-sync-status');
  if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['sync_status_syncing']) || 'Συγχρονισμός...';

  try {
    if (state.currentUser) {
      await loadUserProfiles(state.currentUser);
      await loadData();
      if (typeof checkPartnerActivityAlerts === 'function') {
        checkPartnerActivityAlerts(state.transactions);
      }
      if (typeof checkWeeklyAndMonthlyDigests === 'function') {
        checkWeeklyAndMonthlyDigests();
      }
      updateUI();
      renderPartnerSection();
      if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['sync_done']) || 'Ολοκληρώθηκε!';
    }
  } catch (err) {
    console.error(err);
    if (syncStatus) syncStatus.textContent = (TRANSLATIONS[state.lang] && TRANSLATIONS[state.lang]['val_sync_status_error']) || 'Σφάλμα';
  } finally {
    setTimeout(() => {
      if (syncBtn) syncBtn.classList.remove('fa-spin');
      if (modalSyncSpinner) modalSyncSpinner.classList.remove('fa-spin');
      if (syncStatus) syncStatus.textContent = navigator.onLine ? 'Συνδεδεμένο' : 'Εκτός σύνδεσης';
    }, 1000);
  }
}

function triggerProfileExport() {
  closeProfileSheet();
  openExportPeriodSheet();
}

function cycleThemeFromProfile() {
  const themes = ['dark', 'oled', 'light', 'pink', 'sakura', 'rosegold', 'emerald', 'ocean', 'cyber'];
  const currentTheme = localStorage.getItem('app_theme') || 'dark';
  let nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
  const nextTheme = themes[nextIdx];

  changeThemeSetting(nextTheme);
  updateSettingsDisplay();

  const themeStatus = document.getElementById('profile-theme-status');
  if (themeStatus) {
    const themeNames = {
      'dark': 'Premium Dark',
      'oled': 'OLED Black',
      'light': 'Classic Light',
      'pink': 'Blossom Pink',
      'sakura': 'Sakura Pastel',
      'rosegold': 'Rose Gold',
      'emerald': 'Emerald Forest',
      'ocean': 'Ocean Breeze',
      'cyber': 'Cyber Neon'
    };
    themeStatus.textContent = themeNames[nextTheme] || nextTheme;
  }
}

function handleProfileLogout() {
  closeProfileSheet();
  handleLogout();
}

function initProfileSheetSwipeDismiss() {
  const sheetContent = document.getElementById('profile-sheet-content');
  if (!sheetContent) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const handleTouchStart = (e) => {
    const body = sheetContent.querySelector('.profile-sheet-body');
    if (body && body.scrollTop > 0) return;

    startY = e.touches[0].clientY;
    isDragging = true;
    sheetContent.classList.add('dragging');
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    if (deltaY > 0) {
      e.preventDefault();
      sheetContent.style.transform = `translateY(${deltaY}px)`;
    } else {
      sheetContent.style.transform = '';
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    sheetContent.classList.remove('dragging');
    const deltaY = currentY - startY;

    if (deltaY > 150) {
      sheetContent.style.transform = '';
      closeProfileSheet();
    } else {
      sheetContent.style.transform = '';
    }
    startY = 0;
    currentY = 0;
  };

  sheetContent.addEventListener('touchstart', handleTouchStart, { passive: false });
  sheetContent.addEventListener('touchmove', handleTouchMove, { passive: false });
  sheetContent.addEventListener('touchend', handleTouchEnd);
}

// Year swipe gestures & openCustomDatePicker
// Extracted to js/customDatePicker.js (Phase 14D Architectural Extraction)

window.updateHeaderProfileBadge = updateHeaderProfileBadge;
window.openProfileSheet = openProfileSheet;
window.closeProfileSheet = closeProfileSheet;
window.handleProfileSheetOverlayClick = handleProfileSheetOverlayClick;
window.selectPresetAvatar = selectPresetAvatar;
window.triggerAvatarUpload = triggerAvatarUpload;
window.handleCustomAvatarUpload = handleCustomAvatarUpload;
window.saveProfileName = saveProfileName;
window.handleProfileNameKeydown = handleProfileNameKeydown;
window.openPartnerFromProfile = openPartnerFromProfile;
window.triggerProfileSync = triggerProfileSync;
window.triggerProfileExport = triggerProfileExport;
window.cycleThemeFromProfile = cycleThemeFromProfile;
window.handleProfileLogout = handleProfileLogout;
window.initProfileSheetSwipeDismiss = initProfileSheetSwipeDismiss;
// window.openCustomDatePicker bound in js/customDatePicker.js

function updateSupabaseUserModal() {
  const container = document.getElementById('supabase-user-settings');
  if (!container) return;

  const lang = state.lang || 'el';

  if (state.guestMode || !state.currentUser) {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️</div>
        <h4 style="margin-bottom: 8px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Guest Mode (Offline)' : 'Λειτουργία Επισκέπτη (Offline)'}
        </h4>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 20px;">
          ${lang === 'en'
        ? 'Currently, your data is saved only locally on your device. Connect to the Cloud to enable automatic backup and a real-time shared wallet with your partner.'
        : 'Αυτή τη στιγμή τα δεδομένα σας αποθηκεύονται μόνο τοπικά στη συσκευή σας. Συνδεθείτε στο Cloud για να ενεργοποιήσετε αυτόματο backup και κοινό πορτοφόλι σε πραγματικό χρόνο με τον/την συνεργάτη σας.'}
        </p>
        <button type="button" class="btn btn-primary btn-block" onclick="closeModal('supabase-modal'); showAuthOverlay();" style="padding: 12px;">
          <i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Login or Register' : 'Σύνδεση ή Εγγραφή'}
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 40px; margin-bottom: 12px;">☁️✅</div>
        <h4 style="margin-bottom: 4px; font-weight: 700; color: var(--text-main);">
          ${lang === 'en' ? 'Connected to Cloud' : 'Συνδεδεμένος στο Cloud'}
        </h4>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px; word-break: break-all;">
          ${state.currentUser.email}
        </div>

        <div class="ios-settings-group" style="margin-bottom: 20px; text-align: left;">
          <div class="ios-settings-row" onclick="triggerProfileSyncFromModal()">
            <div class="ios-row-left">
              <div class="ios-row-icon icon-sync"><i class="fa-solid fa-cloud-arrow-up"></i></div>
              <span class="ios-row-label">${lang === 'en' ? 'Sync Now' : 'Συγχρονισμός Τώρα'}</span>
            </div>
            <div class="ios-row-right">
              <i class="fa-solid fa-arrows-rotate ios-row-arrow" id="modal-sync-spinner"></i>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-block" onclick="closeModal('supabase-modal'); handleLogout();" style="color: var(--accent); background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); padding: 11px;">
          <i class="fa-solid fa-right-from-bracket" style="margin-right: 8px;"></i>
          ${lang === 'en' ? 'Logout Account' : 'Αποσύνδεση Λογαριασμού'}
        </button>
      </div>
    `;
  }
}

function triggerProfileSyncFromModal() {
  triggerProfileSync();
}

window.updateSupabaseUserModal = updateSupabaseUserModal;
window.triggerProfileSyncFromModal = triggerProfileSyncFromModal;


  // Window Bindings
  window.updateHeaderProfileBadge = updateHeaderProfileBadge;
  window.getMyFamilyRole = getMyFamilyRole;
  window.setAccountViewMode = setAccountViewMode;
  window.updateProfileSheetModeButtons = updateProfileSheetModeButtons;
  window.openProfileSheet = openProfileSheet;
  window.closeProfileSheet = closeProfileSheet;
  window.handleProfileSheetOverlayClick = handleProfileSheetOverlayClick;
  window.updateProfileSheetAvatarPreview = updateProfileSheetAvatarPreview;
  window.selectPresetAvatar = selectPresetAvatar;
  window.openProfilePhotoSourcePicker = openProfilePhotoSourcePicker;
  window.triggerProfileCameraCapture = triggerProfileCameraCapture;
  window.triggerProfileGalleryUpload = triggerProfileGalleryUpload;
  window.handleProfilePhotoSourceOverlayClick = handleProfilePhotoSourceOverlayClick;
  window.triggerAvatarUpload = triggerAvatarUpload;
  window.openAvatarViewerModal = openAvatarViewerModal;
  window.triggerAvatarUploadFromViewer = triggerAvatarUploadFromViewer;
  window.deleteCustomAvatar = deleteCustomAvatar;
  window.handleCustomAvatarUpload = handleCustomAvatarUpload;
  window.saveProfileName = saveProfileName;
  window.handleProfileNameKeydown = handleProfileNameKeydown;
  window.openPartnerFromProfile = openPartnerFromProfile;
  window.triggerProfileSync = triggerProfileSync;
  window.triggerProfileExport = triggerProfileExport;
  window.cycleThemeFromProfile = cycleThemeFromProfile;
  window.handleProfileLogout = handleProfileLogout;
  window.initProfileSheetSwipeDismiss = initProfileSheetSwipeDismiss;
  window.updateSupabaseUserModal = updateSupabaseUserModal;
  window.triggerProfileSyncFromModal = triggerProfileSyncFromModal;

  return {
    updateHeaderProfileBadge: updateHeaderProfileBadge,
    getMyFamilyRole: getMyFamilyRole,
    setAccountViewMode: setAccountViewMode,
    updateProfileSheetModeButtons: updateProfileSheetModeButtons,
    openProfileSheet: openProfileSheet,
    closeProfileSheet: closeProfileSheet,
    handleProfileSheetOverlayClick: handleProfileSheetOverlayClick,
    updateProfileSheetAvatarPreview: updateProfileSheetAvatarPreview,
    selectPresetAvatar: selectPresetAvatar,
    openProfilePhotoSourcePicker: openProfilePhotoSourcePicker,
    triggerProfileCameraCapture: triggerProfileCameraCapture,
    triggerProfileGalleryUpload: triggerProfileGalleryUpload,
    handleProfilePhotoSourceOverlayClick: handleProfilePhotoSourceOverlayClick,
    triggerAvatarUpload: triggerAvatarUpload,
    openAvatarViewerModal: openAvatarViewerModal,
    triggerAvatarUploadFromViewer: triggerAvatarUploadFromViewer,
    deleteCustomAvatar: deleteCustomAvatar,
    handleCustomAvatarUpload: handleCustomAvatarUpload,
    saveProfileName: saveProfileName,
    handleProfileNameKeydown: handleProfileNameKeydown,
    openPartnerFromProfile: openPartnerFromProfile,
    triggerProfileSync: triggerProfileSync,
    triggerProfileExport: triggerProfileExport,
    cycleThemeFromProfile: cycleThemeFromProfile,
    handleProfileLogout: handleProfileLogout,
    initProfileSheetSwipeDismiss: initProfileSheetSwipeDismiss,
    updateSupabaseUserModal: updateSupabaseUserModal,
    triggerProfileSyncFromModal: triggerProfileSyncFromModal
  };
}));
