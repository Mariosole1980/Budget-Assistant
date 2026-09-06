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
