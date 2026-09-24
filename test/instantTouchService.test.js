'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const InstantTouchService = require('../js/instantTouchService.js');

test('InstantTouchService exports all expected methods', () => {
  assert.strictEqual(typeof InstantTouchService.init, 'function');
  assert.strictEqual(typeof InstantTouchService.destroy, 'function');
  assert.strictEqual(typeof InstantTouchService.findInteractiveTarget, 'function');
  assert.strictEqual(typeof InstantTouchService.triggerInstantHaptic, 'function');
  assert.strictEqual(typeof InstantTouchService.clearPressedState, 'function');
});

test('InstantTouchService.findInteractiveTarget identifies buttons, icons, tabs, FAB and cards', () => {
  function createMockElement(tagName, className, isExcluded) {
    return {
      tagName: tagName.toUpperCase(),
      className: className || '',
      closest: (sel) => {
        if (isExcluded) return {};
        const selectors = sel.split(',').map(s => s.trim());
        if (selectors.includes(tagName.toLowerCase())) return { tagName, className };
        if (className && selectors.includes('.' + className)) return { tagName, className };
        return null;
      }
    };
  }

  const btn = createMockElement('button', 'btn-primary');
  assert.ok(InstantTouchService.findInteractiveTarget(btn));

  const iconBtn = createMockElement('i', 'icon-btn');
  assert.ok(InstantTouchService.findInteractiveTarget(iconBtn));

  const navItem = createMockElement('div', 'nav-item');
  assert.ok(InstantTouchService.findInteractiveTarget(navItem));

  const fab = createMockElement('button', 'fab');
  assert.ok(InstantTouchService.findInteractiveTarget(fab));

  const calcKey = createMockElement('button', 'calc-key-btn');
  assert.ok(InstantTouchService.findInteractiveTarget(calcKey));

  const txItem = createMockElement('div', 'transaction-item');
  assert.ok(InstantTouchService.findInteractiveTarget(txItem));

  // Non-interactive plain div
  const plainDiv = createMockElement('div', '');
  assert.strictEqual(InstantTouchService.findInteractiveTarget(plainDiv), null);

  // Excluded inputs
  const inputEl = createMockElement('input', '', true);
  assert.strictEqual(InstantTouchService.findInteractiveTarget(inputEl), null);
});

test('InstantTouchService.clearPressedState removes is-pressed class', () => {
  const classes = new Set(['is-pressed']);
  const mockEl = {
    classList: {
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c)
    }
  };

  InstantTouchService.clearPressedState(mockEl, true);
  assert.strictEqual(classes.has('is-pressed'), false);
});

test('InstantTouchService.triggerInstantHaptic invokes haptics safely', () => {
  let hapticCalled = false;
  const originalWindow = global.window;
  global.window = {
    triggerHaptic: (type) => {
      hapticCalled = true;
      assert.strictEqual(type, 'selection');
    }
  };

  try {
    InstantTouchService.triggerInstantHaptic();
    assert.strictEqual(hapticCalled, true);
  } finally {
    global.window = originalWindow;
  }
});
