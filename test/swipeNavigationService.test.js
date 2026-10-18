const test = require('node:test');
const assert = require('node:assert/strict');
const SwipeNavigationService = require('../js/swipeNavigationService.js');

test('SwipeNavigationService exports all expected functions', () => {
  assert.equal(typeof SwipeNavigationService.initTabSwipeNavigation, 'function');
  assert.equal(typeof SwipeNavigationService.initStatsTransactionsModalSwipe, 'function');
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

// ---------------------------------------------------------------------------
// Gesture behaviour (pointer events)
// ---------------------------------------------------------------------------

function makeFakeElement() {
  const listeners = {};
  return {
    _listeners: listeners,
    style: {},
    classList: {
      _classes: new Set(),
      add(cls) { this._classes.add(cls); },
      remove(cls) { this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); }
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, event) {
      (listeners[type] || []).forEach(fn => fn(event));
    }
  };
}

function setupSwipeHarness(appState) {
  const appContent = makeFakeElement();
  const listEl = makeFakeElement();

  global.state = appState;
  global.window = {
    state: appState,
    innerWidth: 400,
    syncStatsDate: () => {},
    scrollToToday: () => {},
    processRecurringTemplates: () => {},
    updateHeaderAndSync: () => {},
    renderTransactionsTab: () => {}
  };
  global.document = {
    querySelector: (sel) => (sel === '.app-content' ? appContent : null),
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'transactions-list' ? listEl : null),
    body: { classList: { add: () => {}, remove: () => {} } }
  };

  SwipeNavigationService.initTabSwipeNavigation();
  return appContent;
}

function makeState(overrides) {
  return Object.assign({
    activeTab: 'trans',
    selectionMode: false,
    isSwipingMonth: false,
    selectedMonth: 5,
    selectedYear: 2026,
    touchDidMove: false,
    lastSwipeTime: 0
  }, overrides || {});
}

test('horizontal swipe changes the month (18px travel is enough)', () => {
  const appState = makeState();
  const appContent = setupSwipeHarness(appState);

  appContent.dispatch('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 300, clientY: 200 });
  appContent.dispatch('pointermove', { pointerId: 1, clientX: 282, clientY: 203 });
  appContent.dispatch('pointerup', { pointerId: 1, clientX: 282 });

  assert.equal(appState.selectedMonth, 6, 'swipe left advances to the next month');
});

test('vertical drag never changes the month', () => {
  const appState = makeState();
  const appContent = setupSwipeHarness(appState);

  appContent.dispatch('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 300 });
  appContent.dispatch('pointermove', { pointerId: 2, clientX: 203, clientY: 270 });
  appContent.dispatch('pointerup', { pointerId: 2, clientX: 203, clientY: 270 });

  assert.equal(appState.selectedMonth, 5, 'a scroll is not a month swipe');
});

test('ghost click of the swipe is swallowed once, a new tap is never eaten', () => {
  const appState = makeState();
  const appContent = setupSwipeHarness(appState);

  appContent.dispatch('pointerdown', { pointerType: 'touch', pointerId: 3, clientX: 300, clientY: 200 });
  appContent.dispatch('pointermove', { pointerId: 3, clientX: 270, clientY: 200 });
  appContent.dispatch('pointerup', { pointerId: 3, clientX: 270 });

  let ghostStopped = false;
  appContent.dispatch('click', {
    cancelable: true,
    preventDefault: () => {},
    stopPropagation: () => { ghostStopped = true; }
  });
  assert.equal(ghostStopped, true, 'the click synthesized by the swipe is suppressed');

  // A new finger-down is a new intent: the very next tap must go through.
  appContent.dispatch('pointerdown', { pointerType: 'touch', pointerId: 4, clientX: 120, clientY: 120 });
  let tapStopped = false;
  appContent.dispatch('click', {
    cancelable: true,
    preventDefault: () => {},
    stopPropagation: () => { tapStopped = true; }
  });
  assert.equal(tapStopped, false, 'a deliberate tap right after a swipe is not swallowed');
});

test('stats "Κινήσεις" modal swipe moves the stats period', () => {
  const calls = [];
  const modal = makeFakeElement();
  const surface = makeFakeElement();
  modal.querySelector = (sel) => (sel === '.modal-body' ? surface : null);

  const appState = makeState({
    activeTab: 'stats',
    activeSubcategoryTransactions: { category: 'Food', subcategory: 'Coffee' }
  });

  global.state = appState;
  global.window = {
    state: appState,
    // navigateMonth schedules window.scrollToToday(50ms later), so the helper
    // set must stay available while this test is the one holding `window`.
    syncStatsDate: () => {},
    scrollToToday: () => {},
    processRecurringTemplates: () => {},
    updateHeaderAndSync: () => {},
    renderTransactionsTab: () => {},
    adjustStatsPeriod: (direction, deltaX) => { calls.push([direction, deltaX]); }
  };
  global.document = {
    getElementById: (id) => (id === 'stats-transactions-modal' ? modal : null)
  };

  SwipeNavigationService.initStatsTransactionsModalSwipe();

  surface.dispatch('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 300, clientY: 300 });
  surface.dispatch('pointermove', { pointerId: 7, clientX: 250, clientY: 302 });
  surface.dispatch('pointerup', { pointerId: 7, clientX: 250 });

  assert.deepEqual(calls, [[1, 0]], 'swipe left goes to the next stats period');

  // Vertical scroll inside the modal must stay untouched.
  surface.dispatch('pointerdown', { pointerType: 'touch', pointerId: 8, clientX: 300, clientY: 300 });
  surface.dispatch('pointermove', { pointerId: 8, clientX: 302, clientY: 250 });
  surface.dispatch('pointerup', { pointerId: 8, clientX: 302, clientY: 250 });

  assert.deepEqual(calls, [[1, 0]], 'a vertical scroll does not change the period');
});

