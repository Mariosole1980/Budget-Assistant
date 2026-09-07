const { test } = require('node:test');
const assert = require('node:assert');

const I18nService = require('../js/i18nService.js');

test('I18nService exports all expected functions and constants', () => {
  assert.ok(Array.isArray(I18nService.GREEK_MONTHS_SHORT));
  assert.ok(Array.isArray(I18nService.GREEK_WEEKDAYS_SHORT));
  assert.ok(Array.isArray(I18nService.ENGLISH_MONTHS_SHORT));
  assert.ok(Array.isArray(I18nService.ENGLISH_WEEKDAYS_SHORT));
  assert.strictEqual(typeof I18nService.getMonthName, 'function');
  assert.strictEqual(typeof I18nService.getWeekdayName, 'function');
  assert.strictEqual(typeof I18nService.parseBuildNumber, 'function');
  assert.strictEqual(typeof I18nService.getActiveBuildLabel, 'function');
  assert.strictEqual(typeof I18nService.applyLanguage, 'function');
  assert.strictEqual(typeof I18nService.updateOTADiagnostic, 'function');
  assert.strictEqual(typeof I18nService.toggleLanguageSetting, 'function');
  assert.strictEqual(typeof I18nService.detectGeoLanguage, 'function');
  assert.strictEqual(typeof I18nService.formatGreekDateTime, 'function');
});

test('I18nService.getMonthName returns correct Greek and English names', () => {
  global.state = { lang: 'el' };
  assert.strictEqual(I18nService.getMonthName(0, false), 'Ιανουάριος');
  assert.strictEqual(I18nService.getMonthName(0, true), 'Ιαν');
  assert.strictEqual(I18nService.getMonthName(8, true), 'Σεπ');

  global.state = { lang: 'en' };
  assert.strictEqual(I18nService.getMonthName(0, false), 'January');
  assert.strictEqual(I18nService.getMonthName(0, true), 'Jan');
  assert.strictEqual(I18nService.getMonthName(8, true), 'Sep');
});

test('I18nService.getWeekdayName returns correct day names', () => {
  global.state = { lang: 'el' };
  assert.strictEqual(I18nService.getWeekdayName(1), 'Δευ');

  global.state = { lang: 'en' };
  assert.strictEqual(I18nService.getWeekdayName(1), 'Mon');
});

test('I18nService.parseBuildNumber parses various version formats accurately', () => {
  assert.strictEqual(I18nService.parseBuildNumber(1684), 1684);
  assert.strictEqual(I18nService.parseBuildNumber('1684'), 1684);
  assert.strictEqual(I18nService.parseBuildNumber('1.0.1684'), 1684);
  assert.strictEqual(I18nService.parseBuildNumber(null), -1);
  assert.strictEqual(I18nService.parseBuildNumber('invalid'), -1);
});

test('I18nService.getActiveBuildLabel constructs correct build string', () => {
  global.state = { lang: 'el' };
  global.CURRENT_BUILD = 1684;
  global.TRANSLATIONS = {
    el: { app_version: 'Έκδοση 1.0.0 (build v1600)' },
    en: { app_version: 'Version 1.0.0 (build v1600)' }
  };

  const label = I18nService.getActiveBuildLabel();
  assert.strictEqual(label, 'Έκδοση 1.0.0 (build v1684)');
});

test('I18nService.formatGreekDateTime formats timestamps appropriately', () => {
  global.state = { lang: 'el' };
  const formatted = I18nService.formatGreekDateTime('2026-09-07 14:30:00');
  assert.strictEqual(formatted, '7/9/26 (Δευ) 14:30');
  assert.strictEqual(I18nService.formatGreekDateTime(''), '');
});

test('I18nService.toggleLanguageSetting switches language', () => {
  global.state = { lang: 'el' };
  global.localStorage = {
    _data: {},
    setItem: function (k, v) { this._data[k] = v; },
    getItem: function (k) { return this._data[k]; }
  };
  global.showSyncToast = () => {};

  I18nService.toggleLanguageSetting();
  assert.strictEqual(global.state.lang, 'en');
  assert.strictEqual(global.localStorage.getItem('app_lang'), 'en');

  I18nService.toggleLanguageSetting();
  assert.strictEqual(global.state.lang, 'el');
  assert.strictEqual(global.localStorage.getItem('app_lang'), 'el');
});
