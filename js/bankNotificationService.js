/**
 * BankNotificationService - Front-End Coordinator for Bank Push Notifications
 *
 * Coordinates:
 * - Native listener bridge with BankNotification Capacitor plugin
 * - Notification processing via BankNotificationParser
 * - Review modal presentation (#bank-tx-review-modal)
 * - Settings toggle integration with Android permission helper
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    Object.assign(root, exports);
    root.BankNotificationService = exports;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _pendingBankQueue = [];
  var _currentReviewItem = null;
  var _isInitialized = false;
  var _nativeListenersAttached = false;
  var _visibilityBound = false;

  function isNativeAndroid() {
    return typeof window !== 'undefined' &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.getPlatform() === 'android';
  }

  function getPlugin() {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) {
      var plugin = window.Capacitor.Plugins.BankNotification;
      // A proxy is also created for unknown plugin names in some Capacitor
      // versions, so validate that the native methods really exist.
      if (plugin && typeof plugin.isNotificationAccessGranted === 'function' &&
          typeof plugin.getPendingBankNotifications === 'function') {
        return plugin;
      }
      return null;
    }
    return null;
  }

  function isGreekUi() {
    try {
      if (typeof state === 'undefined' || !state) return true;
      return state.lang !== 'en';
    } catch (e) {
      return true;
    }
  }

  /**
   * Registers the live 'bankNotificationReceived' listener on the native plugin.
   * Idempotent: safe to call on startup and again when the user enables the switch.
   */
  function attachNativeListeners() {
    if (_nativeListenersAttached || !isNativeAndroid()) return;
    var plugin = getPlugin();
    if (!plugin || typeof plugin.addListener !== 'function') return;

    try {
      plugin.addListener('bankNotificationReceived', function (notif) {
        handleRawBankNotification(notif);
      });
      _nativeListenersAttached = true;
    } catch (e) {
      console.warn('[BankNotificationService] Failed to add listener:', e);
    }
  }

  /**
   * Mirrors the JS preference into the native SharedPreferences flag read by
   * BankNotificationListenerService. Fire-and-forget, never throws.
   */
  function syncNativeEnabledState(enabled) {
    if (!isNativeAndroid()) return;
    var plugin = getPlugin();
    if (!plugin || typeof plugin.setBankNotificationEnabled !== 'function') return;

    try {
      var result = plugin.setBankNotificationEnabled({ enabled: !!enabled });
      if (result && typeof result.catch === 'function') {
        result.catch(function (err) {
          console.warn('[BankNotificationService] setBankNotificationEnabled failed:', err);
        });
      }
    } catch (e) {
      console.warn('[BankNotificationService] setBankNotificationEnabled threw:', e);
    }
  }

  /**
   * Initializes bank notification listeners and checks pending queue on app startup.
   */
  function initBankNotificationService() {
    if (_isInitialized) return;
    _isInitialized = true;

    var enabled = isBankNotificationEnabled();

    if (isNativeAndroid()) {
      if (!getPlugin()) {
        console.error('[BankNotificationService] Native plugin "BankNotification" is not available in this build. ' +
          'Auto-capture cannot work — a rebuild/reinstall of the app is required.');
      }
      // Keep the native flag in sync with the stored preference on every launch.
      syncNativeEnabledState(enabled);
    }

    if (enabled) {
      attachNativeListeners();
      checkPendingBankNotifications();
    }

    // Re-check whenever the app comes back to the foreground (e.g. the user just
    // granted Notification Access in Android Settings).
    if (typeof document !== 'undefined' && !_visibilityBound) {
      _visibilityBound = true;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden || !isBankNotificationEnabled()) return;
        syncNativeEnabledState(true);
        attachNativeListeners();
        checkPendingBankNotifications();
      });
    }
  }

  function isBankNotificationEnabled() {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('bank_notifications_reader_enabled') === 'true';
  }

  /**
   * Polls native plugin for pending bank notifications captured in the background.
   */
  function checkPendingBankNotifications() {
    if (!isNativeAndroid()) return;
    var plugin = getPlugin();
    if (!plugin || typeof plugin.getPendingBankNotifications !== 'function') return;

    plugin.getPendingBankNotifications().then(function (res) {
      if (res && Array.isArray(res.notifications) && res.notifications.length > 0) {
        res.notifications.forEach(function (notif) {
          handleRawBankNotification(notif);
        });
      }
    }).catch(function (err) {
      console.warn('[BankNotificationService] getPendingBankNotifications error:', err);
    });
  }

  var HANDLED_STORAGE_KEY = 'bank_notifications_handled_fingerprints';
  var MAX_HANDLED_FINGERPRINTS = 100;
  var _handledFingerprints = null;

  function getHandledFingerprints() {
    if (_handledFingerprints) return _handledFingerprints;
    _handledFingerprints = [];
    if (typeof localStorage === 'undefined') return _handledFingerprints;

    try {
      var raw = localStorage.getItem(HANDLED_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) {
        _handledFingerprints = arr.filter(function (item) {
          return typeof item === 'string' && item.length > 0;
        });
      }
    } catch (e) {
      _handledFingerprints = [];
    }
    return _handledFingerprints;
  }

  /**
   * Stable identity for a captured notification. The live broadcast and the
   * persistent queue deliver the same capture with the same timestamp, so this
   * fingerprint is used to drop the duplicate.
   */
  function fingerprintNotification(rawNotif) {
    if (!rawNotif) return '';
    return [
      rawNotif.packageName || '',
      rawNotif.title || '',
      rawNotif.text || '',
      rawNotif.bigText || '',
      String(rawNotif.timestamp || rawNotif.postTime || '')
    ].join('|');
  }

  function isNotificationHandled(fingerprint) {
    if (!fingerprint) return false;
    return getHandledFingerprints().indexOf(fingerprint) !== -1;
  }

  function isFingerprintQueued(fingerprint) {
    if (!fingerprint) return false;
    if (_currentReviewItem && _currentReviewItem.fingerprint === fingerprint) return true;
    for (var i = 0; i < _pendingBankQueue.length; i++) {
      if (_pendingBankQueue[i] && _pendingBankQueue[i].fingerprint === fingerprint) return true;
    }
    return false;
  }

  /**
   * Remembers the transaction the user already accepted/dismissed, so a queued
   * copy of the same capture cannot prompt again (even after an app restart).
   */
  function markTransactionHandled(item) {
    if (!item || !item.fingerprint) return;
    var handled = getHandledFingerprints();
    if (handled.indexOf(item.fingerprint) !== -1) return;

    handled.push(item.fingerprint);
    while (handled.length > MAX_HANDLED_FINGERPRINTS) {
      handled.shift();
    }

    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(HANDLED_STORAGE_KEY, JSON.stringify(handled));
    } catch (e) {
      // Storage unavailable/full — the in-memory list still prevents duplicates
      // for the current session.
    }
  }

  /**
   * Processes a raw notification object, parses it, and queues for user review.
   */
  function handleRawBankNotification(rawNotif) {
    if (!rawNotif) return;
    var parser = (typeof BankNotificationParser !== 'undefined')
      ? BankNotificationParser
      : (typeof window !== 'undefined' ? window.BankNotificationParser : null);

    if (!parser || typeof parser.parse !== 'function') {
      console.warn('[BankNotificationService] BankNotificationParser not available');
      return;
    }

    // The native side delivers each capture twice: once through the live
    // broadcast and once through the persistent queue (drained on resume).
    // Drop the duplicate instead of prompting the user twice.
    var fingerprint = fingerprintNotification(rawNotif);
    if (fingerprint && (isNotificationHandled(fingerprint) || isFingerprintQueued(fingerprint))) {
      return;
    }

    var parsed = parser.parse(rawNotif);
    if (!parsed || !parsed.isValid || !parsed.amount) {
      return;
    }

    parsed.fingerprint = fingerprint;
    _pendingBankQueue.push(parsed);

    // If no modal currently open, prompt the next transaction
    if (!_currentReviewItem) {
      showNextPendingBankNotification();
    }
  }

  /**
   * Pops the next transaction from queue and displays the review sheet.
   */
  function showNextPendingBankNotification() {
    if (_pendingBankQueue.length === 0) {
      _currentReviewItem = null;
      return;
    }

    _currentReviewItem = _pendingBankQueue.shift();
    renderBankTransactionReview(_currentReviewItem);
  }

  /**
   * Renders and opens the review modal for the detected bank transaction.
   */
  function renderBankTransactionReview(item) {
    if (!item) return;

    var modal = document.getElementById('bank-tx-review-modal');
    if (!modal) {
      // Safety net: never leave _currentReviewItem set, otherwise every later
      // notification would be swallowed because a review is "already open".
      console.warn('[BankNotificationService] Review modal #bank-tx-review-modal not found — skipping review sheet');
      _currentReviewItem = null;
      if (_pendingBankQueue.length > 0) {
        setTimeout(showNextPendingBankNotification, 300);
      }
      return;
    }

    var bankEl = document.getElementById('bank-tx-review-bank');
    var amountEl = document.getElementById('bank-tx-review-amount');
    var merchantEl = document.getElementById('bank-tx-review-merchant');
    var catEl = document.getElementById('bank-tx-review-category');
    var cardEl = document.getElementById('bank-tx-review-card');

    var currSym = (typeof getCurrencySymbol === 'function') ? getCurrencySymbol() : '€';
    var formattedAmt = (typeof formatDisplayAmount === 'function') ? formatDisplayAmount(item.amount) : item.amount.toFixed(2);

    if (bankEl) bankEl.textContent = item.bank || 'Τράπεζα';
    if (amountEl) {
      amountEl.textContent = (item.type === 'income' ? '+ ' : '- ') + currSym + ' ' + formattedAmt;
      amountEl.style.color = item.type === 'income' ? '#10b981' : '#f87171';
    }
    if (merchantEl) merchantEl.textContent = item.merchant || 'Συναλλαγή';
    if (catEl) catEl.textContent = item.suggestedCategory || '📦 Διάφορα';
    if (cardEl) {
      if (item.cardSuffix) {
        cardEl.textContent = 'Κάρτα: ' + item.cardSuffix;
        cardEl.style.display = 'inline-block';
      } else {
        cardEl.style.display = 'none';
      }
    }

    if (typeof openModal === 'function') {
      openModal('bank-tx-review-modal');
    }
  }

  /**
   * Normalizes a category name for fuzzy matching (strips emoji, accents, case).
   */
  function normalizeCategoryKey(value) {
    if (!value) return '';
    var str = String(value);
    try {
      str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      // String.normalize unavailable — fall back to plain lowercase comparison
    }
    return str
      .toLowerCase()
      .replace(/[^0-9a-z\u0370-\u03ff\u1f00-\u1fff]+/g, ' ')
      .trim();
  }

  /**
   * Resolves a detected category against the user's real category list so it can
   * be auto-selected in the Add Transaction modal.
   */
  function findMatchingCategory(suggested, transType) {
    var normalizedTarget = normalizeCategoryKey(suggested);
    if (!normalizedTarget) return null;

    var categories = [];
    try {
      if (typeof state !== 'undefined' && state && Array.isArray(state.categories)) {
        categories = state.categories;
      }
    } catch (e) {
      categories = [];
    }
    if (!categories.length) return null;

    var sameType = categories.filter(function (c) {
      return c && c.name && (!transType || !c.type || c.type === transType);
    });
    var pool = sameType.length ? sameType : categories;

    // Exact (normalized) match first, then partial match
    var i;
    for (i = 0; i < pool.length; i++) {
      if (pool[i] && pool[i].name && normalizeCategoryKey(pool[i].name) === normalizedTarget) {
        return pool[i].name;
      }
    }
    for (i = 0; i < pool.length; i++) {
      var key = pool[i] && pool[i].name ? normalizeCategoryKey(pool[i].name) : '';
      if (key && (key.indexOf(normalizedTarget) !== -1 || normalizedTarget.indexOf(key) !== -1)) {
        return pool[i].name;
      }
    }
    return null;
  }

  /**
   * Action: User accepts detected bank transaction.
   * Pre-fills the standard transaction modal with detected details.
   */
  function acceptBankTransaction() {
    if (!_currentReviewItem) return;
    var tx = _currentReviewItem;
    markTransactionHandled(tx);
    _currentReviewItem = null;

    if (typeof closeModal === 'function') {
      closeModal('bank-tx-review-modal');
    }

    var txType = tx.type === 'income' ? 'income' : 'expense';

    // Open standard Add Transaction modal (it always resets to "expense", so the
    // type has to be applied afterwards).
    if (typeof openAddTransactionModal === 'function') {
      openAddTransactionModal(txType);
    }
    if (typeof setTransactionFormType === 'function') {
      setTransactionFormType(txType);
    }

    // Populate pre-filled values into the transaction form. The ids below belong
    // to the real Add Transaction modal (#trans-*), and legacy (#modal-trans-*).
    setTimeout(function () {
      try {
        var val = (typeof formatCalcDisplay === 'function')
          ? formatCalcDisplay(String(tx.amount))
          : tx.amount;
        var amtInput = document.getElementById('trans-amount');
        var amtModalInput = document.getElementById('modal-trans-amount');
        if (amtInput) amtInput.value = val;
        if (amtModalInput) amtModalInput.value = val;

        var noteInput = document.getElementById('trans-note');
        var noteModalInput = document.getElementById('modal-trans-note');
        if (noteInput) noteInput.value = tx.merchant || '';
        if (noteModalInput) noteModalInput.value = tx.merchant || '';

        // Auto-select the suggested category when it exists in the user's list
        var matchedCategory = findMatchingCategory(tx.suggestedCategory, txType);
        if (matchedCategory && typeof selectCategory === 'function') {
          selectCategory(matchedCategory);
        }

        // Haptic feedback
        if (typeof triggerHaptic === 'function') {
          triggerHaptic('success');
        }

        if (typeof showToast === 'function') {
          showToast('✓ Προσυμπληρώθηκαν στοιχεία από ' + (tx.bank || 'την τράπεζα'));
        }
      } catch (e) {
        console.warn('[BankNotificationService] Failed to populate transaction modal:', e);
      }

      // Check if there are more pending notifications in queue
      if (_pendingBankQueue.length > 0) {
        setTimeout(showNextPendingBankNotification, 600);
      }
    }, 150);
  }

  /**
   * Action: User dismisses detected bank transaction.
   */
  function dismissBankTransaction() {
    markTransactionHandled(_currentReviewItem);
    _currentReviewItem = null;
    if (typeof closeModal === 'function') {
      closeModal('bank-tx-review-modal');
    }

    // Process next item in queue if available
    if (_pendingBankQueue.length > 0) {
      setTimeout(showNextPendingBankNotification, 300);
    }
  }

  /**
   * Settings toggle handler with Android Notification Access permission check.
   */
  function handleToggleBankNotifications(checked) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bank_notifications_reader_enabled', checked ? 'true' : 'false');
    }

    var isEl = isGreekUi();

    if (!checked) {
      syncNativeEnabledState(false);
      if (typeof showSyncToast === 'function') {
        showSyncToast(isEl ? '✕ Αυτόματη καταγραφή απενεργοποιήθηκε' : '✕ Bank notifications auto-capture disabled', 2000);
      }
      return;
    }

    if (!isNativeAndroid()) {
      // Web preview: nothing can be captured, but keep the preference.
      if (typeof showSyncToast === 'function') {
        showSyncToast(isEl ? '✓ Αυτόματη καταγραφή ενεργοποιήθηκε' : '✓ Bank notifications auto-capture enabled', 2000);
      }
      return;
    }

    var plugin = getPlugin();
    if (!plugin) {
      // Never report success here: without the registered native plugin there is
      // no Notification Access prompt and no notification can ever be captured.
      console.error('[BankNotificationService] Cannot enable auto-capture: native plugin "BankNotification" is not registered in the running build. Rebuild/reinstall the app.');
      if (typeof showSyncToast === 'function') {
        showSyncToast(isEl
          ? '✕ Απαιτείται ενημέρωση της εφαρμογής (νέα έκδοση) για την αυτόματη καταγραφή'
          : '✕ An app update (new build) is required for auto-capture', 4500);
      }
      return;
    }

    plugin.isNotificationAccessGranted().then(function (res) {
      // Keep the native flag on regardless, so notifications captured from now on
      // are queued; the JS side will drain the queue once access is granted.
      syncNativeEnabledState(true);
      attachNativeListeners();

      if (res && res.granted) {
        checkPendingBankNotifications();
        if (typeof showSyncToast === 'function') {
          showSyncToast(isEl ? '✓ Αυτόματη καταγραφή τραπεζών ενεργή' : '✓ Bank notification auto-capture active', 2000);
        }
      } else {
        // Permission not yet granted in Android Settings
        promptNotificationAccessPermission();
      }
    }).catch(function (err) {
      console.warn('[BankNotificationService] isNotificationAccessGranted failed:', err);
      promptNotificationAccessPermission();
    });
  }

  /**
   * Guides user to Android Notification Access settings.
   */
  function promptNotificationAccessPermission() {
    var isEl = isGreekUi();
    if (typeof showCustomDialog === 'function') {
      showCustomDialog({
        title: isEl ? '🔒 Απαιτείται Άδεια Ειδοποιήσεων' : '🔒 Notification Access Required',
        icon: '🏦',
        body: isEl
          ? '<div style="text-align:left; font-size:13px; line-height:1.5; color:var(--text-secondary);">' +
            '<p style="margin-bottom:8px;">Για να αναγνωρίζει αυτόματα τις πληρωμές από <b>Eurobank, Πειραιώς, Alpha, Εθνική και Revolut</b>, το Android απαιτεί ενεργοποίηση της επιλογής <b>«Πρόσβαση σε ειδοποιήσεις»</b>.</p>' +
            '<p style="margin:0; font-size:12px; color:var(--text-muted);">Πατήστε παρακάτω για να μεταβείτε απευθείας στη σχετική ρύθμιση του κινητού σας.</p>' +
            '</div>'
          : '<div style="text-align:left; font-size:13px; line-height:1.5; color:var(--text-secondary);">' +
            '<p style="margin-bottom:8px;">To automatically capture transactions from your bank notifications, Android requires <b>Notification Access</b> permission.</p>' +
            '<p style="margin:0; font-size:12px; color:var(--text-muted);">Tap below to open Android Settings and enable Budget Assistant.</p>' +
            '</div>',
        primaryBtn: isEl ? '⚙️ Άνοιγμα Ρυθμίσεων' : '⚙️ Open Settings',
        secondaryBtn: isEl ? 'Αργότερα' : 'Later',
        onPrimary: function () {
          var plugin = getPlugin();
          if (plugin && typeof plugin.requestNotificationAccess === 'function') {
            plugin.requestNotificationAccess();
          }
        }
      });
    }
  }

  // Auto-init on script load if window is defined
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBankNotificationService);
    } else {
      setTimeout(initBankNotificationService, 200);
    }
  }

  return {
    init: initBankNotificationService,
    checkPending: checkPendingBankNotifications,
    handleRawNotification: handleRawBankNotification,
    acceptTransaction: acceptBankTransaction,
    dismissTransaction: dismissBankTransaction,
    handleToggle: handleToggleBankNotifications
  };
}));
