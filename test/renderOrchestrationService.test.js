'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const RenderOrchestrationService = require('../js/renderOrchestrationService.js');

describe('RenderOrchestrationService Module Tests', () => {
  beforeEach(() => {
    const classListSet = new Set();
    global.window = {
      state: {
        activeTab: 'trans',
        selectedMonth: 8,
        selectedYear: 2026,
        transactions: [],
        recurringTemplates: []
      },
      _authConfirmed: true,
      _lastResumeTimestamp: Date.now() - 500
    };
    global.document = {
      documentElement: {
        classList: {
          add: (cls) => classListSet.add(cls),
          remove: (cls) => classListSet.delete(cls),
          contains: (cls) => classListSet.has(cls)
        }
      },
      getElementById: (id) => ({
        id,
        textContent: '',
        innerHTML: '',
        style: {},
        classList: { contains: () => false, add: () => { }, remove: () => { } }
      }),
      querySelector: () => null
    };
    global.localStorage = {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    };
    global.state = global.window.state;
  });

  test('RenderOrchestrationService exports all expected functions', () => {
    assert.strictEqual(typeof RenderOrchestrationService.pushNoTransition, 'function');
    assert.strictEqual(typeof RenderOrchestrationService.popNoTransition, 'function');
    assert.strictEqual(typeof RenderOrchestrationService._isWithinResumeWindow, 'function');
    assert.strictEqual(typeof RenderOrchestrationService._runScheduledRender, 'function');
    assert.strictEqual(typeof RenderOrchestrationService.updateUI, 'function');
    assert.strictEqual(typeof RenderOrchestrationService.flushUI, 'function');
    assert.strictEqual(typeof RenderOrchestrationService.getActiveScrollContainer, 'function');
    assert.strictEqual(typeof RenderOrchestrationService._isAuthenticated, 'function');
    assert.strictEqual(typeof RenderOrchestrationService._updateUIImpl, 'function');
    assert.strictEqual(typeof RenderOrchestrationService.updateHeaderAndSync, 'function');
  });

  test('pushNoTransition and popNoTransition manage reference counter properly', () => {
    // Reset counter
    while (RenderOrchestrationService.getNoTransitionCount() > 0) {
      RenderOrchestrationService.popNoTransition();
    }

    assert.strictEqual(RenderOrchestrationService.getNoTransitionCount(), 0);
    assert.strictEqual(global.document.documentElement.classList.contains('no-transition'), false);

    RenderOrchestrationService.pushNoTransition();
    assert.strictEqual(RenderOrchestrationService.getNoTransitionCount(), 1);
    assert.strictEqual(global.document.documentElement.classList.contains('no-transition'), true);

    RenderOrchestrationService.pushNoTransition();
    assert.strictEqual(RenderOrchestrationService.getNoTransitionCount(), 2);

    RenderOrchestrationService.popNoTransition();
    assert.strictEqual(RenderOrchestrationService.getNoTransitionCount(), 1);
    assert.strictEqual(global.document.documentElement.classList.contains('no-transition'), true);

    RenderOrchestrationService.popNoTransition();
    assert.strictEqual(RenderOrchestrationService.getNoTransitionCount(), 0);
    assert.strictEqual(global.document.documentElement.classList.contains('no-transition'), false);
  });

  test('_isWithinResumeWindow accurately determines recent resume', () => {
    global.window._lastResumeTimestamp = Date.now() - 200;
    assert.strictEqual(RenderOrchestrationService._isWithinResumeWindow(1000), true);
    assert.strictEqual(RenderOrchestrationService._isWithinResumeWindow(100), false);
  });

  test('_isAuthenticated correctly checks authConfirmed and guestMode', () => {
    global.window._authConfirmed = true;
    assert.strictEqual(RenderOrchestrationService._isAuthenticated(), true);

    global.window._authConfirmed = false;
    global.window.state.guestMode = false;
    global.window.state.currentUser = null;
    global.localStorage.removeItem('cached_current_user');
    global.localStorage.removeItem('auth_guest_mode');
    assert.strictEqual(RenderOrchestrationService._isAuthenticated(), false);

    global.window.state.guestMode = true;
    assert.strictEqual(RenderOrchestrationService._isAuthenticated(), true);

    global.window.state.guestMode = false;
    global.window._authConfirmed = false;
    global.window.state.currentUser = { id: 'u1', email: 'u1@test.com' };
    assert.strictEqual(RenderOrchestrationService._isAuthenticated(), true);
    assert.strictEqual(global.window._authConfirmed, true);

    global.window.state.currentUser = null;
    global.window._authConfirmed = false;
    global.localStorage.setItem('cached_current_user', JSON.stringify({ id: 'u2' }));
    assert.strictEqual(RenderOrchestrationService._isAuthenticated(), true);
    assert.strictEqual(global.window._authConfirmed, true);
  });

  test('flushUI cancels pending timers and resets dirty flag', () => {
    RenderOrchestrationService.updateUI();
    RenderOrchestrationService.flushUI();
    assert.strictEqual(RenderOrchestrationService.isDirty(), false);
  });
});
