const { test } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.window.location = { pathname: '/', search: '' };
global.window.addEventListener = () => {};
global.history = {
  pushState() {}
};
global.document = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  addEventListener() {}
};
global.state = {
  historyPushed: false
};

const GestureEngine = require('../js/gestureEngine.js');

test('GestureEngine exports expected initialization functions', () => {
  assert.strictEqual(typeof GestureEngine.initPullToRefresh, 'function');
  assert.strictEqual(typeof GestureEngine.initSwipeToBack, 'function');
  assert.strictEqual(typeof GestureEngine.initLightboxPinchZoom, 'function');
});

test('GestureEngine initialization functions execute safely when DOM elements absent', () => {
  assert.doesNotThrow(() => {
    GestureEngine.initPullToRefresh();
    GestureEngine.initSwipeToBack();
    GestureEngine.initLightboxPinchZoom();
  });
});
