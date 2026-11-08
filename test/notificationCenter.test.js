const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.document = {
  getElementById(id) {
    return {
      id,
      innerHTML: '',
      style: {},
      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {}
    };
  }
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); }
};
global.state = {
  lang: 'el',
  notifications: []
};
global.generateUUID = () => 'test-uuid-1234';
global.escapeHtml = (s) => String(s || '');

const NotificationCenter = require('../js/notificationCenter.js');

test('NotificationCenter exports expected functions', () => {
  assert.strictEqual(typeof NotificationCenter.uuidToNotificationId, 'function');
  assert.strictEqual(typeof NotificationCenter.loadNotifications, 'function');
  assert.strictEqual(typeof NotificationCenter.saveNotifications, 'function');
  assert.strictEqual(typeof NotificationCenter.updateNotificationBadge, 'function');
  assert.strictEqual(typeof NotificationCenter.addInAppNotification, 'function');
  assert.strictEqual(typeof NotificationCenter.openNotificationCenterModal, 'function');
  assert.strictEqual(typeof NotificationCenter.renderNotificationList, 'function');
  assert.strictEqual(typeof NotificationCenter.clearNotifications, 'function');
  assert.strictEqual(typeof NotificationCenter.handleNotificationAction, 'function');
  assert.strictEqual(typeof NotificationCenter.initLocalNotifications, 'function');
  assert.strictEqual(typeof NotificationCenter.notifyPartnerTransaction, 'function');
  assert.strictEqual(typeof NotificationCenter.notifyPartnerTransactionsSummary, 'function');
  assert.strictEqual(typeof global.window.initLocalNotifications, 'function');
});

test('uuidToNotificationId generates numeric hash', () => {
  const hash = NotificationCenter.uuidToNotificationId('12345678-1234-1234-1234-123456789abc');
  assert.strictEqual(typeof hash, 'number');
  assert.ok(hash > 0);
});

test('addInAppNotification adds item to state and localStorage', () => {
  NotificationCenter.addInAppNotification('Test Title', 'Test Body');
  assert.strictEqual(state.notifications.length, 1);
  assert.strictEqual(state.notifications[0].title, 'Test Title');
  assert.strictEqual(state.notifications[0].read, false);
});

test('notifyPartnerTransaction creates notification for partner and avoids duplicates', () => {
  global.state.currentUser = { id: 'mario-123' };
  global.state.familyProfiles = [
    { id: 'mario-123', display_name: 'Μάριος' },
    { id: 'vasiliki-456', display_name: 'Βασιλική' }
  ];

  // 1. Transaction by current user should NOT trigger a notification
  const ownTx = { id: 'tx-own', user_id: 'mario-123', type: 'expense', amount: 20, category: 'Food' };
  NotificationCenter.notifyPartnerTransaction(ownTx);
  assert.ok(!state.notifications.some(n => n.action && n.action.transactionId === 'tx-own'));

  // 2. Transaction by partner should trigger an in-app notification
  const partnerTx = { id: 'tx-vas-1', user_id: 'vasiliki-456', type: 'expense', amount: 35.5, category: 'Supermarket', notes: 'Σκλαβενίτης' };
  NotificationCenter.notifyPartnerTransaction(partnerTx);
  const notif = state.notifications.find(n => n.action && n.action.transactionId === 'tx-vas-1');
  assert.ok(notif, 'Notification should be created');
  assert.ok(notif.title.includes('Βασιλική'), 'Title should mention member name');
  assert.ok(notif.body.includes('35.50'), 'Body should mention amount');

  // 3. Second call with same transaction should be ignored (deduplicated)
  const countBefore = state.notifications.length;
  NotificationCenter.notifyPartnerTransaction(partnerTx);
  assert.strictEqual(state.notifications.length, countBefore, 'Duplicate transaction notification should be ignored');
});

test('notifyPartnerTransactionsSummary creates a batched summary notification', () => {
  global.state.currentUser = { id: 'mario-123' };
  global.state.familyProfiles = [
    { id: 'vasiliki-456', display_name: 'Βασιλική' }
  ];

  const txs = [
    { id: 'tx-1', user_id: 'vasiliki-456', amount: 10 },
    { id: 'tx-2', user_id: 'vasiliki-456', amount: 20 },
    { id: 'tx-3', user_id: 'vasiliki-456', amount: 30 },
    { id: 'tx-4', user_id: 'vasiliki-456', amount: 40 }
  ];

  NotificationCenter.notifyPartnerTransactionsSummary(txs);
  const summaryNotif = state.notifications[0];
  assert.ok(summaryNotif.title.includes('4 νέες κινήσεις'), 'Summary title should mention transaction count');
  assert.ok(summaryNotif.title.includes('Βασιλική'), 'Summary title should mention partner name');
  assert.ok(summaryNotif.body.includes('100.00'), 'Summary body should calculate total amount');
});
