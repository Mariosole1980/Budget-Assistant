const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.state = {
  lang: 'el',
  currentUser: null
};

global.TRANSLATIONS = require('../js/translations.js');

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {},
      type: 'password',
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
      focus() {},
      querySelector() { return { className: '', onclick: null }; },
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
    return { className: '', onclick: null };
  },
  querySelectorAll() {
    return [];
  }
};

global.showConfirm = async () => false;
global.showSyncToast = () => {};
global.updateUI = () => {};

const AuthControllerService = require('../js/authControllerService.js');

test('AuthControllerService: exports all expected functions', () => {
  const expectedFns = [
    'switchAuthTab',
    'togglePasswordVisibility',
    'openForgotPasswordModal',
    'closeForgotPasswordModal',
    'handleForgotPasswordOverlayClick',
    'submitForgotPasswordModal',
    'handleForgotPassword',
    'openChangeEmailModal',
    'handleUserEmailChange',
    'openChangePasswordModal',
    'handleUserPasswordChange',
    'setAuthMode',
    'formatAuthErrorMessage',
    'showAuthStatus',
    'clearAuthStatus',
    'handlePasswordAuth',
    'handleMagicAuth',
    'handleGoogleAuth',
    'handleLogout',
    'sendFamilyInviteVia',
    'shareFamilyInviteCode',
    'copyDirectInviteLink'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof AuthControllerService[fn], 'function', `${fn} must be a function`);
  });
});

test('AuthControllerService: switchAuthTab updates form display and tab buttons', () => {
  AuthControllerService.switchAuthTab('magic');
  assert.strictEqual(getMockElement('tab-btn-magic').classList.contains('active'), true);
  assert.strictEqual(getMockElement('tab-btn-password').classList.contains('active'), false);
  assert.strictEqual(getMockElement('auth-magic-form').style.display, 'flex');
  assert.strictEqual(getMockElement('auth-password-form').style.display, 'none');

  AuthControllerService.switchAuthTab('password');
  assert.strictEqual(getMockElement('tab-btn-password').classList.contains('active'), true);
  assert.strictEqual(getMockElement('auth-password-form').style.display, 'flex');
});

test('AuthControllerService: setAuthMode toggles login/signup', () => {
  AuthControllerService.setAuthMode('signup');
  const submitBtn = getMockElement('auth-password-submit-btn');
  assert.ok(submitBtn.textContent.length > 0);

  AuthControllerService.setAuthMode('login');
  assert.ok(submitBtn.textContent.length > 0);
});

test('AuthControllerService: formatAuthErrorMessage localizes known error messages', () => {
  state.lang = 'el';
  const elErr = AuthControllerService.formatAuthErrorMessage('over_email_send_rate_limit');
  assert.ok(elErr.includes('Υπέρβαση ορίου αποστολής email'), 'Must translate rate limit in Greek');

  state.lang = 'en';
  const enErr = AuthControllerService.formatAuthErrorMessage('over_email_send_rate_limit');
  assert.ok(enErr.includes('Email rate limit reached'), 'Must translate rate limit in English');
});

test('AuthControllerService: showAuthStatus and clearAuthStatus update status message', () => {
  AuthControllerService.showAuthStatus('Testing error', 'error');
  const statusEl = getMockElement('auth-status-message');
  assert.strictEqual(statusEl.style.display, 'block');
  assert.ok(statusEl.textContent.includes('Testing error'));

  AuthControllerService.clearAuthStatus();
  assert.strictEqual(statusEl.style.display, 'none');
});
