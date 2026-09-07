const { test } = require('node:test');
const assert = require('node:assert');

// DOM Mocks
const overlayStyle = { display: '', opacity: '', transition: '', visibility: '', backgroundColor: '' };
const frameStyle = { pointerEvents: '', transition: '', opacity: '' };
let removedFromParent = false;

const elements = {
  'cold-start-frame': {
    style: frameStyle,
    parentNode: {
      removeChild: () => { removedFromParent = true; }
    }
  },
  'resume-overlay': {
    style: overlayStyle
  }
};

global.document = {
  getElementById: (id) => elements[id] || null,
  documentElement: {
    classList: {
      contains: () => false
    }
  }
};

global.window = {
  _pageLoadTimestamp: Date.now() - 3000,
  getThemeBgColor: () => '#181b22'
};

global.localStorage = {
  getItem: () => 'dark'
};

const SplashLifecycleService = require('../js/splashLifecycleService.js');

test('SplashLifecycleService exports all expected functions', () => {
  assert.strictEqual(typeof SplashLifecycleService._markSplashFrameLoaded, 'function');
  assert.strictEqual(typeof SplashLifecycleService._markLaunchWindowGone, 'function');
  assert.strictEqual(typeof SplashLifecycleService.fadeOutColdStartOverlay, 'function');
  assert.strictEqual(typeof SplashLifecycleService.showResumeOverlay, 'function');
  assert.strictEqual(typeof SplashLifecycleService.hideResumeOverlay, 'function');
  assert.strictEqual(typeof SplashLifecycleService._notifyNativeContentPainted, 'function');
});

test('SplashLifecycleService tracks timestamps', () => {
  SplashLifecycleService._markSplashFrameLoaded();
  assert.strictEqual(typeof global.window._splashFrameStartMs, 'number');

  SplashLifecycleService._markLaunchWindowGone();
  assert.strictEqual(typeof global.window._launchWindowGoneMs, 'number');
});

test('SplashLifecycleService.showResumeOverlay and hideResumeOverlay update styles', () => {
  SplashLifecycleService.showResumeOverlay();
  assert.strictEqual(overlayStyle.opacity, '1');
  assert.strictEqual(overlayStyle.visibility, 'visible');

  SplashLifecycleService.hideResumeOverlay();
  assert.strictEqual(overlayStyle.opacity, '0');
});

test('SplashLifecycleService.fadeOutColdStartOverlay triggers fade out when elapsed >= minVisibleMs', () => {
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 5000;
    SplashLifecycleService.fadeOutColdStartOverlay();
    assert.strictEqual(frameStyle.opacity, '0');
    assert.strictEqual(frameStyle.pointerEvents, 'none');
  } finally {
    Date.now = realNow;
  }
});

