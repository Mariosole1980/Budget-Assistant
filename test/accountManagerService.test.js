const { test } = require('node:test');
const assert = require('node:assert');

// Mock DOM & environment
global.window = global;
global.state = {
  lang: 'el',
  accounts: [
    { name: 'Μετρητά', type: 'cash', balance: 150, is_active: true },
    { name: 'Τράπεζα', type: 'bank', balance: 1200, is_active: true }
  ],
  transactions: []
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
      children: [],
      appendChild(el) {
        this.children.push(el);
        this.innerHTML += (el.innerHTML || '');
      },
      querySelector() { return { onclick: null, addEventListener() {} }; },
      querySelectorAll() { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      innerHTML: '',
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      querySelector() {
        return { onclick: null, addEventListener() {} };
      }
    };
  },
  getElementById(id) {
    return getMockElement(id);
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return getMockElement(sel.slice(1));
    return { onclick: null, addEventListener() {} };
  },
  querySelectorAll() {
    return [];
  }
};

let openedModal = null;
let closedModal = null;
global.openModal = (id) => { openedModal = id; };
global.closeModal = (id) => { closedModal = id; };

let addTxModalType = null;
global.openAddTransactionModal = (type) => { addTxModalType = type; };

global.escapeHtml = (str) => String(str || '');
global.getAccountVisualInfo = (acc) => ({ iconClass: 'fa-wallet', color: '#10b981', bg: 'rgba(16,185,129,0.15)' });
global.getAccountDisplayName = (acc) => acc.name || 'Account';
global.getCurrencySymbol = () => '€';
global.formatDisplayAmount = (amt) => String(amt);
global.updateUI = () => {};

const AccountManagerService = require('../js/accountManagerService.js');

test('AccountManagerService: exports all expected functions', () => {
  const expectedFns = [
    'openSettingsAccountManager',
    'renderAccountManagerList',
    'openAccountEditorModal',
    'selectAccountEditorType',
    'saveAccountEditor',
    'deleteAccountFromManager',
    'openSettleUpModal',
    'recordSettlementTransaction'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof AccountManagerService[fn], 'function', `${fn} must be a function`);
  });
});

test('AccountManagerService: renderAccountManagerList populates container and count label', () => {
  AccountManagerService.renderAccountManagerList();
  const container = getMockElement('account-manager-list');
  const countLabel = getMockElement('acc-mgr-count-label');

  assert.ok(container.innerHTML.includes('Μετρητά'), 'List must include cash account');
  assert.ok(container.innerHTML.includes('Τράπεζα'), 'List must include bank account');
  assert.strictEqual(countLabel.textContent, 'Σύνολο: 2 πορτοφόλια');
});

test('AccountManagerService: openSettingsAccountManager renders list and opens modal', () => {
  openedModal = null;
  AccountManagerService.openSettingsAccountManager();
  assert.strictEqual(openedModal, 'account-manager-modal');
});

test('AccountManagerService: selectAccountEditorType updates input and highlights pill', () => {
  const input = getMockElement('acc-editor-type');
  AccountManagerService.selectAccountEditorType('card');
  assert.strictEqual(input.value, 'card');
});

test('AccountManagerService: recordSettlementTransaction closes settle-up modal and opens transfer', () => {
  closedModal = null;
  addTxModalType = null;
  AccountManagerService.recordSettlementTransaction();
  assert.strictEqual(closedModal, 'settle-up-modal');
  assert.strictEqual(addTxModalType, 'transfer');
});
