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

  function isNativeAndroid() {
    return typeof window !== 'undefined' &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform() &&
      window.Capacitor.getPlatform() === 'android';
  }

  function getPlugin() {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) {
      return window.Capacitor.Plugins.BankNotification || null;
    }
    return null;
  }

  /**
   * Initializes bank notification listeners and checks pending queue on app startup.
   */
  function initBankNotificationService() {
    if (_isInitialized) return;
    _isInitialized = true;

    var enabled = isBankNotificationEnabled();
    if (!enabled) return;

    if (isNativeAndroid()) {
      var plugin = getPlugin();
      if (plugin) {
        // Sync enabled state to native SharedPreferences
        if (typeof plugin.setBankNotificationEnabled === 'function') {
          plugin.setBankNotificationEnabled({ enabled: true });
        }

        // Listen for live broadcast notifications while app is running
        try {
          plugin.addListener('bankNotificationReceived', function (notif) {
            handleRawBankNotification(notif);
          });
        } catch (e) {
          console.warn('[BankNotificationService] Failed to add listener:', e);
        }

        // Fetch queued notifications captured while app was in background
        checkPendingBankNotifications();
      }
    }

    // Also check on visibilitychange (app resume)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && isBankNotificationEnabled()) {
          checkPendingBankNotifications();
        }
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

    var parsed = parser.parse(rawNotif);
    if (!parsed || !parsed.isValid || !parsed.amount) {
      return;
    }

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
    if (!modal) return;

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
    if (catEl) catEl.textContent = item.suggestedCategory || 'Άλλα';
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
   * Action: User accepts detected bank transaction.
   * Pre-fills the standard transaction modal with detected details.
   */
  function acceptBankTransaction() {
    if (!_currentReviewItem) return;
    var tx = _currentReviewItem;
    _currentReviewItem = null;

    if (typeof closeModal === 'function') {
      closeModal('bank-tx-review-modal');
    }

    // Open standard Add Transaction modal pre-filled
    if (typeof openAddTransactionModal === 'function') {
      openAddTransactionModal(tx.type || 'expense');
    }

    // Populate pre-filled values into transaction form
    setTimeout(function () {
      try {
        var amtInput = document.getElementById('modal-trans-amount');
        if (amtInput) {
          amtInput.value = tx.amount;
        }

        var noteInput = document.getElementById('modal-trans-note');
        if (noteInput) {
          noteInput.value = tx.merchant || '';
        }

        // Auto-select suggested category if available
        if (tx.suggestedCategory) {
          var catSelect = document.getElementById('modal-trans-category');
          if (catSelect && catSelect.options) {
            for (var i = 0; i < catSelect.options.length; i++) {
              if (catSelect.options[i].text.toLowerCase().indexOf(tx.suggestedCategory.toLowerCase()) !== -1) {
                catSelect.selectedIndex = i;
                break;
              }
            }
          }
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

    var isEl = (!state || state.lang === 'el');

    if (checked) {
      if (isNativeAndroid()) {
        var plugin = getPlugin();
        if (plugin && typeof plugin.isNotificationAccessGranted === 'function') {
          plugin.isNotificationAccessGranted().then(function (res) {
            if (res && res.granted) {
              plugin.setBankNotificationEnabled({ enabled: true });
              if (typeof showSyncToast === 'function') {
                showSyncToast(isEl ? '✓ Αυτόματη καταγραφή τραπεζών ενεργή' : '✓ Bank notification auto-capture active', 2000);
              }
            } else {
              // Permission not yet granted in Android Settings
              promptNotificationAccessPermission();
            }
          }).catch(function () {
            promptNotificationAccessPermission();
          });
          return;
        }
      }

      // Web/fallback
      if (typeof showSyncToast === 'function') {
        showSyncToast(isEl ? '✓ Αυτόματη καταγραφή ενεργοποιήθηκε' : '✓ Bank notifications auto-capture enabled', 2000);
      }
    } else {
      if (isNativeAndroid()) {
        var p = getPlugin();
        if (p && typeof p.setBankNotificationEnabled === 'function') {
          p.setBankNotificationEnabled({ enabled: false });
        }
      }
      if (typeof showSyncToast === 'function') {
        showSyncToast(isEl ? '✕ Αυτόματη καταγραφή απενεργοποιήθηκε' : '✕ Bank notifications auto-capture disabled', 2000);
      }
    }
  }

  /**
   * Guides user to Android Notification Access settings.
   */
  function promptNotificationAccessPermission() {
    var isEl = (!state || state.lang === 'el');
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
