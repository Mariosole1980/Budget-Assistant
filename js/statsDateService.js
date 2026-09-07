/**
 * Stats Date & Period Calculation Subsystem
 * Extracted from app.js (Phase 23A Architectural Modularization)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StatsDateService = factory();
    root.getStatsDateRange = root.StatsDateService.getStatsDateRange;
    root.syncStatsDate = root.StatsDateService.syncStatsDate;
    root.formatStatsPeriodTitle = root.StatsDateService.formatStatsPeriodTitle;
    root.wrapPeriodTitleWithSpans = root.StatsDateService.wrapPeriodTitleWithSpans;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function getState() {
    if (typeof state !== 'undefined') return state;
    if (typeof window !== 'undefined' && window.state) return window.state;
    if (typeof global !== 'undefined' && global.state) return global.state;
    return {};
  }

  function getMonthNameSafe(idx, short) {
    if (typeof getMonthName === 'function') return getMonthName(idx, short);
    if (typeof window !== 'undefined' && typeof window.getMonthName === 'function') return window.getMonthName(idx, short);
    if (typeof global !== 'undefined' && typeof global.getMonthName === 'function') return global.getMonthName(idx, short);
    return '';
  }

  function getStorageItem(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        return localStorage.getItem(key);
      }
    } catch (_) { }
    return null;
  }

  function getStatsDateRange() {
    var appState = getState();
    var start, end;
    if (appState.statsPeriodType === 'weekly') {
      start = new Date(appState.statsDate || Date.now());
      var day = start.getDay();
      var weekStartDay = parseInt(getStorageItem('app_week_start') || '1', 10);
      var diff = day - weekStartDay;
      if (diff < 0) {
        diff += 7;
      }
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (appState.statsPeriodType === 'monthly') {
      var dateObj = appState.statsDate instanceof Date ? appState.statsDate : new Date();
      var monthStartDay = parseInt(getStorageItem('app_month_start') || '1', 10);
      if (monthStartDay === 1) {
        start = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        start = new Date(dateObj.getFullYear(), dateObj.getMonth(), monthStartDay, 0, 0, 0, 0);
        end = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, monthStartDay - 1, 23, 59, 59, 999);
      }
    } else if (appState.statsPeriodType === 'annually') {
      var d = appState.statsDate instanceof Date ? appState.statsDate : new Date();
      start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (appState.statsPeriodType === 'period') {
      start = new Date((appState.statsCustomStart || '') + 'T00:00:00');
      end = new Date((appState.statsCustomEnd || '') + 'T23:59:59');
    }
    return { start: start, end: end };
  }

  function syncStatsDate() {
    var appState = getState();
    if (!appState.statsDate || !(appState.statsDate instanceof Date)) {
      appState.statsDate = new Date();
    }
    appState.statsDate.setDate(15);
    if (appState.selectedYear != null) {
      appState.statsDate.setFullYear(appState.selectedYear);
    }
    if (appState.selectedMonth != null) {
      appState.statsDate.setMonth(appState.selectedMonth);
    }
  }

  function formatStatsPeriodTitle(start, end) {
    if (!start || !end) return '';
    var appState = getState();
    if (appState.statsPeriodType === 'monthly') {
      return getMonthNameSafe(start.getMonth(), true) + ' ' + start.getFullYear();
    }
    if (appState.statsPeriodType === 'annually') {
      return '' + start.getFullYear();
    }

    // Weekly or Custom Period
    var startDay = start.getDate();
    var startMonthShort = getMonthNameSafe(start.getMonth(), true);
    var startYear = start.getFullYear();

    var endDay = end.getDate();
    var endMonthShort = getMonthNameSafe(end.getMonth(), true);
    var endYear = end.getFullYear();

    if (startYear !== endYear) {
      return startDay + ' ' + startMonthShort + ' ' + startYear + ' - ' + endDay + ' ' + endMonthShort + ' ' + endYear;
    } else if (start.getMonth() !== end.getMonth()) {
      return startDay + ' ' + startMonthShort + ' - ' + endDay + ' ' + endMonthShort + ' ' + startYear;
    } else {
      return startDay + ' - ' + endDay + ' ' + startMonthShort + ' ' + startYear;
    }
  }

  function wrapPeriodTitleWithSpans(titleText) {
    if (!titleText) return '';
    var match = titleText.trim().match(/^(.*?)(?:\s+)?(\d{4})$/);
    if (match && match[1]) {
      var mainPart = match[1].trim();
      var yearPart = match[2];
      return '<span class="month-part">' + mainPart + '</span><span class="year-part" style="color: var(--text-secondary); margin-left: 6px;">' + yearPart + '</span>';
    }
    if (/^\d{4}$/.test(titleText.trim())) {
      return '<span class="year-part">' + titleText.trim() + '</span>';
    }
    return '<span class="month-part">' + titleText + '</span>';
  }

  return {
    getStatsDateRange: getStatsDateRange,
    syncStatsDate: syncStatsDate,
    formatStatsPeriodTitle: formatStatsPeriodTitle,
    wrapPeriodTitleWithSpans: wrapPeriodTitleWithSpans
  };
}));
