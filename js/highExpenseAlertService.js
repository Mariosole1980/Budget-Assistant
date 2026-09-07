// ============================================================
// HIGH-EXPENSE ALERT & MULTI-CURRENCY COMPUTATION ENGINE
// Autonomous UMD Module (Phase 18D Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
    var exports = factory();
    Object.assign(rootObj, exports);
    rootObj.HighExpenseAlertService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// HIGH-EXPENSE ALERT (Υψηλή Δαπάνη)
// The "Single Expense Alert" setting was previously a UI-only stub:
// the settings (settings_expense_alert_enabled / _limit) were saved to
// localStorage but NO code ever checked them or fired a notification.
// This helper wires the setting to the actual alert. It is called from
// saveTransaction() so it fires for ANY expense added (form, coach, demo).
// ============================================================
function checkHighExpenseAlert(transaction) {
  try {
    // Only expenses (not income/transfers) can trigger the high-expense alert.
    if (!transaction || transaction.type !== 'expense') return;

    const enabled = localStorage.getItem('settings_expense_alert_enabled') === 'true';
    if (!enabled) return;

    const limit = parseFloat(localStorage.getItem('settings_expense_alert_limit')) || 500;
    const amount = parseFloat(transaction.amount) || 0;
    if (amount < limit) return;

    const isPartner = state.currentUser && transaction.user_id && transaction.user_id !== state.currentUser.id;
    let partnerName = '';
    if (isPartner && state.familyProfiles) {
      const p = state.familyProfiles.find(fp => fp.id === transaction.user_id);
      if (p) partnerName = p.display_name || p.email || '';
    }

    const catName = getCategoryDisplayName ? getCategoryDisplayName(transaction.category) : (transaction.category || '');
    const title = state.lang === 'el' ? '⚠️ Υψηλή Δαπάνη' : '⚠️ High Expense Alert';

    let body = '';
    if (isPartner) {
      const who = partnerName ? `Ο/Η ${partnerName}` : (state.lang === 'el' ? 'Μέλος της οικογένειας' : 'A family member');
      body = state.lang === 'el'
        ? `${who} καταχώρησε δαπάνη ${formatCurrency(amount)} (${catName}) που υπερβαίνει το όριο των ${formatCurrency(limit)}.`
        : `${who} logged an expense of ${formatCurrency(amount)} (${catName}), exceeding the limit of ${formatCurrency(limit)}.`;
    } else {
      body = state.lang === 'el'
        ? `Καταχωρήθηκε δαπάνη ${formatCurrency(amount)} (${catName}) που υπερβαίνει το όριο των ${formatCurrency(limit)}.`
        : `An expense of ${formatCurrency(amount)} (${catName}) was recorded, exceeding your limit of ${formatCurrency(limit)}.`;
    }

    // 1. In-app notification (notification center / badge)
    addInAppNotification(title, body, { type: 'open_transactions' });

    // 2. Toast so the user sees it immediately. NOTE: `showToast` is not defined
    // anywhere in the codebase, so the previous guard always failed and the user
    // never saw any immediate feedback. Use the working `showSyncToast` instead.
    if (typeof showSyncToast === 'function') {
      showSyncToast(title + ' — ' + body, 6000);
    }

    // 3. Native push-style notification (works when app is in background)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      const notifId = Math.floor(Math.random() * 899999) + 100000;
      window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: title,
          body: body,
          smallIcon: 'ic_launcher_round',
            iconColor: '#0F1219',
          schedule: { at: new Date(Date.now() + 50) },
          sound: null,
          attachments: null,
          actionTypeId: '',
          extra: { type: 'high_expense' }
        }]
      }).catch(err => console.warn('Failed to schedule high-expense native notification:', err));
    }

  } catch (err) {
    // Never let a notification failure break the transaction save.
    console.warn('checkHighExpenseAlert error:', err);
  }
}

// Multi-currency: compute base-currency fields (amount_base, rate_to_base, base_currency).
// Always computed so new transactions are consistent with the schema, even when the
// feature flag is off (EUR → 1:1).
// This is the single canonical implementation reused by normal, recurring, and
// imported transactions so they all behave identically.
function computeCurrencyFields(t) {
  const userPreferredCurrency = state.userProfile?.base_currency || state.userProfile?.display_currency || getDisplayCurrency();
  const baseCurrency = userPreferredCurrency;
  const txCurrency = t.currency || 'EUR';
  t.base_currency = baseCurrency;

  let rate = 1;
  if (txCurrency === baseCurrency) {
    t.rate_to_base = 1;
    t.amount_base = CurrencyService.round(Number(t.amount), 4);
    t.rate_source = 'api';
  } else {
    const foundRate = CurrencyService.getRate(txCurrency, baseCurrency, t.date);
    if (foundRate != null && foundRate > 0) {
      rate = foundRate;
      t.rate_to_base = rate;
      t.amount_base = CurrencyService.round(Number(t.amount) / rate, 4);
      t.rate_source = 'api';
    } else {
      t.rate_to_base = null;
      t.amount_base = null;
      t.rate_source = 'cached';
    }
  }

  // Store immutable fx_snapshot on transaction for audit-reproducible historical rendering
  t.fx_snapshot = {
    base: txCurrency,
    quote: baseCurrency,
    rate: t.rate_to_base_actual || t.rate_to_base || rate || 1,
    date: t.date ? String(t.date).split('T')[0] : new Date().toISOString().slice(0, 10),
    source: t.rate_source || 'api'
  };
  return t;
}

  // Window Bindings
  window.checkHighExpenseAlert = checkHighExpenseAlert;
  window.computeCurrencyFields = computeCurrencyFields;

  return {
    checkHighExpenseAlert: checkHighExpenseAlert,
    computeCurrencyFields: computeCurrencyFields
  };
}));
