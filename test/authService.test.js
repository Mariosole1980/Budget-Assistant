const { test } = require('node:test');
const assert = require('node:assert');

// Setup minimal DOM mocks
const elements = {
  'auth-loading-state': { style: { display: 'none' } },
  'auth-card': { style: { display: 'flex' } },
  'sync-badge': { className: '', textContent: '' }
};

global.document = {
  getElementById: (id) => elements[id] || null,
  querySelector: () => null,
  addEventListener: () => {}
};

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { search: '', hash: '', pathname: '/', origin: 'http://localhost' },
  history: { replaceState: () => {} }
};

global.state = {
  isSupabaseEnabled: false,
  supabaseConfig: { url: 'https://mock.supabase.co', key: 'mock-key' },
  lang: 'el',
  currentUser: null,
  guestMode: false
};

global.updateHeaderSyncIcon = () => {};

const AuthService = require('../js/authService.js');

test('AuthService exports all expected functions', () => {
  assert.strictEqual(typeof AuthService.loadConfig, 'function');
  assert.strictEqual(typeof AuthService.initSupabase, 'function');
  assert.strictEqual(typeof AuthService.toggleLoader, 'function');
  assert.strictEqual(typeof AuthService.initSupabaseAuth, 'function');
  assert.strictEqual(typeof AuthService.loadUserProfiles, 'function');
  assert.strictEqual(typeof AuthService.showPendingInviteCodePrompt, 'function');
  assert.strictEqual(typeof AuthService.showPendingInvitationPrompt, 'function');
});

test('AuthService.loadConfig sets isSupabaseEnabled to true', () => {
  global.state.isSupabaseEnabled = false;
  AuthService.loadConfig();
  assert.strictEqual(global.state.isSupabaseEnabled, true);
});

test('AuthService.toggleLoader updates loading element display', () => {
  AuthService.toggleLoader(true);
  assert.strictEqual(elements['auth-loading-state'].style.display, 'flex');
  assert.strictEqual(elements['auth-card'].style.display, 'none');

  AuthService.toggleLoader(false);
  assert.strictEqual(elements['auth-loading-state'].style.display, 'none');
  assert.strictEqual(elements['auth-card'].style.display, 'flex');
});

test('AuthService.initSupabase handles offline/local mode safely when client missing', () => {
  global.state.isSupabaseEnabled = false;
  AuthService.initSupabase();
  assert.strictEqual(elements['sync-badge'].className, 'sync-badge offline');
  assert.strictEqual(elements['sync-badge'].textContent, 'Local Mode');
});
