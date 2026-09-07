'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

const RecurringModalService = require('../js/recurringModalService.js');

describe('RecurringModalService Module Tests', () => {
  beforeEach(() => {
    // Reset global stubs
    global.window = {
      state: { lang: 'el', recurringTemplates: [] },
      _pendingRecurringSettings: {
        isActive: false,
        days: [],
        months: [],
        years: [],
        preset: 'monthly',
        endType: 'perpetual',
        endDate: null,
        endYear: null
      }
    };
    global.document = {
      getElementById: (id) => {
        return {
          id,
          value: '',
          style: {},
          classList: {
            add: () => { },
            remove: () => { },
            toggle: () => { }
          },
          innerHTML: '',
          textContent: '',
          appendChild: () => { }
        };
      },
      querySelectorAll: () => []
    };
    global.state = global.window.state;
  });

  test('RecurringModalService exports all expected functions', () => {
    assert.strictEqual(typeof RecurringModalService.openRecurringModal, 'function');
    assert.strictEqual(typeof RecurringModalService.toggleRecurringFrequencyList, 'function');
    assert.strictEqual(typeof RecurringModalService.selectRecurringFrequencyOption, 'function');
    assert.strictEqual(typeof RecurringModalService.onSimplePresetChange, 'function');
    assert.strictEqual(typeof RecurringModalService.toggleRecurringSpecificMonth, 'function');
    assert.strictEqual(typeof RecurringModalService.selectRecurringEndType, 'function');
    assert.strictEqual(typeof RecurringModalService.updateRecurringSummary, 'function');
    assert.strictEqual(typeof RecurringModalService.clearRecurringSettings, 'function');
    assert.strictEqual(typeof RecurringModalService.saveRecurringSettings, 'function');
    assert.strictEqual(typeof RecurringModalService.resetRepInstButton, 'function');
    assert.strictEqual(typeof RecurringModalService.getPendingSettings, 'function');
    assert.strictEqual(typeof RecurringModalService.setPendingSettings, 'function');
  });

  test('toggleRecurringSpecificMonth adds and removes months safely', () => {
    const pending = RecurringModalService.getPendingSettings();
    pending.months = [3];

    const element = {
      classList: {
        add: () => { },
        remove: () => { }
      }
    };

    // Adding month 5
    RecurringModalService.toggleRecurringSpecificMonth(5, element);
    assert.ok(pending.months.includes(5));
    assert.ok(pending.months.includes(3));

    // Removing month 3
    RecurringModalService.toggleRecurringSpecificMonth(3, element);
    assert.ok(!pending.months.includes(3));
    assert.ok(pending.months.includes(5));

    // Should not remove last remaining month
    RecurringModalService.toggleRecurringSpecificMonth(5, element);
    assert.strictEqual(pending.months.length, 1);
    assert.strictEqual(pending.months[0], 5);
  });

  test('selectRecurringEndType manages perpetual and custom end date', () => {
    const pending = RecurringModalService.getPendingSettings();
    pending.endType = 'date';
    pending.endDate = '2026-12-31';

    RecurringModalService.selectRecurringEndType('perpetual');
    assert.strictEqual(pending.endType, 'perpetual');
    assert.strictEqual(pending.endDate, null);

    RecurringModalService.selectRecurringEndType('date');
    assert.strictEqual(pending.endType, 'date');
    assert.ok(pending.endDate !== null);
    assert.match(pending.endDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('clearRecurringSettings resets pending values and button state', () => {
    const pending = RecurringModalService.getPendingSettings();
    pending.isActive = true;
    pending.preset = 'yearly';
    pending.months = [1, 2, 3];
    pending.templateId = 'temp-123';

    RecurringModalService.clearRecurringSettings(false);

    assert.strictEqual(pending.isActive, false);
    assert.strictEqual(pending.preset, 'monthly');
    assert.strictEqual(pending.months.length, 0);
    assert.strictEqual(pending.endType, 'perpetual');
    assert.strictEqual(pending.templateId, undefined);
  });

  test('saveRecurringSettings activates settings and updates existing template', () => {
    const pending = RecurringModalService.getPendingSettings();
    pending.preset = 'weekly';
    pending.templateId = 'test-template-1';

    const testTemplate = {
      id: 'test-template-1',
      preset: 'monthly',
      endType: 'perpetual'
    };
    global.window.state.recurringTemplates = [testTemplate];

    RecurringModalService.saveRecurringSettings();

    assert.strictEqual(pending.isActive, true);
    assert.strictEqual(testTemplate.preset, 'weekly');
    assert.ok(testTemplate.updated_at);
  });
});
