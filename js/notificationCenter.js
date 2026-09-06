/**
 * js/notificationCenter.js
 *
 * In-App Notification Center, History Hub & Local Notifications Dispatcher.
 * Extracted from app.js (Phase 13D Architectural Extraction).
 *
 * Features:
 * - In-app notification center modal, unread badge counter, and history rendering
 * - Local notifications scheduling (daily reminders, bill alerts, note reminders)
 * - Android / iOS notification channels & action intent dispatching
 * - Partner transaction push dispatch integration
 * - UMD wrapper exposing globals to window and pure helpers to Node tests
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

// ============================================================
// NOTIFICATION CENTER & LOCAL NOTIFICATIONS
// ============================================================
function uuidToNotificationId(uuid) {
  if (!uuid) return 1;
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash & 0x7FFFFFFF);
}

function loadNotifications() {
  try {
    const stored = localStorage.getItem('state_notifications') || localStorage.getItem('money_manager_notifications');
    state.notifications = stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.warn('Failed to load notifications from localStorage', err);
    state.notifications = [];
  }
  updateNotificationBadge();
}

function saveNotifications() {
  try {
    localStorage.setItem('state_notifications', JSON.stringify(state.notifications || []));
  } catch (err) {
    console.warn('Failed to save notifications to localStorage', err);
  }
}

function updateNotificationBadge() {
  const badge = document.getElementById('header-notification-badge');
  if (badge) {
    const hasUnread = state.notifications && state.notifications.some(n => !n.read);
    badge.style.display = hasUnread ? 'block' : 'none';
  }
}

function addInAppNotification(title, body, action = null) {
  state.notifications = state.notifications || [];
  const notif = {
    id: generateUUID(),
    title: title,
    body: body,
    action: action,
    read: false,
    timestamp: new Date().toISOString()
  };
  state.notifications.unshift(notif);
  if (state.notifications.length > 250) {
    state.notifications = state.notifications.slice(0, 250);
  }
  saveNotifications();
  updateNotificationBadge();
  if (document.getElementById('notification-modal') && document.getElementById('notification-modal').classList.contains('active')) {
    renderNotificationList();
  }
}

function openNotificationCenterModal() {
  if (state.notifications) {
    state.notifications.forEach(n => n.read = true);
  }
  saveNotifications();
  updateNotificationBadge();
  renderNotificationList();
  openModal('notification-modal');
}

function renderNotificationList() {
  const listEl = document.getElementById('notification-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!state.notifications || state.notifications.length === 0) {
    listEl.innerHTML = `
      <div class="empty-notifications">
        <div style="font-size: 40px; margin-bottom: 12px; filter: grayscale(1);">🔔</div>
        <div>${state.lang === 'el' ? 'Δεν υπάρχουν ειδοποιήσεις.' : 'No notifications.'}</div>
      </div>
    `;
    return;
  }
  state.notifications.forEach(notif => {
    const card = document.createElement('div');
    card.className = `notification-card${notif.read ? ' read' : ''}`;
    if (notif.action) {
      card.classList.add('clickable');
    }
    const formattedTime = new Date(notif.timestamp).toLocaleString(state.lang === 'el' ? 'el-GR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    card.innerHTML = `
      <div class="notification-header">
        <span class="notification-title">${escapeHtml(notif.title)}</span>
        <span class="notification-time">${formattedTime}</span>
      </div>
      <div class="notification-body">${escapeHtml(notif.body)}</div>
    `;
    if (notif.action) {
      card.addEventListener('click', () => {
        handleNotificationAction(notif.action);
        closeModal('notification-modal');
      });
    }
    listEl.appendChild(card);
  });
}

function clearNotifications() {
  state.notifications = [];
  saveNotifications();
  updateNotificationBadge();
  renderNotificationList();
}

function handleNotificationAction(action) {
  if (!action) return;
  if (action.type === 'open_note' && action.noteId) {
    openNoteEditor(action.noteId);
  } else if (action.type === 'open_transactions') {
    const transTabBtn = document.querySelector('[data-tab="transactions"]');
    if (transTabBtn) transTabBtn.click();
  } else if (action.type === 'open_analytics') {
    const analyticsTabBtn = document.querySelector('[data-tab="analytics"]');
    if (analyticsTabBtn) analyticsTabBtn.click();
  }
}

function handleIncomingLocalNotification(notification) {
  if (!notification) return;
  const title = notification.title || (state.lang === 'el' ? 'Ειδοποίηση' : 'Notification');
  const body = notification.body || '';
  const extra = notification.extra || null;
  let action = null;
  if (extra) {
    if (extra.type === 'note_reminder' && extra.noteId) {
      action = { type: 'open_note', noteId: extra.noteId };
    } else if (extra.type === 'daily_reminder') {
      action = { type: 'open_transactions' };
    } else if (extra.type === 'recurring_alert') {
      action = { type: 'open_transactions' };
    } else if (extra.type === 'high_expense') {
      action = { type: 'open_transactions' };
    }
  }
  addInAppNotification(title, body, action);
}

async function scheduleDailyReminder(enabled, timeString) {
  const isNative = typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
  if (!isNative) {
    return;
  }

  // 1. Primary: Pure Native ReliableNotification Plugin (Bypasses WebView, auto-reschedules on boot/alarm)
  const ReliableNotification = window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification;
  if (ReliableNotification) {
    try {
      // Check / request POST_NOTIFICATIONS permission
      if (window.Capacitor.Plugins.LocalNotifications) {
        try {
          if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
            window.stabilizeLayoutBeforeNativePicker();
          }
          await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
        } catch (pErr) { }
      }

      if (!enabled) {
        await ReliableNotification.cancelDailyReminder();
        return;
      }

      const [hours, minutes] = (timeString || '21:00').split(':').map(Number);
      const title = state.lang === 'el' ? 'Καταγραφή Εξόδων' : 'Log Expenses';
      const body = state.lang === 'el' ? 'Έχεις καταγράψει τα σημερινά έξοδά σου;' : 'Have you logged today\'s expenses?';

      await ReliableNotification.scheduleDailyReminder({
        hour: hours,
        minute: minutes,
        title: title,
        body: body,
        enabled: true
      });
      console.log('ReliableNotification armed successfully for', hours, minutes);
      return;
    } catch (err) {
      console.warn('ReliableNotification failed, falling back to LocalNotifications:', err);
    }
  }

  // 2. Secondary Fallback: Capacitor LocalNotifications
  const LocalNotifications = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
  if (LocalNotifications) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
      if (!enabled) return;
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }

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

      const [hours, minutes] = (timeString || '21:00').split(':').map(Number);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999,
            title: state.lang === 'el' ? 'Καταγραφή Εξόδων' : 'Log Expenses',
            body: state.lang === 'el' ? 'Έχεις καταγράψει τα σημερινά έξοδά σου;' : 'Have you logged today\'s expenses?',
            channelId: 'budget_reminders',
            smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
            schedule: {
              on: {
                hour: hours,
                minute: minutes
              },
              allowWhileIdle: true
            },
            sound: null,
            attachments: null,
            actionTypeId: '',
            extra: {
              type: 'daily_reminder'
            }
          }
        ]
      });
    } catch (err) {
      console.error('Error scheduling daily reminder fallback:', err);
    }
  }
}

// Native Device Battery & Background Optimization Helper Methods
window.requestBatteryOptimizationExemption = async function () {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    try {
      await window.Capacitor.Plugins.ReliableNotification.requestIgnoreBatteryOptimizations();
      showSyncToast(state.lang === 'el' ? 'ℹ️ Επιλέξτε «Να επιτρέπεται / Χωρίς περιορισμούς»' : 'ℹ️ Select "Allow / No restrictions"', 4000);
    } catch (e) {
      console.warn('Could not request battery exemption:', e);
    }
  }
};

window.openDeviceAutostartSettings = async function () {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    try {
      const res = await window.Capacitor.Plugins.ReliableNotification.openAutostartSettings();
      showSyncToast(state.lang === 'el' ? 'ℹ️ Ενεργοποιήστε την «Αυτόματη έναρξη» για το Budget Assistant' : 'ℹ️ Enable "Autostart" for Budget Assistant', 4000);
    } catch (e) {
      console.warn('Could not open autostart settings:', e);
    }
  }
};

window.testReliableNotification = async function () {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    try {
      await window.Capacitor.Plugins.ReliableNotification.testNotification({
        title: state.lang === 'el' ? '⚡ Δοκιμή Budget Assistant' : '⚡ Budget Assistant Test',
        body: state.lang === 'el' ? 'Η ειδοποίηση παραδίδεται άψογα και στην οθόνη κλειδώματος!' : 'Notification delivered with lock-screen support!'
      });
      showSyncToast(state.lang === 'el' ? '✓ Δοκιμαστική ειδοποίηση εστάλη!' : '✓ Test notification dispatched!', 2500);
      return;
    } catch (e) {
      console.warn('ReliableNotification test error:', e);
    }
  }
  if (typeof sendTestNotification === 'function') {
    sendTestNotification();
  }
};

window.requestExactAlarmPermission = async function () {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    // ANTI-FLICKER (same handoff stabilization as the camera picker): the native
    // Settings activity opening fires visibilitychange→hidden + a visualViewport
    // resize, which re-flow the layout and produce a visible flicker right
    // before the system window appears. Suppress CSS transitions for the handoff
    // window so the native handoff is seamless.
    if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
      window.stabilizeLayoutBeforeNativePicker();
    }
    try {
      await window.Capacitor.Plugins.ReliableNotification.requestExactAlarmPermission();
      showSyncToast(state.lang === 'el' ? 'ℹ️ Επιτρέψτε τη ρύθμιση «Ακριβείς Ειδοποιήσεις / Alarms»' : 'ℹ️ Enable "Exact Alarms / Reminders"', 4000);
    } catch (e) {
      console.warn('Could not request exact alarm permission:', e);
    }
  }
};

// EXACT-ALARM STATUS: returns true when the OS allows exact alarms
// (setExactAndAllowWhileIdle), false when it will silently fall back to an
// INEXACT alarm (which Android typically delivers ~1 minute late), and null
// when not running on native with the ReliableNotification plugin.
window.getExactAlarmStatus = async function () {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    try {
      const diag = await window.Capacitor.Plugins.ReliableNotification.getDiagnostics();
      return !!(diag && diag.isExactAllowed);
    } catch (e) {
      console.warn('[ExactAlarm] Could not read exact alarm status:', e);
    }
  }
  return null;
};

// Refreshes the "⚡ Exact Notification Time" badge in the Notifications settings.
window.refreshExactAlarmBadge = async function () {
  const badge = document.getElementById('settings-exact-alarm-status');
  if (!badge) return;
  const exact = await window.getExactAlarmStatus();
  if (exact === null) return; // web / plugin missing — leave the placeholder badge
  if (exact) {
    badge.textContent = state.lang === 'el' ? '✓ Ενεργό' : '✓ Enabled';
    badge.style.color = '#10b981';
    badge.style.borderColor = 'rgba(16,185,129,0.35)';
    badge.style.background = 'rgba(16,185,129,0.12)';
  } else {
    badge.textContent = state.lang === 'el' ? '⚠️ Απαιτείται' : '⚠️ Needed';
    badge.style.color = '#f59e0b';
    badge.style.borderColor = 'rgba(245,158,11,0.35)';
    badge.style.background = 'rgba(245,158,11,0.12)';
  }
};

window.openNotificationDiagnosticsModal = async function () {
  openModal('notification-diagnostics-modal');

  const banner = document.getElementById('notif-diag-health-banner');
  const icon = document.getElementById('notif-diag-health-icon');
  const title = document.getElementById('notif-diag-health-title');
  const desc = document.getElementById('notif-diag-health-desc');
  const alarmStatus = document.getElementById('notif-diag-alarm-status');
  const workStatus = document.getElementById('notif-diag-work-status');
  const exactStatus = document.getElementById('notif-diag-exact-status');
  const batteryStatus = document.getElementById('notif-diag-battery-status');
  const nextTrigger = document.getElementById('notif-diag-next-trigger');
  const lastDispatch = document.getElementById('notif-diag-last-dispatch');
  const lastSource = document.getElementById('notif-diag-last-source');
  const totalCount = document.getElementById('notif-diag-total-count');
  const deviceInfo = document.getElementById('notif-diag-device-info');

  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ReliableNotification) {
    try {
      const diag = await window.Capacitor.Plugins.ReliableNotification.getDiagnostics();
      if (!diag) return;

      const isHealthy = diag.healthStatus === 'HEALTHY' && diag.enabled;
      if (banner) {
        banner.style.background = isHealthy ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)';
        banner.style.borderColor = isHealthy ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)';
      }
      if (icon) {
        icon.className = isHealthy ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
        icon.style.color = isHealthy ? '#10b981' : '#f59e0b';
      }
      if (title) {
        title.style.color = isHealthy ? '#10b981' : '#f59e0b';
        title.textContent = isHealthy
          ? (state.lang === 'el' ? 'Σύστημα Υγιές & Ενεργό' : 'System Healthy & Active')
          : (state.lang === 'el' ? 'Απαιτείται Βελτιστοποίηση' : 'Optimization Recommended');
      }
      if (desc) {
        if (!diag.enabled) {
          desc.textContent = state.lang === 'el' ? 'Η ημερήσια υπενθύμιση είναι απενεργοποιημένη.' : 'Daily reminder is currently turned off.';
        } else if (!diag.isBatteryIgnored) {
          desc.textContent = state.lang === 'el' ? 'Πατήστε «Χωρίς Περιορισμούς» για παράδοση με κλειστή οθόνη.' : 'Grant battery exemption for lock-screen delivery.';
        } else {
          desc.textContent = state.lang === 'el' ? 'Όλες οι εγγενείς διεργασίες παρασκηνίου λειτουργούν κανονικά.' : 'All native background services are operating normally.';
        }
      }

      if (alarmStatus) {
        const armed = diag.enabled && diag.isAlarmArmed;
        alarmStatus.style.color = armed ? '#10b981' : '#94a3b8';
        alarmStatus.innerHTML = `<i class="fa-solid fa-circle" style="font-size:8px;"></i> <span>${armed ? (state.lang === 'el' ? `Οπλισμένο (${String(diag.hour).padStart(2, '0')}:${String(diag.minute).padStart(2, '0')})` : `Armed (${String(diag.hour).padStart(2, '0')}:${String(diag.minute).padStart(2, '0')})`) : (state.lang === 'el' ? 'Ανενεργό' : 'Inactive')}</span>`;
      }

      if (workStatus) {
        const active = diag.workStatus === 'ENQUEUED' || diag.workStatus === 'RUNNING';
        workStatus.style.color = active ? '#38bdf8' : '#94a3b8';
        workStatus.innerHTML = `<i class="fa-solid fa-circle" style="font-size:8px;"></i> <span>${active ? (state.lang === 'el' ? 'Ενεργό (Watchdog)' : 'Active (Watchdog)') : (state.lang === 'el' ? 'Ανενεργό' : 'Inactive')}</span>`;
      }

      if (exactStatus) {
        exactStatus.style.color = diag.isExactAllowed ? '#10b981' : '#f59e0b';
        exactStatus.textContent = diag.isExactAllowed ? (state.lang === 'el' ? '✓ Επιτρέπεται' : '✓ Allowed') : (state.lang === 'el' ? '⚠️ Απαιτείται Άδεια' : '⚠️ Action Needed');
      }

      if (batteryStatus) {
        batteryStatus.style.color = diag.isBatteryIgnored ? '#10b981' : '#f59e0b';
        batteryStatus.textContent = diag.isBatteryIgnored ? (state.lang === 'el' ? '✓ Εξαιρείται' : '✓ Excluded') : (state.lang === 'el' ? '⚠️ Περιορίζεται' : '⚠️ Restricted');
      }

      if (nextTrigger) nextTrigger.textContent = diag.nextTriggerFormatted || '—';
      if (lastDispatch) lastDispatch.textContent = diag.lastDispatchFormatted || '—';
      if (lastSource) lastSource.textContent = diag.lastDispatchSource || '—';
      if (totalCount) totalCount.textContent = String(diag.totalDispatches || 0);
      if (deviceInfo) deviceInfo.textContent = `${diag.manufacturer || ''} ${diag.model || ''} (SDK ${diag.sdkInt || ''})`;

    } catch (err) {
      console.warn('Diagnostics error:', err);
    }
  } else {
    if (desc) desc.textContent = state.lang === 'el' ? 'Η λειτουργία εκτελείται σε Web περιβάλλον.' : 'Running in Web environment.';
    if (deviceInfo) deviceInfo.textContent = navigator.userAgent ? 'Web Browser' : '—';
  }
};

// Persist pending note reminders so they survive app restarts. The native
// LocalNotifications plugin already persists scheduled notifications, but the
// setTimeout fallback (web / non-Capacitor) is lost on reload. Storing the
// pending reminders lets us re-schedule them on startup.
function persistPendingNoteReminders() {
  try {
    const pending = (state.notes || [])
      .filter(n => n.reminder_at && new Date(n.reminder_at).getTime() > Date.now())
      .map(n => ({ id: n.id, reminder_at: n.reminder_at, title: n.title }));
    localStorage.setItem('pending_note_reminders', JSON.stringify(pending));
  } catch (e) {
    console.warn('Failed to persist pending note reminders:', e);
  }
}

// Re-schedule all pending note reminders (called on app startup so reminders
// set before a reload/restart are not lost).
async function rescheduleAllNoteReminders() {
  try {
    const pending = JSON.parse(localStorage.getItem('pending_note_reminders') || '[]');
    if (!Array.isArray(pending)) return;
    pending.forEach(p => {
      if (!p.id || !p.reminder_at) return;
      const note = state.notes.find(n => n.id === p.id);
      if (note) {
        scheduleNoteReminder(note);
      } else {
        // Note no longer exists — schedule a bare reminder from the stored data.
        scheduleNoteReminder({ id: p.id, title: p.title || '', reminder_at: p.reminder_at });
      }
    });
  } catch (e) {
    console.warn('Failed to reschedule note reminders:', e);
  }
}

async function scheduleNoteReminder(note) {
  const notificationId = uuidToNotificationId(note.id);
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.LocalNotifications) {
    cancelNoteReminder(note.id);
    if (note.reminder_at) {
      const ms = new Date(note.reminder_at).getTime() - Date.now();
      if (ms > 0) {
        window._activeNoteReminders = window._activeNoteReminders || {};
        window._activeNoteReminders[note.id] = setTimeout(() => {
          const title = state.lang === 'el' ? 'Υπενθύμιση Σημείωσης' : 'Note Reminder';
          addInAppNotification(title, note.title, { type: 'open_note', noteId: note.id });
          showToast(`${title}: ${note.title}`, 'info');
        }, ms);
      }
    }
    persistPendingNoteReminders();
    return;
  }
  const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    if (!note.reminder_at) {
      persistPendingNoteReminders();
      return;
    }
    const reminderTime = new Date(note.reminder_at);
    if (reminderTime.getTime() <= Date.now()) {
      persistPendingNoteReminders();
      return;
    }
    // ANTI-FLICKER: The Android permission dialog fires visibilitychange→hidden
    // + visualViewport resize, which re-flows the layout and causes a visible
    // flash. Stabilize the layout before the native dialog appears.
    if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
      window.stabilizeLayoutBeforeNativePicker();
    }
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      persistPendingNoteReminders();
      return;
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: state.lang === 'el' ? 'Υπενθύμιση Σημείωσης' : 'Note Reminder',
          body: note.title,
          channelId: 'budget_reminders',
          smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
          schedule: { at: reminderTime, allowWhileIdle: true },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: {
            type: 'note_reminder',
            noteId: note.id
          }
        }
      ]
    });
    persistPendingNoteReminders();
  } catch (err) {
    console.error('Error scheduling local notification:', err);
  }
}

async function cancelNoteReminder(noteId) {
  const notificationId = uuidToNotificationId(noteId);
  if (window._activeNoteReminders && window._activeNoteReminders[noteId]) {
    clearTimeout(window._activeNoteReminders[noteId]);
    delete window._activeNoteReminders[noteId];
  }
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try {
      await window.Capacitor.Plugins.LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (err) {
      console.warn('Failed to cancel local notification:', err);
    }
  }
  // Remove from the persisted pending list so it is not re-scheduled on restart.
  try {
    const pending = JSON.parse(localStorage.getItem('pending_note_reminders') || '[]');
    const filtered = (Array.isArray(pending) ? pending : []).filter(p => String(p.id) !== String(noteId));
    localStorage.setItem('pending_note_reminders', JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to clear persisted note reminder:', e);
  }
}

async function initLocalNotifications() {
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.LocalNotifications) {
    // Non-Capacitor (web) environment: still re-schedule the setTimeout-based
    // fallback reminders so they survive a page reload.
    rescheduleAllNoteReminders();
    return;
  }
  const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
  try {
    // Ensure High-Priority Notification Channel exists for Android 8.0+ (required for heads-up alerts & sound)
    try {
      if (typeof LocalNotifications.createChannel === 'function') {
        await LocalNotifications.createChannel({
          id: 'budget_reminders',
          name: 'Budget Assistant Reminders',
          description: 'Daily expense reminders, payment alerts and updates',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: '#7c6af7'
        });
      }
    } catch (chanErr) {
      console.warn('Channel creation warning:', chanErr);
    }

    const enabled = localStorage.getItem('settings_daily_reminder_enabled') === 'true';
    if (enabled) {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        const timeVal = localStorage.getItem('settings_daily_reminder_time') || '21:00';
        scheduleDailyReminder(true, timeVal);
      }
    }
    // Re-schedule any pending note reminders that were set before a restart.
    rescheduleAllNoteReminders();
    await LocalNotifications.addListener('localNotificationReceived', (notification) => {
      handleIncomingLocalNotification(notification);
    });
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      if (action.notification) {
        handleIncomingLocalNotification(action.notification);
        if (action.notification.extra && action.notification.extra.type === 'note_reminder') {
          const noteId = action.notification.extra.noteId;
          if (noteId) {
            setTimeout(() => {
              openNoteEditor(noteId);
            }, 500);
          }
        }
      }
    });

    // Push Notifications (FCM) are guarded safely
    try {
      await initPushNotifications();
    } catch (pushErr) {
      console.warn('initPushNotifications skipped or failed safely:', pushErr);
    }

  } catch (err) {
    console.error('Failed to initialize Capacitor Local Notifications:', err);
  }
}

async function initPushNotifications() {
  const isNative = typeof window.Capacitor !== 'undefined' && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
  if (!isNative) return;

  const PushNotifications = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
  if (!PushNotifications) return;

  try {
    // Note: PushNotifications.register() requires Firebase google-services.json which is not configured.
    // Local notifications and exact alarms are handled reliably via ReliableNotificationPlugin.
    const perm = await PushNotifications.checkPermissions();
    if (perm && perm.receive === 'granted') {
      // Intentionally do not call PushNotifications.register() to avoid FirebaseApp initialization crashes.
    }

    // Listen for FCM Device Token registration
    if (typeof PushNotifications.addListener === 'function') {
      PushNotifications.addListener('registration', async (token) => {
        if (token && token.value) {
          localStorage.setItem('fcm_token', token.value);
          if (typeof syncFcmTokenToProfile === 'function') {
            syncFcmTokenToProfile(token.value);
          }
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.warn('FCM Registration Error:', err);
      });

      // Handle Push Notifications delivered while app is in foreground
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = notification.title || (state.lang === 'el' ? 'Νέα Ειδοποίηση' : 'New Notification');
        const body = notification.body || '';
        const data = notification.data || {};

        if (data.type === 'partner_transaction' && typeof syncCloudTransactions === 'function') {
          syncCloudTransactions(true);
        }

        if (typeof addInAppNotification === 'function') {
          addInAppNotification(title, body, { type: data.type || 'general' });
        }
      });

      // Handle user tapping on a Push Notification
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = (action.notification && action.notification.data) || {};
        if (data.type === 'partner_transaction' && typeof openScreen === 'function') {
          openScreen('transactions');
        }
      });
    }

  } catch (err) {
    console.warn('PushNotifications initialization failed safely:', err);
  }
}

async function syncFcmTokenToProfile(token) {
  if (!token) token = localStorage.getItem('fcm_token');
  if (!token || !window.supabase || !state.user || !state.user.id) return;
  try {
    const { error } = await window.supabase
      .from('user_profiles')
      .update({ fcm_token: token, updated_at: new Date().toISOString() })
      .eq('user_id', state.user.id);
    if (!error) {
      console.log('FCM token synced with user profile');
    }
  } catch (e) {
    console.warn('Error syncing FCM token:', e);
  }
}

async function sendPartnerPushNotification(transaction, partnerUserId) {
  if (!partnerUserId || !state.supabaseClient || !transaction) return;
  try {
    const sessionRes = state.supabaseClient.auth.session ? { data: { session: state.supabaseClient.auth.session() } } : await state.supabaseClient.auth.getSession();
    const token = sessionRes && sessionRes.data && sessionRes.data.session ? sessionRes.data.session.access_token : null;
    if (!token) return;

    const senderName = (state.userProfile && state.userProfile.full_name) || (state.currentUser && state.currentUser.email) || (state.lang === 'el' ? 'Ο συνεργάτης σου' : 'Your partner');
    const typeLabel = transaction.type === 'income' ? (state.lang === 'el' ? 'έσοδο' : 'income') : (state.lang === 'el' ? 'έξοδο' : 'expense');
    const currency = (typeof getCurrencySymbol === 'function' ? getCurrencySymbol(transaction.currency || state.mainCurrency || 'EUR') : '€');
    const amountStr = `${Number(transaction.amount || 0).toFixed(2)} ${currency}`;
    const category = transaction.category || '';

    const title = state.lang === 'el' ? `👥 Νέο ${typeLabel} από ${senderName}` : `👥 New ${typeLabel} from ${senderName}`;
    const body = `${category ? category + ' — ' : ''}${amountStr}${transaction.notes ? ' (' + transaction.notes + ')' : ''}`;

    await fetch('/api/push-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipient_user_id: partnerUserId,
        title: title,
        body: body,
        data: {
          type: 'partner_transaction',
          transaction_id: transaction.id,
          amount: String(transaction.amount)
        }
      })
    });
  } catch (err) {
    console.warn('Partner push dispatch error (silent):', err);
  }
}

// Bind to window for HTML accessibility
window.openNotificationCenterModal = openNotificationCenterModal;
window.clearNotifications = clearNotifications;

  // UMD Exports & Window Bindings
  if (typeof window !== 'undefined') {
    window.uuidToNotificationId = uuidToNotificationId;
    window.loadNotifications = loadNotifications;
    window.saveNotifications = saveNotifications;
    window.updateNotificationBadge = updateNotificationBadge;
    window.addInAppNotification = addInAppNotification;
    window.openNotificationCenterModal = openNotificationCenterModal;
    window.renderNotificationList = renderNotificationList;
    window.clearNotifications = clearNotifications;
    window.handleNotificationAction = handleNotificationAction;
    window.handleIncomingLocalNotification = handleIncomingLocalNotification;
    if (typeof scheduleDailyReminder === 'function') {
      window.scheduleDailyReminder = scheduleDailyReminder;
    }
    if (typeof dispatchPartnerTransactionPush === 'function') {
      window.dispatchPartnerTransactionPush = dispatchPartnerTransactionPush;
    }
  }

  return {
    uuidToNotificationId: uuidToNotificationId,
    loadNotifications: loadNotifications,
    saveNotifications: saveNotifications,
    updateNotificationBadge: updateNotificationBadge,
    addInAppNotification: addInAppNotification,
    openNotificationCenterModal: openNotificationCenterModal,
    renderNotificationList: renderNotificationList,
    clearNotifications: clearNotifications,
    handleNotificationAction: handleNotificationAction,
    handleIncomingLocalNotification: handleIncomingLocalNotification,
    scheduleDailyReminder: typeof scheduleDailyReminder === 'function' ? scheduleDailyReminder : undefined,
    dispatchPartnerTransactionPush: typeof dispatchPartnerTransactionPush === 'function' ? dispatchPartnerTransactionPush : undefined
  };
}));
