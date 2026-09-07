const test = require('node:test');
const assert = require('node:assert/strict');

// Setup mock browser environment
global.window = {
  scrollTo: () => {},
  innerHeight: 800,
  visualViewport: {
    height: 800,
    offsetTop: 0,
    addEventListener: () => {}
  },
  addEventListener: () => {},
  matchMedia: () => ({ matches: false }),
  location: { pathname: '/', search: '' }
};
global.navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  platform: 'Win32',
  maxTouchPoints: 0
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

const elements = {};
global.document = {
  body: {
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    appendChild(el) { el.parentElement = this; },
    removeChild(el) { el.parentElement = null; },
    scrollTop: 0
  },
  documentElement: {
    style: {
      _props: {},
      setProperty(k, v) { this._props[k] = v; },
      getPropertyValue(k) { return this._props[k]; }
    }
  },
  getElementById(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        style: {},
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); }
        },
        parentElement: global.document.body,
        addEventListener: () => {}
      };
    }
    return elements[id];
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return {
      style: {},
      offsetHeight: 0
    };
  },
  addEventListener: () => {},
  visibilityState: 'visible'
};

const ModalBackdropService = require('../js/modalBackdropService.js');

test('ModalBackdropService exports all expected functions', () => {
  assert.equal(typeof ModalBackdropService.ensureOverlayInBody, 'function');
  assert.equal(typeof ModalBackdropService.initOverlayPlacement, 'function');
  assert.equal(typeof ModalBackdropService.openModal, 'function');
  assert.equal(typeof ModalBackdropService.closeModal, 'function');
  assert.equal(typeof ModalBackdropService.forceViewportReset, 'function');
  assert.equal(typeof ModalBackdropService.initBackdropTapHandlers, 'function');
  assert.equal(typeof ModalBackdropService.initAndroidSafeAreaFallback, 'function');
  assert.equal(typeof ModalBackdropService.initVisualViewportAdjustment, 'function');
  assert.ok(Array.isArray(ModalBackdropService.FULLSCREEN_OVERLAY_IDS));
});

test('ModalBackdropService.openModal adds active and modal-open classes', () => {
  const modalId = 'test-modal-1';
  ModalBackdropService.openModal(modalId, { instant: true });
  const el = document.getElementById(modalId);
  assert.ok(el.classList.contains('active'));
  assert.ok(document.body.classList.contains('modal-open'));
  assert.equal(localStorage.getItem('bg_active_modal_id'), modalId);
});

test('ModalBackdropService.closeModal removes active class and updates storage', () => {
  const modalId = 'test-modal-1';
  ModalBackdropService.closeModal(modalId, { userInitiated: true });
  const el = document.getElementById(modalId);
  assert.ok(!el.classList.contains('active'));
  assert.ok(!document.body.classList.contains('modal-open'));
  assert.equal(localStorage.getItem('bg_active_modal_id'), null);
});

test('ModalBackdropService.ensureOverlayInBody attaches overlay to body if nested elsewhere', () => {
  const fakeParent = { appendChild: () => {} };
  const overlayEl = {
    id: 'auth-overlay',
    classList: { contains: (c) => c === 'auth-overlay' },
    parentElement: fakeParent
  };
  ModalBackdropService.ensureOverlayInBody(overlayEl);
  assert.equal(overlayEl.parentElement, document.body);
});

test('ModalBackdropService.initVisualViewportAdjustment sets CSS variables', () => {
  ModalBackdropService.initVisualViewportAdjustment();
  assert.equal(document.documentElement.style.getPropertyValue('--viewport-height'), '800px');
  assert.equal(document.documentElement.style.getPropertyValue('--viewport-offset-top'), '0px');
  assert.equal(document.documentElement.style.getPropertyValue('--keyboard-height'), '0px');
});
