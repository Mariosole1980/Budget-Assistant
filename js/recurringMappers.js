/**
 * recurringMappers.js
 *
 * Pure data mappers for recurring transaction templates.
 * Handles camelCase JS <-> snake_case Postgres field naming.
 *
 * Extracted from app.js (Phase 2, Extraction 2).
 *
 * Zero dependencies — no state, no DOM, no Supabase, no globals.
 *
 * UMD wrapper (same proven pattern as js/utils.js, js/calcKeypad.js):
 *   - Node / CommonJS: module.exports (used by node:test)
 *   - Browser: window.mapTemplateToDb, window.mapTemplateFromDb
 *
 * Loaded BEFORE app.js via <script src="js/recurringMappers.js"> in index.html.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: expose as named globals so app.js call sites need no changes
    var exports = factory();
    root.mapTemplateToDb   = exports.mapTemplateToDb;
    root.mapTemplateFromDb = exports.mapTemplateFromDb;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Converts a recurring template from its camelCase JS representation
   * to the snake_case shape expected by the Supabase Postgres schema.
   *
   * @param {Object|null} t  JS-side template object
   * @returns {Object|null}  DB-ready object, or null for falsy input
   */
  function mapTemplateToDb(t) {
    if (!t) return null;
    return {
      id:           t.id,
      user_id:      t.user_id      || null,
      family_id:    t.family_id    || null,
      is_shared:    !!t.is_shared,
      amount:       parseFloat(t.amount || 0),
      currency:     t.currency     || 'EUR',
      type:         t.type,
      category:     t.category,
      subcategory:  t.subcategory  || null,
      account_from: t.account_from,
      account_to:   t.account_to   || null,
      note:         t.note         || null,
      description:  t.description  || null,
      preset:       t.preset       || 'monthly',
      days:         Array.isArray(t.days)   ? t.days   : [],
      months:       Array.isArray(t.months) ? t.months : [],
      years:        Array.isArray(t.years)  ? t.years  : [],
      end_type:     t.endType      || 'perpetual',
      end_date:     t.endDate      || null,
      start_date:   t.startDate    || null,
      start_year:   t.startYear    || null,
      start_month:  t.startMonth   || null,
    };
  }

  /**
   * Converts a recurring template from the snake_case Postgres shape
   * back to its camelCase JS representation used throughout the app.
   *
   * @param {Object|null} t  DB row object
   * @returns {Object|null}  JS-side template object, or null for falsy input
   */
  function mapTemplateFromDb(t) {
    if (!t) return null;
    return {
      id:           t.id,
      user_id:      t.user_id,
      family_id:    t.family_id,
      is_shared:    !!t.is_shared,
      amount:       parseFloat(t.amount || 0),
      currency:     t.currency     || 'EUR',
      type:         t.type,
      category:     t.category,
      subcategory:  t.subcategory  || '',
      account_from: t.account_from,
      account_to:   t.account_to   || null,
      note:         t.note         || '',
      description:  t.description  || '',
      preset:       t.preset       || 'monthly',
      days:         Array.isArray(t.days)   ? t.days   : [],
      months:       Array.isArray(t.months) ? t.months : [],
      years:        Array.isArray(t.years)  ? t.years  : [],
      endType:      t.end_type     || 'perpetual',
      endDate:      t.end_date     || null,
      startDate:    t.start_date   || null,
      startYear:    t.start_year   || null,
      startMonth:   t.start_month  || null,
    };
  }

  return {
    mapTemplateToDb:   mapTemplateToDb,
    mapTemplateFromDb: mapTemplateFromDb,
  };
});
