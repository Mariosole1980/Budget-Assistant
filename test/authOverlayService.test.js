const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.state = {
  lang: 'el',
  guestMode: false,
  currentUser: null
};

const domElements = {};
function getMockElement(id) {
  if (!domElements[id]) {
    const classes = new Set();
    domElements[id] = {
      id,
      style: {
        _props: {},
        cssText: '',
        setProperty(k, v) { this._props[k] = v; this[k] = v; },
        removeProperty(k) { delete this._props[k]; delete this[k]; }
      },
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, f) { if (f !== undefined) { f ? classes.add(c) : classes.delete(c); } }
      },
      innerHTML: '',
      textContent: '',
      value: '',
      addEventListener() {},
      appendChild(ch) {},
      remove() { delete domElements[id]; },
      querySelector(sel) { return null; },
      querySelectorAll(sel) { return []; }
    };
  }
  return domElements[id];
}

global.document = {
  getElementById(id) { return getMockElement(id); },
  querySelector(sel) { return null; },
  querySelectorAll(sel) { return []; },
  addEventListener() {},
  createElement(tag) { return getMockElement('mock_' + Math.random()); },
  body: {
    appendChild(ch) {},
    classList: {
      remove() {}
    }
  }
};

global.applyLanguage = () => {};
global.switchAuthTab = () => {};
global.forceViewportReset = () => {};
global.flushUI = () => {};
global.ensureOverlayInBody = () => {};
global.showAlert = () => {};

const AuthOverlayService = require('../js/authOverlayService.js');

test('AuthOverlayService: exports all expected functions', () => {
  const expectedFns = [
    'showAuthDiagnosticPanel',
    'openAuthWithDiagnostics',
    'showAuthOverlay',
    'hideAuthOverlay',
    'closeAuth'
  ];

  expectedFns.forEach(fn => {
    assert.strictEqual(typeof AuthOverlayService[fn], 'function', fn + ' must be a function');
  });
});

test('AuthOverlayService: showAuthOverlay activates overlay and sets userRequested flag', () => {
  const overlay = getMockElement('auth-overlay');
  AuthOverlayService.showAuthOverlay();

  assert.strictEqual(overlay.classList.contains('active'), true);
  assert.ok(overlay.style.cssText.includes('display: flex'));
  assert.strictEqual(AuthOverlayService.getAuthOverlayUserRequested(), true);
  assert.strictEqual(window._authOverlayUserRequested, true);
});

test('AuthOverlayService: hideAuthOverlay and closeAuth deactivate overlay and clear flag', () => {
  const overlay = getMockElement('auth-overlay');
  AuthOverlayService.showAuthOverlay();
  assert.strictEqual(overlay.classList.contains('active'), true);

  AuthOverlayService.closeAuth();
  assert.strictEqual(overlay.classList.contains('active'), false);
  assert.strictEqual(overlay.style.display, 'none');
  assert.strictEqual(AuthOverlayService.getAuthOverlayUserRequested(), false);
  assert.strictEqual(window._authOverlayUserRequested, false);
});

test('AuthOverlayService: showAuthDiagnosticPanel renders checks without throwing', () => {
  const checks = [
    { label: 'DOM element', status: 'ok', detail: 'Found element' },
    { label: 'Script loaded', status: 'fail', detail: 'Missing file' }
  ];

  assert.doesNotThrow(() => {
    AuthOverlayService.showAuthDiagnosticPanel(checks, new Error('Test error'));
  });
});
