'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// Require the service
const AppInitService = require('../js/appInitService.js');

test('AppInitService: exports expected lifecycle and initialization functions', () => {
  assert.strictEqual(typeof AppInitService, 'object');
  assert.strictEqual(typeof AppInitService.initApp, 'function');
  assert.strictEqual(typeof AppInitService._bootApp, 'function');
  assert.strictEqual(typeof AppInitService.installAntiZoomGuard, 'function');
  assert.strictEqual(typeof AppInitService.installHalfInitWatchdog, 'function');
  assert.strictEqual(typeof AppInitService.autoRecoverTemplatesFromHistory, 'function');
});

test('AppInitService: installAntiZoomGuard runs safely without visualViewport', () => {
  assert.doesNotThrow(() => {
    AppInitService.installAntiZoomGuard();
  });
});

test('AppInitService: installHalfInitWatchdog installs timer safely', () => {
  assert.doesNotThrow(() => {
    AppInitService.installHalfInitWatchdog();
  });
});

test('AppInitService: autoRecoverTemplatesFromHistory sets localStorage flag', () => {
  const storage = {};
  global.localStorage = {
    setItem: (k, v) => { storage[k] = v; },
    getItem: (k) => storage[k] || null
  };

  try {
    AppInitService.autoRecoverTemplatesFromHistory();
    assert.strictEqual(storage['templates_autorecovered'], 'true');
  } finally {
    delete global.localStorage;
  }
});

test('AppInitService: _bootApp handles errors and calls showRecoveryMode if initApp throws', async () => {
  let recoveryMsg = null;
  global.window = {
    showRecoveryMode: (msg) => { recoveryMsg = msg; }
  };

  // Temporarily override initApp in instance to test _bootApp recovery wrapper
  const origInit = AppInitService.initApp;
  try {
    // Calling _bootApp on the default instance will reject since full DOM is absent, triggering recovery mode
    await AppInitService._bootApp();
    assert.ok(recoveryMsg !== null, 'Recovery mode was triggered on boot failure');
  } finally {
    delete global.window;
  }
});
