/**
 * StatsPeriodService - Stats Period Navigation & Header Sync Feedback Subsystem
 *
 * Handles:
 * - adjustStatsPeriod: Smooth swipe/arrow adjustment of weekly, monthly, annually, or custom date ranges
 * - handleCustomPeriodSave: Validating and applying custom stats date ranges
 * - showSyncToast: Floating visual feedback toast for sync and cloud operations
 * - updateHeaderSyncIcon: Header cloud icon and status indicators
 *
 * UMD pattern: Browser global + Node.js module.exports
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StatsPeriodService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function _getState() {
    return (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : null)) || {};
  }

  var _syncToastTimer = null;

  /**
   * Adjust stats period by direction (-1 or +1) with optional starting swipe delta
   */
  function adjustStatsPeriod(direction, startingDeltaX) {
    startingDeltaX = startingDeltaX || 0;
    var appState = _getState();
    var animFn = typeof animateSwipeTransition === 'function'
      ? animateSwipeTransition
      : (typeof window !== 'undefined' && typeof window.animateSwipeTransition === 'function'
        ? window.animateSwipeTransition
        : function (dir, cb) { cb(); });

    animFn(direction, function () {
      if (appState.statsPeriodType === 'weekly') {
        appState.statsDate.setDate(appState.statsDate.getDate() + direction * 7);
      } else if (appState.statsPeriodType === 'monthly') {
        appState.statsDate.setDate(15);
        appState.statsDate.setMonth(appState.statsDate.getMonth() + direction);
        appState.selectedMonth = appState.statsDate.getMonth();
        appState.selectedYear = appState.statsDate.getFullYear();
        if (typeof updateHeaderAndSync === 'function') {
          updateHeaderAndSync();
        } else if (typeof window !== 'undefined' && typeof window.updateHeaderAndSync === 'function') {
          window.updateHeaderAndSync();
        }
      } else if (appState.statsPeriodType === 'annually') {
        appState.statsDate.setDate(15);
        appState.statsDate.setFullYear(appState.statsDate.getFullYear() + direction);
      } else if (appState.statsPeriodType === 'period') {
        var start = new Date(appState.statsCustomStart + 'T00:00:00');
        var end = new Date(appState.statsCustomEnd + 'T23:59:59');
        var durationMs = end - start + 1; // inclusive
        var newStart = new Date(start.getTime() + direction * durationMs);
        var newEnd = new Date(end.getTime() + direction * durationMs);
        appState.statsCustomStart = newStart.toISOString().split('T')[0];
        appState.statsCustomEnd = newEnd.toISOString().split('T')[0];
      }
      if (typeof renderStatsTab === 'function') {
        renderStatsTab(true);
      } else if (typeof window !== 'undefined' && typeof window.renderStatsTab === 'function') {
        window.renderStatsTab(true);
      }
    }, startingDeltaX);
  }

  /**
   * Save and validate custom period range from modal
   */
  function handleCustomPeriodSave() {
    if (typeof document === 'undefined') return;
    var appState = _getState();
    var startVal = document.getElementById('custom-period-start') ? document.getElementById('custom-period-start').value : '';
    var endVal = document.getElementById('custom-period-end') ? document.getElementById('custom-period-end').value : '';
    if (startVal && endVal) {
      if (new Date(startVal) > new Date(endVal)) {
        var translations = (typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS : (typeof window !== 'undefined' ? window.TRANSLATIONS : null)) || {};
        var lang = appState.lang || 'el';
        var msg = (translations[lang] && translations[lang]['alert_date_order']) || 'Invalid date range';
        if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
          window.showAlert(msg);
        } else if (typeof showToast === 'function') {
          showToast(msg, 'warning');
        } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
          window.showToast(msg, 'warning');
        }
        return;
      }
      if (appState.expandedStatsCategories && typeof appState.expandedStatsCategories.clear === 'function') {
        appState.expandedStatsCategories.clear();
      }
      appState.statsCustomStart = startVal;
      appState.statsCustomEnd = endVal;
      appState.statsPeriodType = 'period';

      var closeFn = typeof closeModal === 'function' ? closeModal : (typeof window !== 'undefined' ? window.closeModal : null);
      if (closeFn) closeFn('custom-period-modal');

      var renderFn = typeof renderStatsTab === 'function' ? renderStatsTab : (typeof window !== 'undefined' ? window.renderStatsTab : null);
      if (renderFn) renderFn();
    }
  }

  /**
   * Display floating toast with sync status feedback
   */
  function showSyncToast(message, autoDismissMs) {
    if (typeof document === 'undefined') return;
    autoDismissMs = autoDismissMs || 0;
    var toast = document.getElementById('sync-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sync-toast';
      toast.style.cssText =
        'position: fixed; bottom: 24px; right: 20px; z-index: 99999;' +
        'background: var(--card-bg, #1e1e2e); color: var(--text-primary, #fff);' +
        'border: 1px solid var(--accent, #7c6af7); border-radius: 14px;' +
        'padding: 12px 18px; font-size: 13px; font-weight: 600;' +
        'box-shadow: 0 8px 32px rgba(0,0,0,0.4);' +
        'display: flex; align-items: center; gap: 10px;' +
        'transform: translateY(80px); opacity: 0;' +
        'transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease;' +
        'max-width: 280px;';
      document.body.appendChild(toast);
    }

    toast.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent,#7c6af7);display:inline-block;animation:syncPulse 1s infinite;flex-shrink:0;"></span><span>' + message + '</span>';

    if (!document.getElementById('sync-toast-styles')) {
      var s = document.createElement('style');
      s.id = 'sync-toast-styles';
      s.textContent = '@keyframes syncPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }';
      document.head.appendChild(s);
    }

    var show = function () {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(show);
    } else {
      show();
    }

    if (message.startsWith('✅')) {
      updateHeaderSyncIcon('synced');
      var dot = toast.querySelector('span');
      if (dot) dot.style.animation = 'none';
    } else if (message.startsWith('⚠️')) {
      updateHeaderSyncIcon('error');
      var dotErr = toast.querySelector('span');
      if (dotErr) dotErr.style.animation = 'none';
    } else if (message.startsWith('☁️')) {
      updateHeaderSyncIcon('syncing');
    }

    if (_syncToastTimer) clearTimeout(_syncToastTimer);
    if (autoDismissMs > 0) {
      _syncToastTimer = setTimeout(function () {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
      }, autoDismissMs);
    }
  }

  /**
   * Update header sync status indicator dot, icon & settings labels
   */
  function updateHeaderSyncIcon(state_) {
    var appState = _getState();
    appState.syncStatus = state_;
    if (typeof document === 'undefined') return;

    var dot = document.getElementById('header-sync-dot');
    var icon = document.getElementById('header-sync-cloud-icon');
    if (!dot || !icon) return;

    var normalized = state_;
    if (state_ === 'success') normalized = 'synced';
    if (state_ === 'idle') normalized = 'offline';

    var colors = {
      offline: '#9e9e9e',
      syncing: '#ffd600',
      synced: '#4caf50',
      error: '#ef5350'
    };
    dot.style.background = colors[normalized] || '#9e9e9e';

    if (normalized === 'syncing') {
      dot.style.animation = 'syncDotPulse 0.8s infinite alternate';
    } else {
      dot.style.animation = 'none';
    }

    if (!document.getElementById('sync-dot-styles')) {
      var s = document.createElement('style');
      s.id = 'sync-dot-styles';
      s.textContent = '@keyframes syncDotPulse{from{opacity:1;transform:scale(1)}to{opacity:.3;transform:scale(1.6)}}';
      document.head.appendChild(s);
    }

    var btn = document.getElementById('header-sync-icon');
    var lang = appState.lang || 'el';
    var labels = lang === 'en' ? {
      offline: 'Local Storage',
      syncing: 'Syncing...',
      synced: 'Synced ✅',
      error: 'Sync Error ⚠️'
    } : {
      offline: 'Τοπική αποθήκευση',
      syncing: 'Συγχρονισμός...',
      synced: 'Συγχρονισμένο ✅',
      error: 'Σφάλμα συγχρονισμού ⚠️'
    };
    if (btn) btn.title = labels[normalized] || (lang === 'en' ? 'Sync' : 'Συγχρονισμός');

    var syncStatusEl = document.getElementById('val_sync_status');
    if (syncStatusEl) {
      var statusLabels = lang === 'en' ? {
        offline: 'Local Storage',
        syncing: 'Syncing...',
        synced: 'Active',
        error: 'Error'
      } : {
        offline: 'Τοπική Αποθήκευση',
        syncing: 'Συγχρονισμός...',
        synced: 'Ενεργός',
        error: 'Σφάλμα'
      };
      syncStatusEl.textContent = statusLabels[normalized] || (lang === 'en' ? 'Local Storage' : 'Τοπική Αποθήκευση');

      if (normalized === 'synced') {
        syncStatusEl.style.color = '#4caf50';
      } else if (normalized === 'error') {
        syncStatusEl.style.color = '#ef5350';
      } else {
        syncStatusEl.style.color = 'var(--text-secondary)';
      }
    }
  }

  var service = {
    adjustStatsPeriod: adjustStatsPeriod,
    handleCustomPeriodSave: handleCustomPeriodSave,
    showSyncToast: showSyncToast,
    updateHeaderSyncIcon: updateHeaderSyncIcon
  };

  if (typeof window !== 'undefined') {
    window.StatsPeriodService = service;
    window.adjustStatsPeriod = adjustStatsPeriod;
    window.handleCustomPeriodSave = handleCustomPeriodSave;
    window.showSyncToast = showSyncToast;
    window.updateHeaderSyncIcon = updateHeaderSyncIcon;
  }

  return service;
}));
