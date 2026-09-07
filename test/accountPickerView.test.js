const { test } = require('node:test');
const assert = require('node:assert');

// Mock window and state
global.window = global;
global.state = {
  lang: 'el',
  accounts: [
    { name: 'Μετρητά', type: 'cash', is_active: true },
    { name: 'Τράπεζα', type: 'bank', is_active: true },
    { name: 'Κάρτα', type: 'card', is_active: true }
  ]
};

const AccountPickerView = require('../js/accountPickerView.js');

test('AccountPickerView exports all expected functions', () => {
  assert.strictEqual(typeof AccountPickerView.getAccountVisualInfo, 'function');
  assert.strictEqual(typeof AccountPickerView.getAccountDisplayName, 'function');
  assert.strictEqual(typeof AccountPickerView.openAccountPickerModal, 'function');
  assert.strictEqual(typeof AccountPickerView.renderAccountPickerOptions, 'function');
  assert.strictEqual(typeof AccountPickerView.selectAccountOption, 'function');
  assert.strictEqual(typeof AccountPickerView.updateAccountTriggerDisplay, 'function');
  assert.strictEqual(typeof AccountPickerView.updateAccountDropdowns, 'function');
});

test('AccountPickerView.getAccountVisualInfo returns correct metadata', () => {
  const cash = AccountPickerView.getAccountVisualInfo('cash');
  assert.strictEqual(cash.color, '#10b981');
  assert.strictEqual(cash.emoji, '💵');

  const card = AccountPickerView.getAccountVisualInfo('card');
  assert.strictEqual(card.color, '#f59e0b');

  const bank = AccountPickerView.getAccountVisualInfo('bank');
  assert.strictEqual(bank.color, '#3b82f6');

  const investment = AccountPickerView.getAccountVisualInfo('investment');
  assert.strictEqual(investment.color, '#8b5cf6');
});

test('AccountPickerView.getAccountDisplayName translates correctly for Greek and English', () => {
  global.state.lang = 'el';
  assert.strictEqual(AccountPickerView.getAccountDisplayName('cash'), 'Μετρητά');
  assert.strictEqual(AccountPickerView.getAccountDisplayName('bank'), 'Τράπεζα');
  assert.strictEqual(AccountPickerView.getAccountDisplayName('card'), 'Κάρτα');

  global.state.lang = 'en';
  assert.strictEqual(AccountPickerView.getAccountDisplayName('cash'), 'Cash');
  assert.strictEqual(AccountPickerView.getAccountDisplayName('bank'), 'Bank Account');
  assert.strictEqual(AccountPickerView.getAccountDisplayName('card'), 'Card');
});

test('AccountPickerView manages current picker target', () => {
  AccountPickerView.setCurrentTarget('to');
  assert.strictEqual(AccountPickerView.getCurrentTarget(), 'to');
  AccountPickerView.setCurrentTarget('from');
  assert.strictEqual(AccountPickerView.getCurrentTarget(), 'from');
});
