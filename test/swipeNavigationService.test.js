const test = require('node:test');
const assert = require('node:assert/strict');
const SwipeNavigationService = require('../js/swipeNavigationService.js');

test('SwipeNavigationService exports all expected functions', () => {
  assert.equal(typeof SwipeNavigationService.initTabSwipeNavigation, 'function');
  assert.equal(typeof SwipeNavigationService.renderTransactionsForSwipe, 'function');
  assert.equal(typeof SwipeNavigationService.animateSwipeTransition, 'function');
  assert.equal(typeof SwipeNavigationService.navigateMonth, 'function');
  assert.equal(typeof SwipeNavigationService.initRippleEffects, 'function');
});

test('animateSwipeTransition executes callback and transitions list element', async () => {
  global.state = {
    activeTab: 'trans',
    isSwipingMonth: false,
    selectedMonth: 5,
    selectedYear: 2026
  };
  global.document = {
    getElementById: (id) => ({
      style: { transition: '', transform: '', opacity: '' },
      classList: { add: () => {}, remove: () => {} }
    }),
    body: {
      classList: { add: () => {}, remove: () => {} }
    }
  };

  let callbackCalled = false;
  SwipeNavigationService.animateSwipeTransition(1, () => {
    callbackCalled = true;
  });

  assert.equal(callbackCalled, true);
  // Wait for the transition and watchdog to complete
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(global.state.isSwipingMonth, false);
});

test('navigateMonth increments and decrements month with year rollover', async () => {
  global.state = {
    activeTab: 'trans',
    isSwipingMonth: false,
    selectedMonth: 11,
    selectedYear: 2026
  };
  global.window = {
    state: global.state,
    syncStatsDate: () => {},
    scrollToToday: () => {},
    processRecurringTemplates: () => {},
    updateHeaderAndSync: () => {},
    renderTransactionsTab: () => {}
  };
  global.document = {
    getElementById: () => ({
      style: { transition: '', transform: '', opacity: '' },
      classList: { add: () => {}, remove: () => {} }
    }),
    body: {
      classList: { add: () => {}, remove: () => {} }
    }
  };

  // Navigate forward from Dec 2026 -> Jan 2027
  SwipeNavigationService.navigateMonth(1);
  assert.equal(global.state.selectedMonth, 0);
  assert.equal(global.state.selectedYear, 2027);

  // Navigate backward from Jan 2027 -> Dec 2026
  SwipeNavigationService.navigateMonth(-1);
  assert.equal(global.state.selectedMonth, 11);
  assert.equal(global.state.selectedYear, 2026);

  await new Promise(resolve => setTimeout(resolve, 120));
});

test('renderTransactionsForSwipe triggers template generation and render pipelines', () => {
  let recTemplatesRan = false;
  let headerSyncRan = false;
  let transTabRan = false;

  global.window = {
    processRecurringTemplates: () => { recTemplatesRan = true; },
    updateHeaderAndSync: () => { headerSyncRan = true; },
    renderTransactionsTab: () => { transTabRan = true; },
    lastRenderedCategoryType: 'expense'
  };

  SwipeNavigationService.renderTransactionsForSwipe();

  assert.equal(recTemplatesRan, true);
  assert.equal(headerSyncRan, true);
  assert.equal(transTabRan, true);
  assert.equal(global.window.lastRenderedCategoryType, null);
});
