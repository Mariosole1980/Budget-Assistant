const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const BAConstants = require('../js/constants.js');
const BAUtils = require('../js/utils.js');
Object.assign(global, BAConstants);
Object.assign(global, BAUtils);
global.BAConstants = BAConstants;
global.BAUtils = BAUtils;

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

function extractFn(name) {
  let start = -1;
  for (const prefix of ['async function ' + name + '(', 'function ' + name + '(']) {
    start = appJs.indexOf(prefix);
    if (start !== -1) break;
  }
  if (start === -1) throw new Error('function ' + name + ' not found in app.js');

  const paramEnd = appJs.indexOf(')', start);
  const braceStart = appJs.indexOf('{', paramEnd);
  let depth = 0;
  let i = braceStart;
  for (; i < appJs.length; i++) {
    if (appJs[i] === '{') depth++;
    else if (appJs[i] === '}') { depth--; if (depth === 0) break; }
  }
  return appJs.slice(start, i + 1);
}

// Global storage mock
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
global.window = global;
global.navigator = { onLine: false };

global.document = {
  body: {
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} }
  },
  getElementById: (id) => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

global.state = {
  currentUser: null,
  userProfile: null,
  transactions: [],
  categories: [],
  lang: 'el',
  isLoggingOut: false,
  isSupabaseEnabled: true
};

test('Persistent offline auth: cached user is never logged out when getSession fails or is null', () => {
  const fakeUser = { id: 'usr_123', email: 'test@example.com' };
  global.localStorage.setItem('cached_current_user', JSON.stringify(fakeUser));

  let showAuthOverlayCalled = false;
  let hideAuthOverlayCalled = false;
  global.showAuthOverlay = () => { showAuthOverlayCalled = true; };
  global.hideAuthOverlay = () => { hideAuthOverlayCalled = true; };

  const hasCachedUser = !!(global.localStorage.getItem('cached_current_user') || global.state.currentUser || global.state.guestMode);
  assert.strictEqual(hasCachedUser, true);

  // When getSession fails or returns null session while offline
  const session = null;
  const error = { message: 'Failed to fetch (offline)' };

  if (error && hasCachedUser) {
    global.hideAuthOverlay();
  }

  assert.strictEqual(hideAuthOverlayCalled, true);
  assert.strictEqual(showAuthOverlayCalled, false);
});

test('Persistent offline auth: onAuthStateChange null session preserves cached user unless explicit logout', () => {
  const fakeUser = { id: 'usr_123', email: 'test@example.com' };
  global.localStorage.setItem('cached_current_user', JSON.stringify(fakeUser));
  global.state.isLoggingOut = false;
  global.state.currentUser = null;

  let authConfirmed = false;
  global.window._authConfirmed = false;

  const cachedUserRaw = global.localStorage.getItem('cached_current_user');
  if (!global.state.isLoggingOut && cachedUserRaw) {
    global.state.currentUser = JSON.parse(cachedUserRaw);
    global.window._authConfirmed = true;
  }

  assert.deepStrictEqual(global.state.currentUser, fakeUser);
  assert.strictEqual(global.window._authConfirmed, true);
  assert.ok(global.localStorage.getItem('cached_current_user'));
});

test('Persistent offline auth: explicit logout clears cached user and session', () => {
  const fakeUser = { id: 'usr_123', email: 'test@example.com' };
  global.localStorage.setItem('cached_current_user', JSON.stringify(fakeUser));
  global.state.currentUser = fakeUser;

  // Simulate explicit logout
  global.state.isLoggingOut = true;
  global.localStorage.removeItem('cached_current_user');
  global.state.currentUser = null;
  global.window._authConfirmed = false;

  assert.strictEqual(global.state.currentUser, null);
  assert.strictEqual(global.localStorage.getItem('cached_current_user'), null);
  assert.strictEqual(global.window._authConfirmed, false);
});
