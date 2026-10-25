const test = require('node:test');
const assert = require('node:assert/strict');

// Setup mock DOM & environment
global.state = { lang: 'el' };
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

const domElements = {};
function getMockEl(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      style: {},
      textContent: '',
      innerHTML: '',
      className: '',
      appendChild(child) {}
    };
  }
  return domElements[id];
}

global.document = {
  getElementById: getMockEl,
  createElement(tag) {
    return {
      tagName: tag,
      id: '',
      className: '',
      style: {},
      innerHTML: '',
      appendChild() {}
    };
  },
  body: {
    appendChild(child) {}
  },
  title: 'Budget Assistant',
  addEventListener() {}
};

global.window = {
  document: global.document,
  localStorage: global.localStorage,
  location: {
    origin: 'https://www.budgetassistant.org',
    pathname: '/index.html',
    search: '',
    href: 'https://www.budgetassistant.org/index.html'
  },
  history: {
    replaceState() {}
  },
  showToast: () => {},
  showAlert: () => {}
};

const OpenBankingService = require('../js/openBankingService.js');

test('OpenBankingService: exports expected API methods', () => {
  assert.equal(typeof OpenBankingService.supportedBanks, 'object');
  assert.equal(Array.isArray(OpenBankingService.supportedBanks), true);
  assert.equal(typeof OpenBankingService.openConnectModal, 'function');
  assert.equal(typeof OpenBankingService.closeConnectModal, 'function');
  assert.equal(typeof OpenBankingService.startConnection, 'function');
  assert.equal(typeof OpenBankingService.syncTransactions, 'function');
  assert.equal(typeof OpenBankingService.checkForAuthCallback, 'function');
  assert.equal(typeof OpenBankingService.getConnectedBanks, 'function');
  assert.equal(typeof OpenBankingService.disconnectBank, 'function');
});

test('OpenBankingService: supportedBanks contains all Greek systemic banks and Revolut', () => {
  const bankNames = OpenBankingService.supportedBanks.map(b => b.name);
  assert.ok(bankNames.includes('National Bank of Greece'));
  assert.ok(bankNames.includes('Eurobank'));
  assert.ok(bankNames.includes('Alpha Bank'));
  assert.ok(bankNames.includes('Piraeus Bank'));
  assert.ok(bankNames.includes('Revolut'));
});

test('OpenBankingService: openConnectModal creates and displays modal without throwing', async () => {
  await OpenBankingService.openConnectModal();
  const modal = global.document.getElementById('open-banking-modal');
  assert.ok(modal);
  assert.equal(modal.style.display, 'flex');

  OpenBankingService.closeConnectModal();
  assert.equal(modal.style.display, 'none');
});

test('OpenBankingService: syncTransactions guards against unauthenticated user', async () => {
  const result = await OpenBankingService.syncTransactions({ silent: true });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Unauthorized');
});

test('OpenBankingService: recoverPendingConnection is exported for app-resume recovery', () => {
  assert.equal(typeof OpenBankingService.recoverPendingConnection, 'function');
});

function stubFetch(calls) {
  return async (url, options) => {
    calls.push({
      url: String(url),
      method: (options && options.method) || 'GET',
      body: options && options.body
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
}

test('OpenBankingService: a bare Supabase PKCE code is not forwarded to /api/bank-callback', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = stubFetch(calls);

  try {
    // Supabase PKCE logins also come back with ?code=... — only a bank callback
    // carries the JSON state blob produced by /api/bank-auth.
    await OpenBankingService.checkForAuthCallback(
      'https://www.budgetassistant.org/index.html?code=pkce-login-code&state=not-a-bank-state'
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.filter((call) => call.url.includes('/api/bank-callback')).length, 0);
});

test('OpenBankingService: a bank callback carrying the JSON state blob is forwarded to /api/bank-callback', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const state = JSON.stringify({ userId: 'user-1', bankName: 'Eurobank', timestamp: Date.now() });

  global.localStorage.setItem('ob_auth_bank', 'Eurobank');
  global.fetch = stubFetch(calls);

  try {
    await OpenBankingService.checkForAuthCallback(
      'com.budgetassistant.app://login-callback?code=auth-code-1&state=' + encodeURIComponent(state)
    );
  } finally {
    global.fetch = originalFetch;
    global.localStorage.removeItem('ob_auth_bank');
    global.localStorage.removeItem('ob_processed_code');
  }

  const posted = calls.filter((call) => call.url.includes('/api/bank-callback'));
  assert.equal(posted.length, 1, 'expected exactly one callback POST');

  const payload = JSON.parse(posted[0].body);
  assert.equal(payload.code, 'auth-code-1');
  assert.equal(payload.state, state);
  assert.equal(payload.bankName, 'Eurobank');
});

test('OpenBankingService: duplicate deliveries of the same bank code only post once', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const state = JSON.stringify({ userId: 'user-2', bankName: 'Alpha Bank', timestamp: Date.now() });
  const url = 'com.budgetassistant.app://login-callback?code=auth-code-2&state=' + encodeURIComponent(state);

  global.fetch = stubFetch(calls);

  try {
    await OpenBankingService.checkForAuthCallback(url);
    await OpenBankingService.checkForAuthCallback(url);
  } finally {
    global.fetch = originalFetch;
    global.localStorage.removeItem('ob_processed_code');
  }

  assert.equal(calls.filter((call) => call.url.includes('/api/bank-callback')).length, 1);
});

test('OpenBankingService: a success-only deep link triggers recovery instead of a callback POST', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = stubFetch(calls);

  try {
    await OpenBankingService.checkForAuthCallback('com.budgetassistant.app://bank-callback?success=true');
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.filter((call) => call.url.includes('/api/bank-callback')).length, 0);
});
