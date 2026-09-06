const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); }
};

global.state = {
  lang: 'el',
  overviewYear: 2026
};

global.TRANSLATIONS = {
  el: {
    settings_pref_desc: 'Προτιμήσεις εφαρμογής'
  }
};

const elements = {};
global.document = {
  getElementById(id) {
    if (!elements[id]) {
      const classes = new Set();
      elements[id] = {
        id,
        style: {},
        textContent: '',
        value: '',
        classList: {
          add(c) { classes.add(c); },
          remove(c) { classes.delete(c); },
          contains(c) { return classes.has(c); }
        },
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
    }
    return elements[id];
  },
  querySelectorAll(sel) {
    return [];
  },
  querySelector(sel) {
    return null;
  },
  addEventListener() {}
};

global.renderAccountsTab = () => {};
global.openModal = () => {};
global.closeModal = () => {};

const SettingsSubscreenManager = require('../js/settingsSubscreenManager.js');

test('SettingsSubscreenManager: exports all expected functions to module and window', () => {
  assert.strictEqual(typeof SettingsSubscreenManager.openSettingsSubscreen, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.openNotesManager, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.changeOverviewYear, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.saveCustomSavingsTarget, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.initDescriptionAutoGrow, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.initSettingsSubscreenAndFhs, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.openFinancialHealthModal, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.toggleFhsExplain, 'function');
  assert.strictEqual(typeof SettingsSubscreenManager.showFhsTab, 'function');

  // Verify window attachments
  assert.strictEqual(typeof window.openSettingsSubscreen, 'function');
  assert.strictEqual(typeof window.openNotesManager, 'function');
  assert.strictEqual(typeof window.changeOverviewYear, 'function');
  assert.strictEqual(typeof window.saveCustomSavingsTarget, 'function');
  assert.strictEqual(typeof window.initDescriptionAutoGrow, 'function');
  assert.strictEqual(typeof window.initSettingsSubscreenAndFhs, 'function');
  assert.strictEqual(typeof window.openFinancialHealthModal, 'function');
  assert.strictEqual(typeof window.toggleFhsExplain, 'function');
  assert.strictEqual(typeof window.showFhsTab, 'function');
});

test('SettingsSubscreenManager: changeOverviewYear adjusts overviewYear', () => {
  state.overviewYear = 2026;
  SettingsSubscreenManager.changeOverviewYear(1);
  assert.strictEqual(state.overviewYear, 2027);

  SettingsSubscreenManager.changeOverviewYear(-2);
  assert.strictEqual(state.overviewYear, 2025);
});

test('SettingsSubscreenManager: showFhsTab toggles tab display states', () => {
  const breakdownContent = document.getElementById('fhs-content-breakdown');
  const methodologyContent = document.getElementById('fhs-content-methodology');

  SettingsSubscreenManager.showFhsTab('breakdown');
  assert.strictEqual(breakdownContent.style.display, 'block');
  assert.strictEqual(methodologyContent.style.display, 'none');

  SettingsSubscreenManager.showFhsTab('methodology');
  assert.strictEqual(breakdownContent.style.display, 'none');
  assert.strictEqual(methodologyContent.style.display, 'block');
});
