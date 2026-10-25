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

// ── Bank logos: always the official artwork returned by the provider ─────────
const providerInstitutionFixtures = [
  { name: 'National Bank of Greece', country: 'GR', logo: 'https://enablebanking.com/brands/GR/National%20Bank%20of%20Greece/' },
  { name: 'Eurobank', country: 'GR', logo: 'https://enablebanking.com/brands/GR/Eurobank/' },
  { name: 'Alpha Bank', country: 'GR', logo: 'https://enablebanking.com/brands/GR/Alpha%20Bank/' },
  { name: 'Piraeus Bank', country: 'GR', logo: 'https://enablebanking.com/brands/GR/Piraeus%20Bank/' },
  { name: 'Revolut', country: 'GR', logo: 'https://enablebanking.com/brands/GR/Revolut/' },
  // Must be dropped by the https-only sanitizer:
  { name: 'Evil Bank', country: 'GR', logo: 'javascript:alert(1)' },
  { name: 'Insecure Bank', country: 'GR', logo: 'http://insecure.example/bank.png' }
];

function stubBankApi(calls, connections) {
  return async (url, options) => {
    const target = String(url);
    calls.push({ url: target, method: (options && options.method) || 'GET' });
    if (target.includes('/api/bank-institutions')) {
      return { ok: true, status: 200, json: async () => ({ institutions: providerInstitutionFixtures }) };
    }
    if (target.includes('/api/bank-connections')) {
      return { ok: true, status: 200, json: async () => ({ connections: connections || [] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

test('OpenBankingService: loads official bank logos live from the provider endpoint', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = stubBankApi(calls);

  let logos;
  try {
    logos = await OpenBankingService.getInstitutionLogos();
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.filter((call) => call.url.includes('/api/bank-institutions')).length, 1);
  assert.ok(
    logos.eurobank.startsWith('https://enablebanking.com/brands/GR/Eurobank/'),
    'expected the provider Eurobank artwork, got: ' + logos.eurobank
  );
  // Monthly cache-bust so a refreshed logo is not pinned for a year by the
  // provider's `Cache-Control: immutable` response.
  assert.match(logos.eurobank, /[?&]v=\d{4}-\d{2}$/);
  // Only https artwork is accepted — no javascript:, no plain http:
  assert.equal(Object.prototype.hasOwnProperty.call(logos, 'evilbank'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(logos, 'insecurebank'), false);
});

test('OpenBankingService: every supported bank resolves to the current provider logo', async () => {
  const logos = await OpenBankingService.getInstitutionLogos();

  OpenBankingService.supportedBanks.forEach((bank) => {
    const url = OpenBankingService.resolveBankLogo(bank.name, logos);
    assert.match(url, /^https:\/\/enablebanking\.com\/brands\//, bank.name + ' should resolve a provider logo, got: ' + url);
  });
});

test('OpenBankingService: resolveBankLogo rejects unsafe/unknown sources and tolerates name variants', () => {
  assert.equal(OpenBankingService.resolveBankLogo('Eurobank', { eurobank: 'javascript:alert(1)' }), '');
  assert.equal(OpenBankingService.resolveBankLogo('Eurobank', { eurobank: 'http://insecure.example/bank.png' }), '');
  assert.equal(OpenBankingService.resolveBankLogo('Άγνωστη Τράπεζα', {}), '');
  assert.equal(OpenBankingService.resolveBankLogo('', {}), '');
  assert.equal(
    OpenBankingService.resolveBankLogo('ALPHA BANK S.A.', { alphabank: 'https://enablebanking.com/brands/GR/Alpha%20Bank/' }),
    'https://enablebanking.com/brands/GR/Alpha%20Bank/'
  );
});

test('OpenBankingService: connect modal renders provider logos for connected and available banks', async () => {
  const originalFetch = global.fetch;
  const connections = [{ id: 'conn-1', aspsp_name: 'Eurobank', bank_accounts: [{ balance: '120.00' }] }];
  global.fetch = stubBankApi([], connections);
  global.window.state = { session: { access_token: 'test-token' } };

  try {
    await OpenBankingService.openConnectModal();
  } finally {
    global.fetch = originalFetch;
    delete global.window.state;
  }

  const html = global.document.getElementById('open-banking-modal').innerHTML;
  const eurobankLogo = 'https://enablebanking.com/brands/GR/Eurobank/';

  assert.ok(html.includes(eurobankLogo), 'expected the official Eurobank logo in the modal');
  assert.equal(
    html.split(eurobankLogo).length - 1,
    2,
    'Eurobank logo must appear once for the connection row and once in the bank list'
  );
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(html.includes('decoding="async"'));
  // Graceful fallback when the provider image cannot be loaded (offline).
  assert.ok(html.includes('onerror="this.style.display=\'none\';"'));
  // Banks without a resolved logo still render an icon tile instead of nothing.
  assert.ok(html.includes('fa-solid fa-building-columns'));
  assert.ok(OpenBankingService.resolveBankLogo('Eurobank').startsWith(eurobankLogo));
});
