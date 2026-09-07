const { test } = require('node:test');
const assert = require('node:assert');

const TabNavigationService = require('../js/tabNavigationService.js');

test('TabNavigationService exports all expected functions', () => {
  assert.strictEqual(typeof TabNavigationService.resetAllTabScreenStyles, 'function');
  assert.strictEqual(typeof TabNavigationService.switchTab, 'function');
  assert.strictEqual(typeof TabNavigationService.toggleStatsType, 'function');
});

test('TabNavigationService.switchTab updates state and triggers render', () => {
  let flushUICalled = false;
  let historyPushedCalled = false;
  global.state = {
    activeTab: 'trans',
    expandedStatsCategories: new Set(['food'])
  };
  global.localStorage = {
    _data: {},
    setItem: function (k, v) { this._data[k] = v; },
    getItem: function (k) { return this._data[k]; }
  };
  global.window = {
    flushUI: () => { flushUICalled = true; },
    ensureHistoryPushed: () => { historyPushedCalled = true; },
    updateNoteShortcutVisibility: () => {},
    location: { pathname: '/', search: '' }
  };
  global.document = {
    querySelectorAll: () => [],
    getElementById: () => null,
    body: {
      classList: {
        toggle: () => {}
      }
    }
  };

  TabNavigationService.switchTab('stats', true);

  assert.strictEqual(global.state.activeTab, 'stats');
  assert.strictEqual(global.localStorage.getItem('active_tab'), 'stats');
  assert.strictEqual(global.state.expandedStatsCategories.size, 0);
  assert.strictEqual(flushUICalled, true);
});

test('TabNavigationService.toggleStatsType updates type and calls render', () => {
  let renderCalled = false;
  global.state = {
    statsType: 'expense',
    expandedStatsCategories: new Set(['rent'])
  };
  global.window.renderStatsTab = () => { renderCalled = true; };

  TabNavigationService.toggleStatsType('income');

  assert.strictEqual(global.state.statsType, 'income');
  assert.strictEqual(global.state.expandedStatsCategories.size, 0);
  assert.strictEqual(renderCalled, true);
});

test('TabNavigationService.resetAllTabScreenStyles runs safely', () => {
  assert.doesNotThrow(() => {
    TabNavigationService.resetAllTabScreenStyles();
  });
});
