const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Tests for the Capacitor deep-link bridge in js/gestureEngine.js.
//
// The bank flow returns to the app through a custom-scheme deep link. The bridge
// must forward those links to OpenBankingService while leaving every other link
// (e.g. a Supabase PKCE login that also carries `?code=`) untouched.
// ---------------------------------------------------------------------------

const listeners = {};
const forwardedUrls = [];
let browserCloseCalls = 0;

global.localStorage = {
  _store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.window = {
  location: {
    protocol: 'capacitor:',
    hostname: 'localhost',
    pathname: '/',
    search: '',
    hash: '',
    href: 'capacitor://localhost/'
  },
  localStorage: global.localStorage,
  addEventListener() {},
  matchMedia() {
    return { matches: false, addEventListener() {}, removeEventListener() {} };
  },
  Capacitor: {
    isNativePlatform: () => true,
    Plugins: {
      App: {
        addListener(event, callback) {
          listeners[event] = callback;
          return Promise.resolve({});
        },
        // Cold-start launch URL: intentionally empty so the tests below control
        // exactly which links reach the bridge.
        getLaunchUrl: () => Promise.resolve(null)
      },
      Browser: {
        close() {
          browserCloseCalls += 1;
          return Promise.resolve();
        }
      }
    }
  },
  OpenBankingService: {
    checkForAuthCallback(url) {
      forwardedUrls.push(url);
      return Promise.resolve();
    }
  }
};

global.history = { pushState() {} };
global.document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  addEventListener() {},
  readyState: 'complete'
};
global.state = { historyPushed: false };

const GestureEngine = require('../js/gestureEngine.js');

// The Capacitor listeners (back button + deep links) are installed by
// initSwipeToBack(), which the app calls during boot.
GestureEngine.initSwipeToBack();

function deepLink(params) {
  return 'com.budgetassistant.app://login-callback?' + params;
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('deep links: appUrlOpen listener is registered with the App plugin', () => {
  assert.equal(typeof listeners.appUrlOpen, 'function');
});

test('deep links: a bank callback with the JSON state blob is forwarded to OpenBankingService', async () => {
  const state = JSON.stringify({ userId: 'user-1', bankName: 'Eurobank', timestamp: Date.now() });
  const url = deepLink('code=auth-code-1&state=' + encodeURIComponent(state));
  const before = forwardedUrls.length;

  await listeners.appUrlOpen({ url });
  await nextTick();

  assert.equal(forwardedUrls.length, before + 1);
  assert.equal(forwardedUrls[forwardedUrls.length - 1], url);
  assert.ok(browserCloseCalls > 0, 'the in-app browser should be closed after the callback');
});

test('deep links: a success-only callback is treated as a bank callback', async () => {
  const url = 'com.budgetassistant.app://bank-callback?success=true';
  const before = forwardedUrls.length;

  await listeners.appUrlOpen({ url });
  await nextTick();

  assert.equal(forwardedUrls.length, before + 1);
  assert.equal(forwardedUrls[forwardedUrls.length - 1], url);
});

test('deep links: a Supabase PKCE login link is not forwarded to OpenBankingService', async () => {
  const url = deepLink('code=pkce-login-code');
  const before = forwardedUrls.length;

  await listeners.appUrlOpen({ url });
  await nextTick();

  assert.equal(forwardedUrls.length, before);
});

test('deep links: the same URL delivered twice in a row is only handled once', async () => {
  const state = JSON.stringify({ userId: 'user-2', bankName: 'Alpha Bank', timestamp: Date.now() });
  const url = deepLink('code=auth-code-2&state=' + encodeURIComponent(state));
  const before = forwardedUrls.length;

  await listeners.appUrlOpen({ url });
  await listeners.appUrlOpen({ url });
  await nextTick();

  assert.equal(forwardedUrls.length, before + 1);
});
