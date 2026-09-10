const test = require('node:test');
const assert = require('node:assert/strict');

// Import notificationHub in CommonJS Node environment
const notificationHub = require('../js/notificationHub.js');

test('notificationHub Module Tests', async (t) => {

  await t.test('1. exports all expected functions and controllers', () => {
    const expectedFns = [
      'formatNotificationDate',
      'renderNotificationCardHtml',
      'checkRecurringPaymentAlerts',
      'checkWeeklyAndMonthlyDigests',
      'checkPartnerActivityAlerts',
      'sendTestNotification',
      'toggleDailyReminder',
      'saveDailyReminderTime',
      'toggleRecurringAlerts',
      'toggleBudgetLimitAlerts',
      'toggleBankNotifications',
      'toggleExpenseAlert',
      'saveExpenseLimit',
      'toggleWeeklyDigest',
      'toggleMonthlyDigest',
      'togglePartnerAlerts',
      'renderNotificationHistory',
      'clearNotificationHistory',
      'onSubscreenShow_notifications'
    ];

    expectedFns.forEach(fn => {
      assert.strictEqual(typeof notificationHub[fn], 'function', `Expected ${fn} to be a function`);
    });
  });

  await t.test('2. formatNotificationDate', async (st) => {
    const { formatNotificationDate } = notificationHub;

    await st.test('returns localized formatted string for valid ISO timestamp', () => {
      const iso = '2026-03-15T14:30:00.000Z';
      const elFormatted = formatNotificationDate(iso, 'el');
      assert.ok(elFormatted.length > 0);

      const enFormatted = formatNotificationDate(iso, 'en');
      assert.ok(enFormatted.length > 0);
    });

    await st.test('safely handles empty, null, undefined or invalid dates', () => {
      assert.strictEqual(formatNotificationDate(''), '');
      assert.strictEqual(formatNotificationDate(null), '');
      assert.strictEqual(formatNotificationDate(undefined), '');
      assert.strictEqual(formatNotificationDate('invalid-date'), '');
    });
  });

  await t.test('3. renderNotificationCardHtml', async (st) => {
    const { renderNotificationCardHtml } = notificationHub;

    await st.test('renders complete notification card HTML with escaped title and message', () => {
      const notif = {
        title: '🔔 Payment Reminder',
        body: 'Rent is due tomorrow!',
        created_at: '2026-03-15T10:00:00.000Z'
      };

      const html = renderNotificationCardHtml(notif, 'en');
      assert.ok(html.includes('Payment Reminder'));
      assert.ok(html.includes('Rent is due tomorrow!'));
      assert.ok(html.includes('fa-bell'));
    });

    await st.test('safely handles empty or null notification object', () => {
      assert.strictEqual(renderNotificationCardHtml(null), '');
      assert.strictEqual(renderNotificationCardHtml(undefined), '');
    });
  });

});
