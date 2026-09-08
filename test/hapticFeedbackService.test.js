'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const HapticFeedbackService = require('../js/hapticFeedbackService.js');

test('HapticFeedbackService exports all semantic trigger methods', () => {
  assert.strictEqual(typeof HapticFeedbackService.trigger, 'function');
  assert.strictEqual(typeof HapticFeedbackService.isEnabled, 'function');
  assert.strictEqual(typeof HapticFeedbackService.setEnabled, 'function');
  assert.strictEqual(typeof HapticFeedbackService.selection, 'function');
  assert.strictEqual(typeof HapticFeedbackService.light, 'function');
  assert.strictEqual(typeof HapticFeedbackService.medium, 'function');
  assert.strictEqual(typeof HapticFeedbackService.heavy, 'function');
  assert.strictEqual(typeof HapticFeedbackService.success, 'function');
  assert.strictEqual(typeof HapticFeedbackService.warning, 'function');
  assert.strictEqual(typeof HapticFeedbackService.error, 'function');
});

test('HapticFeedbackService returns false on unsupported environment without throwing', () => {
  assert.doesNotThrow(() => {
    const res = HapticFeedbackService.trigger('selection');
    assert.strictEqual(typeof res, 'boolean');
  });
  assert.doesNotThrow(() => {
    HapticFeedbackService.light();
    HapticFeedbackService.medium();
    HapticFeedbackService.heavy();
    HapticFeedbackService.success();
    HapticFeedbackService.warning();
    HapticFeedbackService.error();
  });
});

test('HapticFeedbackService toggles enabled state correctly', () => {
  const storage = {};
  const origLocal = global.localStorage;
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); }
  };

  try {
    assert.strictEqual(HapticFeedbackService.isEnabled(), true);
    HapticFeedbackService.setEnabled(false);
    assert.strictEqual(HapticFeedbackService.isEnabled(), false);
    assert.strictEqual(HapticFeedbackService.trigger('light'), false);

    HapticFeedbackService.setEnabled(true);
    assert.strictEqual(HapticFeedbackService.isEnabled(), true);
  } finally {
    if (origLocal !== undefined) {
      global.localStorage = origLocal;
    } else {
      delete global.localStorage;
    }
  }
});

test('HapticFeedbackService invokes navigator.vibrate when available', () => {
  let vibrateArgs = null;
  const originalVibrate = global.navigator ? global.navigator.vibrate : undefined;

  if (!global.navigator) {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true
    });
  }

  global.navigator.vibrate = (pattern) => {
    vibrateArgs = pattern;
    return true;
  };

  try {
    const res = HapticFeedbackService.trigger('light');
    assert.strictEqual(res, true);
    assert.strictEqual(vibrateArgs, 12);

    HapticFeedbackService.trigger('success');
    assert.deepStrictEqual(vibrateArgs, [15, 40, 20]);

    HapticFeedbackService.trigger('selection');
    assert.strictEqual(vibrateArgs, 8);
  } finally {
    if (originalVibrate !== undefined) {
      global.navigator.vibrate = originalVibrate;
    } else {
      delete global.navigator.vibrate;
    }
  }
});

test('HapticFeedbackService invokes Capacitor Haptics when available', () => {
  let capCall = null;
  global.window = {
    Capacitor: {
      Plugins: {
        Haptics: {
          impact: async (options) => { capCall = { method: 'impact', options }; },
          notification: async (options) => { capCall = { method: 'notification', options }; },
          selectionStart: async () => { capCall = { method: 'selectionStart' }; }
        }
      }
    }
  };

  try {
    const res = HapticFeedbackService.trigger('selection');
    assert.strictEqual(res, true);
    assert.strictEqual(capCall.method, 'selectionStart');

    HapticFeedbackService.trigger('medium');
    assert.deepStrictEqual(capCall, { method: 'impact', options: { style: 'MEDIUM' } });

    HapticFeedbackService.trigger('success');
    assert.deepStrictEqual(capCall, { method: 'notification', options: { type: 'SUCCESS' } });
  } finally {
    delete global.window;
  }
});
