const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  guestMode: false,
  currentUser: { id: 'user-123', email: 'test@example.com' },
  userProfile: { id: 'user-123', full_name: 'Test User', avatar_url: '' },
  familyGroup: {
    id: 'fam-1',
    created_by: 'user-123',
    members: [{ user_id: 'user-123', role: 'admin' }]
  },
  familyProfiles: [{ id: 'user-123', role: 'admin' }],
  activeAccountMode: 'personal'
};

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) classes.add(c);
            else classes.delete(c);
            return force;
          }
          if (classes.has(c)) { classes.delete(c); return false; }
          else { classes.add(c); return true; }
        }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      dataset: {},
      addEventListener() {},
      removeAttribute() {},
      querySelector() { return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } } }; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return getMockElement(sel.slice(1));
    return getMockElement('mock-' + sel.replace(/[^a-zA-Z0-9]/g, '_'));
  },
  querySelectorAll() {
    return [];
  },
  body: {
    classList: {
      add() {},
      remove() {}
    }
  }
};

global.updateUI = () => {};
global.showSyncToast = () => {};
global.ensureOverlayInBody = () => {};
global.calculateInitialBalances = () => {};
global.applyLanguage = () => {};
global.showAuthOverlay = () => {};

const UserProfileService = require('../js/userProfileService.js');

test('UserProfileService: exports all expected functions', () => {
  const expectedFns = [
    'updateHeaderProfileBadge',
    'getMyFamilyRole',
    'setAccountViewMode',
    'updateProfileSheetModeButtons',
    'openProfileSheet',
    'closeProfileSheet',
    'handleProfileSheetOverlayClick',
    'updateProfileSheetAvatarPreview',
    'selectPresetAvatar',
    'openProfilePhotoSourcePicker',
    'triggerProfileCameraCapture',
    'triggerProfileGalleryUpload',
    'handleProfilePhotoSourceOverlayClick',
    'triggerAvatarUpload',
    'openAvatarViewerModal',
    'triggerAvatarUploadFromViewer',
    'deleteCustomAvatar',
    'handleCustomAvatarUpload',
    'saveProfileName',
    'handleProfileNameKeydown',
    'openPartnerFromProfile',
    'triggerProfileSync',
    'triggerProfileExport',
    'cycleThemeFromProfile',
    'handleProfileLogout',
    'initProfileSheetSwipeDismiss',
    'updateSupabaseUserModal',
    'triggerProfileSyncFromModal'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof UserProfileService[fn], 'function', `${fn} must be a function`);
  });
});

test('UserProfileService: getMyFamilyRole returns correct role for admin member', () => {
  const role = UserProfileService.getMyFamilyRole();
  assert.strictEqual(role, 'admin');
});

test('UserProfileService: setAccountViewMode updates state and local storage', () => {
  UserProfileService.setAccountViewMode('family');
  assert.strictEqual(state.activeAccountMode, 'family');
  assert.strictEqual(localStorage.getItem('account_view_mode'), 'family');

  UserProfileService.setAccountViewMode('personal');
  assert.strictEqual(state.activeAccountMode, 'personal');
  assert.strictEqual(localStorage.getItem('account_view_mode'), 'personal');
});

test('UserProfileService: openProfileSheet and closeProfileSheet toggle overlay active class', () => {
  const modal = getMockElement('profile-settings-modal');
  UserProfileService.openProfileSheet();
  assert.strictEqual(modal.classList.contains('active'), true);

  UserProfileService.closeProfileSheet();
  assert.strictEqual(modal.classList.contains('active'), false);
});
