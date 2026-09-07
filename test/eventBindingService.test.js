'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// Require the service
const EventBindingService = require('../js/eventBindingService.js');

test('EventBindingService: exports setupEventListeners as a function', () => {
  assert.strictEqual(typeof EventBindingService, 'object');
  assert.strictEqual(typeof EventBindingService.setupEventListeners, 'function');
});

test('EventBindingService: setupEventListeners executes safely when document is undefined', () => {
  assert.doesNotThrow(() => {
    EventBindingService.setupEventListeners();
  });
});

test('EventBindingService: attaches event listeners to DOM elements when document is present', () => {
  const listeners = {};
  function makeMockElement(id, className = '') {
    return {
      id: id || '',
      className: className || '',
      tagName: 'DIV',
      value: '',
      classList: {
        contains: (cls) => (className || '').includes(cls),
        add: (cls) => { className += ' ' + cls; },
        remove: (cls) => { className = (className || '').replace(cls, '').trim(); }
      },
      getAttribute: (attr) => (attr === 'data-tab' ? 'trans' : (attr === 'data-rating' ? '5' : null)),
      setAttribute: () => {},
      addEventListener: (event, handler) => {
        const k = id || className || event;
        if (!listeners[k]) listeners[k] = [];
        listeners[k].push(handler);
      },
      removeEventListener: () => {},
      closest: () => null,
      style: {},
      textContent: ''
    };
  }

  const elementsMap = {};
  function getOrCreateElement(id) {
    if (!elementsMap[id]) {
      elementsMap[id] = makeMockElement(id);
    }
    return elementsMap[id];
  }

  const navItem = makeMockElement(null, 'nav-item');
  const starItem = makeMockElement(null, 'feedback-star');
  const chipItem = makeMockElement(null, 'feedback-chip');

  global.window = global.window || {};
  global.window.state = {
    activeTab: 'trans',
    selectedMonth: 0,
    selectedYear: 2026,
    lang: 'el',
    transactions: [],
    recurringTemplates: []
  };

  global.document = {
    querySelector: (selector) => makeMockElement(null, selector),
    querySelectorAll: (selector) => {
      if (selector === '.nav-item') return [navItem];
      if (selector === '.feedback-star') return [starItem];
      if (selector === '.feedback-chip') return [chipItem];
      return [makeMockElement(null, selector)];
    },
    getElementById: (id) => getOrCreateElement(id),
    addEventListener: (event, handler) => {
      if (!listeners['doc_' + event]) listeners['doc_' + event] = [];
      listeners['doc_' + event].push(handler);
    }
  };

  global.switchTab = () => {};
  global.scrollToToday = () => {};
  global.navigateMonth = () => {};
  global.toggleStatsType = () => {};
  global.openAddTransactionModal = () => {};
  global.openRecurringTemplatesModal = () => {};
  global.openSettingsCategoryManager = () => {};
  global.openTrashBinModal = () => {};
  global.closeCalculatorKeypad = () => {};
  global.updateCategoryDisplay = () => {};
  global.updateSubcategorySuggestions = () => {};
  global.openSearchOverlay = () => {};

  try {
    assert.doesNotThrow(() => {
      EventBindingService.setupEventListeners();
    });

    assert.ok(listeners['period-prev'] && listeners['period-prev'].length > 0);
    assert.ok(listeners['period-next'] && listeners['period-next'].length > 0);
    assert.ok(listeners['stats-tab-expense'] && listeners['stats-tab-expense'].length > 0);
    assert.ok(listeners['fab-btn'] && listeners['fab-btn'].length > 0);
  } finally {
    delete global.document;
  }
});
