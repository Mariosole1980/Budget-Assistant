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
      value: '',
      options: [{ text: 'Σούπερ Μάρκετ' }, { text: 'Καφές / Έξω' }],
      selectedIndex: 0
    };
  }
  return domElements[id];
}

global.document = {
  getElementById: getMockEl,
  addEventListener() {}
};

global.window = {
  document: global.document,
  localStorage: global.localStorage,
  state: global.state
};

global.BankNotificationParser = require('../js/bankNotificationParser.js');
const BankNotificationService = require('../js/bankNotificationService.js');

test('BankNotificationService: exports all core methods', () => {
  assert.equal(typeof BankNotificationService.init, 'function');
  assert.equal(typeof BankNotificationService.checkPending, 'function');
  assert.equal(typeof BankNotificationService.handleRawNotification, 'function');
  assert.equal(typeof BankNotificationService.acceptTransaction, 'function');
  assert.equal(typeof BankNotificationService.dismissTransaction, 'function');
  assert.equal(typeof BankNotificationService.handleToggle, 'function');
});

test('BankNotificationService: handleRawNotification parses and populates review modal', () => {
  let openedModalId = null;
  global.openModal = (id) => { openedModalId = id; };

  const notif = {
    packageName: 'gr.eurobank.ebanking',
    title: 'Eurobank',
    text: 'Αγορά 8,50 EUR στην επιχείρηση MIKEL'
  };

  BankNotificationService.handleRawNotification(notif);

  assert.equal(openedModalId, 'bank-tx-review-modal');
  assert.equal(getMockEl('bank-tx-review-bank').textContent, 'Eurobank');
  assert.equal(getMockEl('bank-tx-review-merchant').textContent, 'MIKEL');
  assert.equal(getMockEl('bank-tx-review-category').textContent, 'Καφές / Έξω');
});

test('BankNotificationService: acceptTransaction pre-fills add transaction modal', (t, done) => {
  let openedAddType = null;
  global.openAddTransactionModal = (type) => { openedAddType = type; };
  global.closeModal = () => {};
  global.showToast = () => {};

  BankNotificationService.acceptTransaction();

  assert.equal(openedAddType, 'expense');

  setTimeout(() => {
    assert.equal(getMockEl('modal-trans-amount').value, 8.5);
    assert.equal(getMockEl('modal-trans-note').value, 'MIKEL');
    done();
  }, 200);
});

test('BankNotificationService: handleToggle persists state in localStorage', () => {
  BankNotificationService.handleToggle(true);
  assert.equal(localStorage.getItem('bank_notifications_reader_enabled'), 'true');

  BankNotificationService.handleToggle(false);
  assert.equal(localStorage.getItem('bank_notifications_reader_enabled'), 'false');
});
