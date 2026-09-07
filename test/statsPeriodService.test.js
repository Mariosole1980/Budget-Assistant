const test = require('node:test');
const assert = require('node:assert/strict');

global.state = {
  statsPeriodType: 'monthly',
  statsDate: new Date(2026, 8, 15),
  selectedMonth: 8,
  selectedYear: 2026,
  lang: 'el',
  syncStatus: 'idle',
  expandedStatsCategories: new Set()
};

global.window = {
  state: global.state,
  animateSwipeTransition: (dir, cb) => cb(),
  updateHeaderAndSync: () => {},
  renderStatsTab: () => {},
  closeModal: () => {},
  showAlert: () => {}
};

const domElements = {};
global.document = {
  getElementById(id) {
    if (!domElements[id]) {
      domElements[id] = {
        id,
        style: {},
        value: id === 'custom-period-start' ? '2026-09-01' : id === 'custom-period-end' ? '2026-09-30' : '',
        textContent: '',
        innerHTML: '',
        querySelector: () => ({ style: {} })
      };
    }
    return domElements[id];
  },
  createElement() {
    return {
      style: {},
      innerHTML: '',
      querySelector: () => ({ style: {} })
    };
  },
  body: {
    appendChild: () => {}
  },
  head: {
    appendChild: () => {}
  }
};

const StatsPeriodService = require('../js/statsPeriodService.js');

test('StatsPeriodService exports expected functions', () => {
  assert.equal(typeof StatsPeriodService.adjustStatsPeriod, 'function');
  assert.equal(typeof StatsPeriodService.handleCustomPeriodSave, 'function');
  assert.equal(typeof StatsPeriodService.showSyncToast, 'function');
  assert.equal(typeof StatsPeriodService.updateHeaderSyncIcon, 'function');
});

test('adjustStatsPeriod increments and decrements month accurately', () => {
  global.state.statsPeriodType = 'monthly';
  global.state.statsDate = new Date(2026, 8, 15);
  StatsPeriodService.adjustStatsPeriod(1);
  assert.equal(global.state.selectedMonth, 9); // October
  StatsPeriodService.adjustStatsPeriod(-1);
  assert.equal(global.state.selectedMonth, 8); // September
});

test('handleCustomPeriodSave stores custom start and end and triggers render', () => {
  let closedModal = null;
  global.closeModal = (id) => { closedModal = id; };
  global.window.closeModal = global.closeModal;

  StatsPeriodService.handleCustomPeriodSave();
  assert.equal(global.state.statsCustomStart, '2026-09-01');
  assert.equal(global.state.statsCustomEnd, '2026-09-30');
  assert.equal(closedModal, 'custom-period-modal');
});

test('updateHeaderSyncIcon sets correct styles and state', () => {
  StatsPeriodService.updateHeaderSyncIcon('synced');
  assert.equal(global.state.syncStatus, 'synced');
  const dot = document.getElementById('header-sync-dot');
  assert.equal(dot.style.background, '#4caf50');
});
