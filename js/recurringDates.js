/**
 * recurringDates.js
 *
 * Pure date helpers for recurring transaction templates.
 * Extracted from app.js (Phase 2, Extraction 5).
 *
 * Functions:
 *  - getDeletedDatesFromTemplate: reads the deleted_dates marker from
 *    template.description (encoded as "||deleted_dates:YYYY-MM-DD,...")
 *  - addDeletedDateToTemplate: mutates template.description to add a date
 *    to the deleted_dates list (idempotent — won't add duplicates)
 *  - _computeRecurringSeriesDates: computes the full set of YYYY-MM-DD date
 *    strings that a recurring template would generate (up to its endDate or
 *    12 months into the future for perpetual series), skipping deleted dates.
 *
 * Zero external dependencies — no state, no DOM, no Supabase.
 * _computeRecurringSeriesDates calls getDeletedDatesFromTemplate internally.
 *
 * UMD wrapper (same proven pattern as other extracted modules):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.getDeletedDatesFromTemplate,
 *              window.addDeletedDateToTemplate,
 *              window._computeRecurringSeriesDates
 *
 * Loaded BEFORE app.js via <script src="js/recurringDates.js"> in index.html.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.getDeletedDatesFromTemplate   = exports.getDeletedDatesFromTemplate;
    root.addDeletedDateToTemplate      = exports.addDeletedDateToTemplate;
    root._computeRecurringSeriesDates  = exports._computeRecurringSeriesDates;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Reads the list of explicitly-deleted occurrence dates from a recurring
   * template's description field.
   *
   * The deleted dates are encoded inline in template.description as:
   *   "some description ||deleted_dates:YYYY-MM-DD,YYYY-MM-DD,..."
   *
   * @param {Object|null} template  Recurring template object
   * @returns {string[]}  Array of YYYY-MM-DD strings (may be empty)
   */
  function getDeletedDatesFromTemplate(template) {
    if (!template) return [];
    const desc = template.description || '';
    const match = desc.match(/\|\|deleted_dates:([^\s]+)/);
    if (match) {
      return match[1].split(',').filter(d => d);
    }
    return [];
  }

  /**
   * Adds a date string to the template's inline deleted_dates list.
   * Mutates template.description in place. Idempotent (no duplicates).
   *
   * @param {Object|null} template    Recurring template object
   * @param {string}      dateString  YYYY-MM-DD date to mark as deleted
   */
  function addDeletedDateToTemplate(template, dateString) {
    if (!template) return;
    const currentDates = getDeletedDatesFromTemplate(template);
    if (!currentDates.includes(dateString)) {
      currentDates.push(dateString);
    }
    let cleanDesc = (template.description || '').split('||deleted_dates:')[0].trim();
    template.description = `${cleanDesc} ||deleted_dates:${currentDates.join(',')}`.trim();
  }

  /**
   * Computes the complete list of YYYY-MM-DD occurrence dates for a recurring
   * template — from its start date up to its end date (or 12 months into the
   * future for perpetual series). Skips any dates that are in the template's
   * deleted_dates list.
   *
   * Supported presets: 'daily', 'weekly', 'monthly', 'yearly',
   *                    'specific_months', 'custom'
   *
   * Hard cap at 240 loop iterations (~20 years) to guarantee termination.
   *
   * @param {Object|null} template  Recurring template object (JS-side / camelCase)
   * @returns {string[]}  Sorted array of YYYY-MM-DD date strings
   */
  function _computeRecurringSeriesDates(template) {
    if (!template) return [];
    const preset = template.preset || 'monthly';
    const startDate = new Date(template.startDate || new Date().toISOString().split('T')[0]);
    if (isNaN(startDate.getTime())) return [];

    const startYear  = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay   = startDate.getDate();

    const endDateStr = template.endDate || null;
    const endLimit   = (endDateStr && !isNaN(new Date(endDateStr).getTime()))
      ? new Date(endDateStr) : null;

    const today     = new Date();
    const maxFuture = new Date(today.getFullYear(), today.getMonth() + 12, 1);

    const deletedDates = getDeletedDatesFromTemplate(template);
    const dates = [];
    let year  = startYear;
    let month = startMonth;

    let maxIterations = 240; // Hard cap at 20 years to guarantee termination
    while (maxIterations-- > 0) {
      const yearMonth = new Date(year, month, 1);
      if (yearMonth > maxFuture) break;
      if (endLimit && yearMonth > endLimit) break;

      const monthNum  = month + 1;
      const lastDay   = new Date(year, month + 1, 0).getDate();
      const monthDates = [];

      if (preset === 'daily') {
        for (let d = 1; d <= lastDay; d++) {
          if (year === startYear && month === startMonth && d < startDay) continue;
          monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
      } else if (preset === 'weekly') {
        const targetDayOfWeek = startDate.getDay();
        for (let d = 1; d <= lastDay; d++) {
          const dObj = new Date(year, month, d);
          if (dObj.getDay() === targetDayOfWeek) {
            if (year === startYear && month === startMonth && d < startDay) continue;
            monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          }
        }
      } else if (preset === 'monthly') {
        const day = Math.min(startDay, lastDay);
        if (!(year === startYear && month === startMonth && day < startDay)) {
          monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      } else if (preset === 'yearly') {
        if (month === startMonth) {
          const day = Math.min(startDay, lastDay);
          monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      } else if (preset === 'specific_months') {
        if (template.months && template.months.includes(monthNum)) {
          const day = Math.min(startDay, lastDay);
          if (!(year === startYear && month === startMonth && day < startDay)) {
            monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
          }
        }
      } else if (preset === 'custom') {
        if (template.months && template.months.includes(monthNum) && template.days) {
          template.days.forEach(function (day) {
            if (day <= lastDay) {
              if (year === startYear && month === startMonth && day < startDay) return;
              monthDates.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
            }
          });
        }
      }

      monthDates.forEach(function (ds) {
        if (endLimit && ds > endDateStr) return;
        if (deletedDates.includes(ds)) return;
        dates.push(ds);
      });

      month++;
      if (month > 11) { month = 0; year++; }
    }

    return dates;
  }

  return {
    getDeletedDatesFromTemplate:  getDeletedDatesFromTemplate,
    addDeletedDateToTemplate:     addDeletedDateToTemplate,
    _computeRecurringSeriesDates: _computeRecurringSeriesDates,
  };
});
