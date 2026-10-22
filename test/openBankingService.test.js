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
});

test('OpenBankingService: supportedBanks contains all Greek systemic banks and Revolut', () => {
  const bankNames = OpenBankingService.supportedBanks.map(b => b.name);
  assert.ok(bankNames.includes('National Bank of Greece'));
  assert.ok(bankNames.includes('Eurobank'));
  assert.ok(bankNames.includes('Alpha Bank'));
  assert.ok(bankNames.includes('Piraeus Bank'));
  assert.ok(bankNames.includes('Revolut'));
});

test('OpenBankingService: openConnectModal creates and displays modal without throwing', () => {
  assert.doesNotThrow(() => {
    OpenBankingService.openConnectModal();
  });
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
