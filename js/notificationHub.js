/**
 * js/notificationHub.js
 *
 * In-App Notifications Engine & History Hub.
 * Extracted from app.js (Phase 8B Architectural Domain Extraction).
 *
 * Features:
 * - Recurring payment due reminders (scans upcoming bills, schedules native local notifications)
 * - Weekly & Monthly financial digests (aggregates spending trends, triggers alerts)
 * - Partner activity alerts (shared family transactions)
 * - Immediate test notification generator
 * - Notification preferences toggles (daily reminders, expense limits, digests, partner alerts)
 * - Notification history viewer & cleaner
 * - UMD wrapper exposing methods globally to window and pure helpers to Node tests
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

  /**
   * Pure helper: format notification timestamp to localized string.
   */
  function formatNotificationDate(rawTime, lang) {
    if (!rawTime) return '';
    try {
      var d = new Date(rawTime);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString((lang || 'el') === 'el' ? 'el-GR' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  /**
   * Pure helper: render single notification card HTML.
   */
  function renderNotificationCardHtml(n, lang) {
    if (!n) return '';
    var rawTime = n.timestamp || n.date || n.created_at;
    var formattedDate = formatNotificationDate(rawTime, lang);
    var esc = (typeof escapeHtml === 'function') ? escapeHtml : function (s) { return String(s || ''); };

    return '<div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:12px; padding:12px; display:flex; gap:12px; align-items:flex-start;">' +
      '<div style="width:28px; height:28px; border-radius:8px; background:rgba(239,68,68,0.15); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:13px; margin-top:2px; flex-shrink: 0;">' +
        '<i class="fa-solid fa-bell"></i>' +
      '</div>' +
      '<div style="flex:1; display:flex; flex-direction:column; gap:2px; min-width: 0;">' +
        '<div style="font-size:13px; font-weight:700; color:var(--text-primary); word-break: break-word;">' + esc(n.title || '') + '</div>' +
        '<div style="font-size:12px; color:var(--text-secondary); line-height:1.4; word-break: break-word;">' + esc(n.body || n.message || '') + '</div>' +
        '<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">' + formattedDate + '</div>' +
      '</div>' +
    '</div>';
  }

window.onSubscreenShow_notifications = function () {

  const quickAddEnabled = localStorage.getItem('quick_add_notification_enabled') === 'true';
  const quickAddCb = document.getElementById('settings-quick-add-notification');
  if (quickAddCb) quickAddCb.checked = quickAddEnabled;
  const quickAddSyncCb = document.getElementById('settings-quick-add-notification-sync');
  if (quickAddSyncCb) quickAddSyncCb.checked = quickAddEnabled;

  const dailyReminderEnabled = localStorage.getItem('settings_daily_reminder_enabled') === 'true';
  const dailyReminderCheckbox = document.getElementById('settings-daily-reminder');
  if (dailyReminderCheckbox) dailyReminderCheckbox.checked = dailyReminderEnabled;

  const timeRow = document.getElementById('settings-daily-reminder-time-row');
  if (timeRow) timeRow.style.display = dailyReminderEnabled ? 'flex' : 'none';

  const dailyTime = localStorage.getItem('settings_daily_reminder_time') || '21:00';
  const dailyTimeDisplay = document.getElementById('settings-daily-reminder-time-display');
  if (dailyTimeDisplay) dailyTimeDisplay.textContent = dailyTime;

  // Refresh the "⚡ Exact Notification Time" status badge.
  if (typeof window.refreshExactAlarmBadge === 'function') window.refreshExactAlarmBadge();

  const recurringAlertsEnabled = localStorage.getItem('settings_recurring_alerts_enabled') !== 'false';
  const recurringAlertsCheckbox = document.getElementById('settings-recurring-alerts');
  if (recurringAlertsCheckbox) recurringAlertsCheckbox.checked = recurringAlertsEnabled;

  const expenseAlertEnabled = localStorage.getItem('settings_expense_alert_enabled') === 'true';
  const expenseAlertCheckbox = document.getElementById('settings-expense-alert');
  if (expenseAlertCheckbox) expenseAlertCheckbox.checked = expenseAlertEnabled;

  const limitRow = document.getElementById('settings-expense-alert-limit-row');
  if (limitRow) limitRow.style.display = expenseAlertEnabled ? 'flex' : 'none';

  const expenseLimit = localStorage.getItem('settings_expense_alert_limit') || '500';
  const expenseLimitInput = document.getElementById('settings-expense-alert-limit');
  if (expenseLimitInput) expenseLimitInput.value = expenseLimit;

  const weeklyDigestEnabled = localStorage.getItem('settings_weekly_digest_enabled') !== 'false';
  const weeklyDigestCheckbox = document.getElementById('settings-weekly-digest');
  if (weeklyDigestCheckbox) weeklyDigestCheckbox.checked = weeklyDigestEnabled;

  const monthlyDigestEnabled = localStorage.getItem('settings_monthly_digest_enabled') !== 'false';
  const monthlyDigestCheckbox = document.getElementById('settings-monthly-digest');
  if (monthlyDigestCheckbox) monthlyDigestCheckbox.checked = monthlyDigestEnabled;

  const partnerAlertsEnabled = localStorage.getItem('settings_partner_alerts_enabled') !== 'false';
  const partnerAlertsCheckbox = document.getElementById('settings-partner-alerts');
  if (partnerAlertsCheckbox) partnerAlertsCheckbox.checked = partnerAlertsEnabled;

  if (typeof window.renderNotificationHistory === 'function') {
    window.renderNotificationHistory();
  }
};

function checkRecurringPaymentAlerts() {
  try {
    const enabled = localStorage.getItem('settings_recurring_alerts_enabled') !== 'false';
    if (!enabled) return;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const recurringList = state.recurringTransactions || [];
    recurringList.forEach((item, index) => {
      if (!item || !item.next_date) return;
      const nextDateStr = String(item.next_date).slice(0, 10);
      if (nextDateStr === tomorrowStr) {
        const alertKey = `recurring_alert_sent_${item.id}_${nextDateStr}`;
        if (localStorage.getItem(alertKey)) return;

        const title = state.lang === 'el' ? '🔔 Υπενθύμιση Πληρωμής' : '🔔 Payment Reminder';
        const catName = getCategoryDisplayName ? getCategoryDisplayName(item.category) : (item.category || '');
        const body = state.lang === 'el'
          ? `Η πληρωμή «${item.note || catName}» (${formatCurrency(item.amount)}) λήγει αύριο!`
          : `Payment "${item.note || catName}" (${formatCurrency(item.amount)}) is due tomorrow!`;

        addInAppNotification(title, body, { type: 'open_transactions' });
        localStorage.setItem(alertKey, 'true');

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
          window.Capacitor.Plugins.LocalNotifications.schedule({
            notifications: [{
              id: 8000 + index,
              title: title,
              body: body,
              smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
              schedule: { at: new Date(Date.now() + 1000) },
              extra: { type: 'recurring_alert' }
            }]
          }).catch(err => console.warn('Failed native recurring notification:', err));
        }
      }
    });
  } catch (err) {
    console.warn('checkRecurringPaymentAlerts error:', err);
  }
}
window.checkRecurringPaymentAlerts = checkRecurringPaymentAlerts;

function checkWeeklyAndMonthlyDigests(manualCheck = false) {
  try {
    const weeklyEnabled = localStorage.getItem('settings_weekly_digest_enabled') !== 'false';
    const monthlyEnabled = localStorage.getItem('settings_monthly_digest_enabled') !== 'false';
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentDate = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isEl = (state.lang === 'el');

    // 1. Weekly Digest Check (Every Sunday evening >= 18:00 or manual check)
    if (weeklyEnabled && ((currentDay === 0 && currentHour >= 18) || (manualCheck && currentDay === 0))) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      const weekKey = `weekly_digest_sent_${d.getUTCFullYear()}_W${weekNo}`;

      if (!localStorage.getItem(weekKey) || manualCheck) {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        let thisWeekExp = 0;
        let thisWeekInc = 0;
        let prevWeekExp = 0;

        (state.transactions || []).forEach(t => {
          if (!t.date || isTransferTransaction(t)) return;
          const datePart = String(t.date || '').split('T')[0].split(' ')[0];
          const parts = datePart.split('-');
          if (parts.length !== 3) return;
          const ty = parseInt(parts[0], 10);
          const tm = parseInt(parts[1], 10) - 1;
          const td = parseInt(parts[2], 10);
          const tDate = new Date(ty, tm, td, 12, 0, 0);
          
          const amt = CurrencyService.toBase(t);
          if (tDate >= sevenDaysAgo && tDate <= now) {
            if (t.type === 'expense') thisWeekExp += amt;
            if (t.type === 'income') thisWeekInc += amt;
          } else if (tDate >= fourteenDaysAgo && tDate < sevenDaysAgo) {
            if (t.type === 'expense') prevWeekExp += amt;
          }
        });

        if (thisWeekExp > 0 || thisWeekInc > 0) {
          let trendStr = '';
          if (prevWeekExp > 0) {
            const diffPct = Math.round(((thisWeekExp - prevWeekExp) / prevWeekExp) * 100);
            trendStr = diffPct > 0 ? ` (+${diffPct}%)` : ` (${diffPct}%)`;
          }

          const title = isEl ? '📊 Εβδομαδιαία Οικονομική Σύνοψη' : '📊 Weekly Financial Digest';
          const body = isEl
            ? `Αυτή την εβδομάδα: Έξοδα ${formatCurrency(thisWeekExp)}${trendStr}, Έσοδα ${formatCurrency(thisWeekInc)}. Καλή νέα εβδομάδα!`
            : `This week: Expenses ${formatCurrency(thisWeekExp)}${trendStr}, Income ${formatCurrency(thisWeekInc)}. Have a great week!`;

          addInAppNotification(title, body, { type: 'open_analytics' });
          localStorage.setItem(weekKey, 'true');

          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            window.Capacitor.Plugins.LocalNotifications.schedule({
              notifications: [{
                id: 8500,
                title: title,
                body: body,
                smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
                schedule: { at: new Date(Date.now() + 1000) },
                extra: { type: 'weekly_digest' }
              }]
            }).catch(e => console.warn('Failed native weekly digest:', e));
          }
        }
      }
    }

    // 2. Monthly Review Check (On day 1 of month or manual check)
    const monthStartDay = parseInt(localStorage.getItem('app_month_start') || '1', 10);
    if (monthlyEnabled && (currentDate === monthStartDay || manualCheck)) {
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const monthKey = `monthly_review_sent_${prevYear}_${prevMonth + 1}`;

      if (!localStorage.getItem(monthKey) || manualCheck) {
        let prevMonthExp = 0;
        let prevMonthInc = 0;

        let startOfPrev, endOfPrev;
        if (monthStartDay === 1) {
          startOfPrev = new Date(prevYear, prevMonth, 1, 0, 0, 0);
          endOfPrev = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);
        } else {
          startOfPrev = new Date(prevMonth === 0 ? prevYear - 1 : prevYear, prevMonth === 0 ? 11 : prevMonth - 1, monthStartDay, 0, 0, 0);
          endOfPrev = new Date(prevYear, prevMonth, monthStartDay - 1, 23, 59, 59);
        }

        (state.transactions || []).forEach(t => {
          if (!t.date || isTransferTransaction(t)) return;
          // Robust local date parse
          const datePart = String(t.date || '').split('T')[0].split(' ')[0];
          const parts = datePart.split('-');
          if (parts.length !== 3) return;
          const ty = parseInt(parts[0], 10);
          const tm = parseInt(parts[1], 10) - 1;
          const td = parseInt(parts[2], 10);
          const tDate = new Date(ty, tm, td, 12, 0, 0);

          if (tDate >= startOfPrev && tDate <= endOfPrev) {
            const amt = CurrencyService.toBase(t);
            if (t.type === 'expense') prevMonthExp += amt;
            if (t.type === 'income') prevMonthInc += amt;
          }
        });

        if (prevMonthExp > 0 || prevMonthInc > 0) {
          const savings = prevMonthInc - prevMonthExp;
          const savingsRate = prevMonthInc > 0 ? Math.round((savings / prevMonthInc) * 100) : 0;
          const monthName = getMonthName(prevMonth);

          const title = isEl ? `📅 Μηνιαία Ανασκόπηση (${monthName})` : `📅 Monthly Review (${monthName})`;
          const body = isEl
            ? `Έξοδα: ${formatCurrency(prevMonthExp)} | Έσοδα: ${formatCurrency(prevMonthInc)} | Αποταμίευση: ${formatCurrency(savings)} (${savingsRate}%)`
            : `Expenses: ${formatCurrency(prevMonthExp)} | Income: ${formatCurrency(prevMonthInc)} | Savings: ${formatCurrency(savings)} (${savingsRate}%)`;

          addInAppNotification(title, body, { type: 'open_analytics' });
          localStorage.setItem(monthKey, 'true');

          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            window.Capacitor.Plugins.LocalNotifications.schedule({
              notifications: [{
                id: 8600,
                title: title,
                body: body,
                smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
                schedule: { at: new Date(Date.now() + 1000) },
                extra: { type: 'monthly_review' }
              }]
            }).catch(e => console.warn('Failed native monthly review:', e));
          }
        }
      }
    }
  } catch (err) {
    console.warn('checkWeeklyAndMonthlyDigests error:', err);
  }
}
window.checkWeeklyAndMonthlyDigests = checkWeeklyAndMonthlyDigests;

function checkPartnerActivityAlerts(transactions) {
  try {
    const enabled = localStorage.getItem('settings_partner_alerts_enabled') !== 'false';
    if (!enabled || !state.currentUser || !Array.isArray(transactions) || transactions.length === 0) return;

    let seenIds = new Set();
    try {
      const stored = localStorage.getItem('seen_partner_tx_ids');
      if (stored) seenIds = new Set(JSON.parse(stored));
    } catch (e) { }

    const myUserId = state.currentUser.id;
    const isEl = (state.lang === 'el');

    transactions.forEach((tx, idx) => {
      if (!tx || !tx.id) return;
      const txUserId = tx.user_id || tx.created_by;

      if (txUserId && txUserId !== myUserId && !seenIds.has(String(tx.id))) {
        seenIds.add(String(tx.id));

        let partnerName = isEl ? 'Συνεργάτης' : 'Partner';
        if (state.familyProfiles && Array.isArray(state.familyProfiles)) {
          const profile = state.familyProfiles.find(p => p.id === txUserId);
          if (profile && profile.display_name) partnerName = profile.display_name;
        } else if (state.partnerProfile && state.partnerProfile.display_name) {
          partnerName = state.partnerProfile.display_name;
        }

        const catName = getCategoryDisplayName ? getCategoryDisplayName(tx.category) : (tx.category || '');
        const desc = tx.note ? `${tx.note} (${catName})` : catName;
        const amt = formatCurrency(tx.amount || 0);

        const title = isEl ? `👥 Νέα Συναλλαγή από ${partnerName}` : `👥 New Transaction by ${partnerName}`;
        const body = isEl
          ? `Καταγράφηκε: «${desc}» αξίας ${amt}`
          : `Recorded: "${desc}" for ${amt}`;

        addInAppNotification(title, body, { type: 'open_transactions' });

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
          window.Capacitor.Plugins.LocalNotifications.schedule({
            notifications: [{
              id: 9000 + (idx % 100),
              title: title,
              body: body,
              smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
              schedule: { at: new Date(Date.now() + 500) },
              extra: { type: 'partner_activity' }
            }]
          }).catch(e => console.warn('Failed partner notification:', e));
        }
      } else if (tx.id) {
        seenIds.add(String(tx.id));
      }
    });

    const seenArray = Array.from(seenIds).slice(-300);
    localStorage.setItem('seen_partner_tx_ids', JSON.stringify(seenArray));
  } catch (err) {
    console.warn('checkPartnerActivityAlerts error:', err);
  }
}
window.checkPartnerActivityAlerts = checkPartnerActivityAlerts;

async function sendTestNotification() {
  const title = state.lang === 'el' ? '🔔 Δοκιμαστική Ειδοποίηση' : '🔔 Test Notification';
  const body = state.lang === 'el'
    ? 'Οι ειδοποιήσεις της εφαρμογής Budget Assistant λειτουργούν κανονικά!'
    : 'Budget Assistant notifications are working properly on your device!';

  addInAppNotification(title, body, { type: 'open_transactions' });

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;

      // Ensure channel exists
      try {
        if (typeof LocalNotifications.createChannel === 'function') {
          await LocalNotifications.createChannel({
            id: 'budget_reminders',
            name: 'Budget Assistant Reminders',
            description: 'Daily expense reminders and alerts',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
            lightColor: '#7c6af7'
          });
        }
      } catch (chanErr) { }

      // ANTI-FLICKER: The Android permission dialog fires visibilitychange->hidden
      // + visualViewport resize, which re-flows the layout and causes a visible
      // flash. Stabilize the layout before the native dialog appears.
      if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
        window.stabilizeLayoutBeforeNativePicker();
      }
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [{
            id: 99999,
            title: title,
            body: body,
            channelId: 'budget_reminders',
            smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
            schedule: { at: new Date(Date.now() + 400), allowWhileIdle: true },
            extra: { type: 'test' }
          }]
        });
        showSyncToast(state.lang === 'el' ? '✓ Στάλθηκε δοκιμαστική ειδοποίηση συσκευής!' : '✓ Test notification sent to device!', 2500);
      } else {
        showSyncToast(state.lang === 'el' ? '⚠️ Παρακαλούμε επιτρέψτε τις ειδοποιήσεις στις ρυθμίσεις της συσκευής.' : '⚠️ Please grant notification permission in device settings.', 3000);
      }
    } catch (err) {
      console.warn('Test notification error:', err);
      showSyncToast(state.lang === 'el' ? '✓ Δοκιμαστική ειδοποίηση ελήφθη (εντός εφαρμογής)' : '✓ In-app test notification created', 2500);
    }
  } else {
    showSyncToast(state.lang === 'el' ? '✓ Δοκιμαστική ειδοποίηση ελήφθη (εντός εφαρμογής)' : '✓ In-app test notification created', 2500);
  }
}
window.sendTestNotification = sendTestNotification;

window.toggleDailyReminder = function (checked) {
  localStorage.setItem('settings_daily_reminder_enabled', checked ? 'true' : 'false');
  const timeRow = document.getElementById('settings-daily-reminder-time-row');
  if (timeRow) timeRow.style.display = checked ? 'flex' : 'none';
  if (typeof window.refreshExactAlarmBadge === 'function') window.refreshExactAlarmBadge();

  const timeVal = localStorage.getItem('settings_daily_reminder_time') || '21:00';
  if (typeof scheduleDailyReminder === 'function') {
    scheduleDailyReminder(checked, timeVal);
  }
  if (checked && typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? '✓ Ημερήσια υπενθύμιση ενεργοποιήθηκε' : '✓ Daily reminder enabled', 2000);
  }

  // EXACT-ALARM PROMPT: when the reminder is ON but the device has exact alarms
  // disabled, AlarmManager silently falls back to an INEXACT alarm which
  // Android typically delivers ~1 minute late. Open the system permission
  // screen right away (requestExactAlarmPermission() stabilizes the layout
  // before the handoff, so no flicker). No artificial delay / pre-toast.
  if (checked) {
    setTimeout(async () => {
      try {
        const exact = await window.getExactAlarmStatus();
        if (exact === false && typeof window.requestExactAlarmPermission === 'function') {
          window.requestExactAlarmPermission();
        }
      } catch (e) {
        console.warn('[ExactAlarm] check failed:', e);
      }
    }, 60);
  }
};

window.saveDailyReminderTime = function (val) {
  if (val) {
    localStorage.setItem('settings_daily_reminder_time', val);
    const enabled = localStorage.getItem('settings_daily_reminder_enabled') === 'true';
    if (enabled && typeof scheduleDailyReminder === 'function') {
      scheduleDailyReminder(true, val);
      if (typeof showSyncToast === 'function') {
        showSyncToast(state.lang === 'el' ? `✓ Ώρα υπενθύμισης ορίστηκε: ${val}` : `✓ Reminder time set to ${val}`, 2000);
      }
    }
  }
};

window.toggleRecurringAlerts = function (checked) {
  localStorage.setItem('settings_recurring_alerts_enabled', checked ? 'true' : 'false');
  if (checked) {
    checkRecurringPaymentAlerts();
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? '✓ Ειδοποιήσεις πληρωμών ενεργοποιήθηκαν' : '✓ Recurring payment alerts enabled', 2000);
    }
  }
};

window.toggleExpenseAlert = function (checked) {
  localStorage.setItem('settings_expense_alert_enabled', checked ? 'true' : 'false');
  const limitRow = document.getElementById('settings-expense-alert-limit-row');
  if (limitRow) limitRow.style.display = checked ? 'flex' : 'none';
  if (checked && typeof showSyncToast === 'function') {
    const limit = localStorage.getItem('settings_expense_alert_limit') || '500';
    showSyncToast(state.lang === 'el' ? `✓ Ειδοποίηση ορίου ενεργοποιήθηκε (${limit} €)` : `✓ High expense alert enabled (${limit} €)`, 2000);
  }
};

window.saveExpenseLimit = function (val) {
  if (val) {
    localStorage.setItem('settings_expense_alert_limit', val);
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? `✓ Όριο ορίστηκε στα ${val} €` : `✓ Expense limit set to ${val} €`, 2000);
    }
  }
};

window.toggleWeeklyDigest = function (checked) {
  localStorage.setItem('settings_weekly_digest_enabled', checked ? 'true' : 'false');
  if (checked) {
    checkWeeklyAndMonthlyDigests(true);
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? '✓ Εβδομαδιαία σύνοψη ενεργοποιήθηκε' : '✓ Weekly digest enabled', 2000);
    }
  }
};

window.toggleMonthlyDigest = function (checked) {
  localStorage.setItem('settings_monthly_digest_enabled', checked ? 'true' : 'false');
  if (checked) {
    checkWeeklyAndMonthlyDigests(true);
    if (typeof showSyncToast === 'function') {
      showSyncToast(state.lang === 'el' ? '✓ Μηνιαία ανασκόπηση ενεργοποιήθηκε' : '✓ Monthly review enabled', 2000);
    }
  }
};

window.togglePartnerAlerts = function (checked) {
  localStorage.setItem('settings_partner_alerts_enabled', checked ? 'true' : 'false');
  if (checked && typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? '✓ Ειδοποιήσεις συνεργάτη ενεργοποιήθηκαν' : '✓ Partner activity alerts enabled', 2000);
  }
};

window.renderNotificationHistory = function () {
  const container = document.getElementById('notifications-history-list');
  if (!container) return;

  if (!state.notifications || state.notifications.length === 0) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:16px 0;">${state.lang === 'el' ? 'Δεν υπάρχουν πρόσφατες ειδοποιήσεις.' : 'No recent notifications.'}</div>`;
    return;
  }

  container.innerHTML = state.notifications.map(n => {
    const rawTime = n.timestamp || n.date || n.created_at;
    const formattedDate = rawTime ? new Date(rawTime).toLocaleString(state.lang === 'el' ? 'el-GR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';
    return `
    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:12px; padding:12px; display:flex; gap:12px; align-items:flex-start;">
      <div style="width:28px; height:28px; border-radius:8px; background:rgba(239,68,68,0.15); color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:13px; margin-top:2px; flex-shrink: 0;">
        <i class="fa-solid fa-bell"></i>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:2px; min-width: 0;">
        <div style="font-size:13px; font-weight:700; color:var(--text-primary); word-break: break-word;">${escapeHtml(n.title || '')}</div>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.4; word-break: break-word;">${escapeHtml(n.body || n.message || '')}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">${formattedDate}</div>
      </div>
    </div>
  `;
  }).join('');
};

window.clearNotificationHistory = function () {
  state.notifications = [];
  localStorage.setItem('state_notifications', JSON.stringify([]));
  if (typeof window.renderNotificationHistory === 'function') {
    window.renderNotificationHistory();
  }
  if (typeof showSyncToast === 'function') {
    showSyncToast(state.lang === 'el' ? 'Το ιστορικό εκκαθαρίστηκε.' : 'Notification history cleared.', 2000);
  }
};

  // Bind all functions to windowObj for global, onclick & app.js availability
  windowObj.formatNotificationDate = formatNotificationDate;
  windowObj.renderNotificationCardHtml = renderNotificationCardHtml;
  windowObj.checkRecurringPaymentAlerts = checkRecurringPaymentAlerts;
  windowObj.checkWeeklyAndMonthlyDigests = checkWeeklyAndMonthlyDigests;
  windowObj.checkPartnerActivityAlerts = checkPartnerActivityAlerts;
  windowObj.sendTestNotification = sendTestNotification;

  // Return module exports for Node / CommonJS
  return {
    formatNotificationDate: formatNotificationDate,
    renderNotificationCardHtml: renderNotificationCardHtml,
    checkRecurringPaymentAlerts: checkRecurringPaymentAlerts,
    checkWeeklyAndMonthlyDigests: checkWeeklyAndMonthlyDigests,
    checkPartnerActivityAlerts: checkPartnerActivityAlerts,
    sendTestNotification: sendTestNotification,
    toggleDailyReminder: windowObj.toggleDailyReminder,
    saveDailyReminderTime: windowObj.saveDailyReminderTime,
    toggleRecurringAlerts: windowObj.toggleRecurringAlerts,
    toggleExpenseAlert: windowObj.toggleExpenseAlert,
    saveExpenseLimit: windowObj.saveExpenseLimit,
    toggleWeeklyDigest: windowObj.toggleWeeklyDigest,
    toggleMonthlyDigest: windowObj.toggleMonthlyDigest,
    togglePartnerAlerts: windowObj.togglePartnerAlerts,
    renderNotificationHistory: windowObj.renderNotificationHistory,
    clearNotificationHistory: windowObj.clearNotificationHistory,
    onSubscreenShow_notifications: windowObj.onSubscreenShow_notifications
  };
});
